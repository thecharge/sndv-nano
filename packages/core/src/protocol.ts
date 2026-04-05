import {
	type ExecutionReport,
	type Hypothesis,
	type HypothesisInput,
	HypothesisSchema,
	type ProtocolConfig,
	ProtocolConfigSchema,
	ProtocolOutcome,
	RiskSchema,
	type RunnableTask,
	type SchedulableTask,
	SmepErrors,
	STATUS_ICONS,
	type TaskFn,
	type TaskOpts,
	type TaskResult,
	TaskStatus,
	TERMINAL_STATUSES,
} from "@thecharge/sndv-config";
import { runTask } from "./runner";
import { propagatePruning, readyTasks, validateGraph } from "./scheduler";

interface InternalTask extends SchedulableTask, RunnableTask {
	result?: TaskResult;
}

/** The SMEP execution engine. Orchestrates hypothesis -> tasks -> report. */
export class Protocol {
	readonly hypothesis: Hypothesis;
	private readonly config: ProtocolConfig;
	private readonly tasks = new Map<string, InternalTask>();
	private readonly shared: Record<string, unknown> = {};
	private readonly allEvidence: Record<string, unknown> = {};
	private onTaskComplete?: (result: TaskResult) => void;

	constructor(hypothesis: HypothesisInput, config?: Partial<ProtocolConfig>) {
		this.hypothesis = HypothesisSchema.parse(hypothesis);
		this.config = ProtocolConfigSchema.parse(config ?? {});
	}

	/** Set a callback for task completion events. */
	onComplete = (callback: (result: TaskResult) => void): this => {
		this.onTaskComplete = callback;
		return this;
	};

	/** Register a task. Returns the task name. */
	addTask = (taskFn: TaskFn, opts: TaskOpts = {}): string => {
		const taskName = opts.name ?? taskFn.name;
		if (!taskName) throw SmepErrors.unnamedTask();
		if (this.tasks.has(taskName)) throw SmepErrors.duplicateTask(taskName);

		const validatedRisk = RiskSchema.parse(opts.risk ?? 0.5);

		this.tasks.set(taskName, {
			id: taskName,
			name: taskName,
			fn: taskFn,
			risk: validatedRisk,
			dependsOn: opts.dependsOn ?? [],
			timeoutMs: opts.timeoutMs,
			retryCount: opts.retry ?? 0,
			status: TaskStatus.PENDING,
		});

		return taskName;
	};

	/** Run the full falsification loop. */
	execute = async (): Promise<ExecutionReport> => {
		if (this.tasks.size === 0) throw SmepErrors.protocolEmpty();
		validateGraph(this.tasks as Map<string, SchedulableTask>);

		const protocolStartTime = performance.now();
		let iterationCount = 0;
		const allResults: TaskResult[] = [];

		while (iterationCount < this.config.maxIterations) {
			iterationCount++;

			if (this.isGlobalTimeout(protocolStartTime)) {
				this.markRemainingTimedOut(allResults);
				break;
			}

			const readyTaskIds = readyTasks(this.tasks as Map<string, SchedulableTask>);
			if (readyTaskIds.length === 0) break;

			const batchResults = await Promise.all(
				readyTaskIds.map((taskId) => {
					const task = this.tasks.get(taskId);
					if (!task) throw SmepErrors.missingDependency(taskId, taskId);
					return this.executeTask(task);
				}),
			);

			for (const taskResult of batchResults) {
				allResults.push(taskResult);
				this.onTaskComplete?.(taskResult);
			}

			const prunedTaskIds = propagatePruning(this.tasks as Map<string, SchedulableTask>);
			for (const prunedId of prunedTaskIds) {
				const prunedTask = this.tasks.get(prunedId);
				if (!prunedTask) continue;
				prunedTask.result = {
					taskId: prunedId,
					taskName: prunedTask.name,
					status: TaskStatus.SKIPPED,
					durationMs: 0,
					evidence: {},
					error: SmepErrors.skippedDueToUpstream(),
				};
			}
		}

		this.collectPrunedResults(allResults);
		return this.buildReport(allResults, iterationCount, performance.now() - protocolStartTime);
	};

	/** Reset all tasks to pending so the protocol can re-run. */
	reset = (): void => {
		for (const task of this.tasks.values()) {
			task.status = TaskStatus.PENDING;
			task.result = undefined;
		}
		for (const key of Object.keys(this.shared)) delete this.shared[key];
		for (const key of Object.keys(this.allEvidence)) delete this.allEvidence[key];
	};

	/** ASCII visualization of the task graph. */
	visualize = (): string => {
		const sortedTasks = [...this.tasks.values()].sort((left, right) => right.risk - left.risk);
		const lines = [`Protocol: ${this.hypothesis.goal}`, ""];

		for (const task of sortedTasks) {
			const dependencyLabel = task.dependsOn.length > 0 ? task.dependsOn.join(", ") : "(root)";
			const icon = STATUS_ICONS[task.status] ?? "?";
			lines.push(`  ${icon} ${task.name}  [risk=${task.risk.toFixed(1)}]  ← ${dependencyLabel}`);
		}

		return lines.join("\n");
	};

	// --- Private ---

	private executeTask = async (task: InternalTask): Promise<TaskResult> => {
		task.status = TaskStatus.RUNNING;
		const result = await runTask(task, {
			hypothesis: this.hypothesis,
			shared: this.shared,
			onEvidence: (_taskId, evidence) => Object.assign(this.allEvidence, evidence),
		});
		task.status = result.status;
		task.result = result;
		return result;
	};

	private isGlobalTimeout = (startTime: number): boolean => {
		if (!this.config.globalTimeoutMs) return false;
		return performance.now() - startTime >= this.config.globalTimeoutMs;
	};

	private markRemainingTimedOut = (results: TaskResult[]): void => {
		for (const task of this.tasks.values()) {
			if (task.status !== TaskStatus.PENDING) continue;
			task.status = TaskStatus.TIMED_OUT;
			task.result = {
				taskId: task.id,
				taskName: task.name,
				status: TaskStatus.TIMED_OUT,
				durationMs: 0,
				evidence: {},
				error: SmepErrors.globalTimeoutMessage(),
			};
			results.push(task.result);
		}
	};

	private resolveOutcome = (allVerified: boolean, statusSet: Set<TaskStatus>): ProtocolOutcome => {
		if (allVerified) return ProtocolOutcome.VERIFIED;
		if (statusSet.has(TaskStatus.FALSIFIED)) return ProtocolOutcome.FALSIFIED;
		return ProtocolOutcome.ERRORED;
	};

	private collectPrunedResults = (results: TaskResult[]): void => {
		for (const task of this.tasks.values()) {
			if (task.result && !results.includes(task.result)) results.push(task.result);
		}
	};

	private buildReport = (
		results: TaskResult[],
		iterations: number,
		durationMs: number,
	): ExecutionReport => {
		const taskValues = [...this.tasks.values()];
		const allVerified = taskValues.every((task) => task.status === TaskStatus.VERIFIED);
		const statusSet = new Set(taskValues.map((task) => task.status));
		const outcome = this.resolveOutcome(allVerified, statusSet);

		const survivingPath = taskValues
			.filter((task) => task.status === TaskStatus.VERIFIED)
			.map((task) => task.name);

		const prunedPaths = taskValues
			.filter((task) => TERMINAL_STATUSES.has(task.status))
			.map((task) => task.name);

		return {
			hypothesisGoal: this.hypothesis.goal,
			constraints: [...this.hypothesis.constraints],
			status: outcome,
			iterations,
			totalDurationMs: durationMs,
			taskResults: results,
			survivingPath,
			prunedPaths,
			allEvidence: { ...this.allEvidence },
		};
	};
}

/** One-liner to create a Protocol. */
export const quickProtocol = (
	goal: string,
	constraints: string[] = [],
	config?: Partial<ProtocolConfig>,
): Protocol => new Protocol({ goal, constraints }, config);
