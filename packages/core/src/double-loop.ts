import {
	type CycleReport,
	DEFAULT_MAX_ITERATIONS,
	type ExecutionReport,
	type HypothesisInput,
	HypothesisSchema,
	LOOP_PHASE_ORDER,
	type LoopConfig,
	LoopConfigSchema,
	LoopOutcome,
	LoopPhase,
	type LoopTaskOpts,
	REPORT_SEPARATOR,
	SmepErrors,
	STATUS_ICONS,
	type TaskFn,
	TaskStatus,
	TERMINAL_STATUSES,
} from "@thecharge/sndv-config";
import { Protocol } from "./protocol";

interface LoopTask {
	name: string;
	phase: LoopPhase;
	fn: TaskFn;
	risk: number;
	dependsOn: string[];
	timeoutMs?: number;
	retryCount: number;
}

/**
 * The Double Loop - a converging spiral that drives from idea to verified solution.
 *
 * Three interlocking phases:
 *   1. FALSIFY - Attack the plan. Can this even work?
 *   2. DELIVER - Build what survived. Ship the thing.
 *   3. VERIFY  - Attack what was built. Does it actually work?
 *
 * The loop converges because every cycle either verifies a task (done)
 * or kills it (pruned). Total work monotonically decreases.
 */
export class DoubleLoop {
	private readonly hypothesis;
	private readonly config: LoopConfig;
	private readonly tasks = new Map<string, LoopTask>();
	private readonly resolved = new Map<string, TaskStatus>();
	private readonly cycleReports: CycleReport[] = [];
	private onCycleComplete?: (cycle: CycleReport) => void;

	constructor(hypothesis: HypothesisInput, config?: Partial<LoopConfig>) {
		this.hypothesis = HypothesisSchema.parse(hypothesis);
		this.config = LoopConfigSchema.parse(config ?? {});
	}

	onCycle = (callback: (cycle: CycleReport) => void): this => {
		this.onCycleComplete = callback;
		return this;
	};

	/** Register a falsification task - tries to break the plan. */
	addFalsify = (taskFn: TaskFn, opts: LoopTaskOpts): this =>
		this.register(LoopPhase.FALSIFY, taskFn, opts);

	/** Register a delivery task - builds what survived. */
	addDeliver = (taskFn: TaskFn, opts: LoopTaskOpts): this =>
		this.register(LoopPhase.DELIVER, taskFn, { ...opts, retry: opts.retry ?? 1 });

	/** Register a verification task - attacks what was built. */
	addVerify = (taskFn: TaskFn, opts: LoopTaskOpts): this =>
		this.register(LoopPhase.VERIFY, taskFn, opts);

	/** Run the converging spiral. Returns all cycle reports. */
	run = async (): Promise<CycleReport[]> => {
		const loopStartTime = performance.now();

		for (let cycleIndex = 1; cycleIndex <= this.config.maxCycles; cycleIndex++) {
			if (this.isTimedOut(loopStartTime)) break;

			const cycleReport = await this.executeCycle(cycleIndex);
			this.cycleReports.push(cycleReport);
			this.onCycleComplete?.(cycleReport);

			const remainingTaskNames = this.remainingTasks();
			if (remainingTaskNames.length === 0 || cycleReport.converged) break;
		}

		return this.cycleReports;
	};

	get status(): LoopOutcome {
		if ([...this.tasks.values()].every((task) => this.resolved.has(task.name))) {
			const allVerified = [...this.resolved.values()].every(
				(taskStatus) => taskStatus === TaskStatus.VERIFIED,
			);
			return allVerified ? LoopOutcome.VERIFIED : LoopOutcome.FALSIFIED;
		}

		for (const task of this.tasks.values()) {
			if (this.resolved.has(task.name)) continue;
			for (const dependencyName of task.dependsOn) {
				const dependencyStatus = this.resolved.get(dependencyName);
				if (dependencyStatus && dependencyStatus !== TaskStatus.VERIFIED) continue;
				if (!dependencyStatus) return LoopOutcome.IN_PROGRESS;
			}
		}

		return this.resolved.size > 0 ? LoopOutcome.FALSIFIED : LoopOutcome.IN_PROGRESS;
	}

	summarize = (): string => {
		const lines = [
			REPORT_SEPARATOR,
			"Double Loop Summary",
			REPORT_SEPARATOR,
			`Goal:       ${this.hypothesis.goal}`,
			`Status:     ${this.status.toUpperCase()}`,
			`Cycles:     ${this.cycleReports.length}`,
			`Tasks:      ${this.tasks.size}`,
			`  resolved: ${this.resolved.size}`,
			`  remaining: ${this.tasks.size - this.resolved.size}`,
			"",
		];

		for (const [taskName, taskStatus] of this.resolved) {
			const phaseLabel = this.tasks.get(taskName)?.phase.toUpperCase().padStart(8) ?? "?";
			const icon = STATUS_ICONS[taskStatus] ?? "?";
			lines.push(`  ${icon} [${phaseLabel}] ${taskName}`);
		}

		for (const task of this.tasks.values()) {
			if (!this.resolved.has(task.name)) {
				lines.push(`  ○ [${task.phase.toUpperCase().padStart(8)}] ${task.name}`);
			}
		}

		return lines.join("\n");
	};

	// --- Private ---

	private register = (phase: LoopPhase, taskFn: TaskFn, opts: LoopTaskOpts): this => {
		if (this.tasks.has(opts.name)) {
			throw SmepErrors.duplicateTask(opts.name);
		}
		this.tasks.set(opts.name, {
			name: opts.name,
			phase,
			fn: taskFn,
			risk: opts.risk ?? 0.5,
			dependsOn: opts.dependsOn ?? [],
			timeoutMs: opts.timeoutMs,
			retryCount: opts.retry ?? 0,
		});
		return this;
	};

	private executeCycle = async (cycleNumber: number): Promise<CycleReport> => {
		const cycleStartTime = performance.now();
		const cycleReport: CycleReport = {
			cycleNumber,
			phaseReports: {},
			tasksVerified: [],
			tasksFalsified: [],
			tasksDelivered: [],
			durationMs: 0,
			converged: false,
		};

		for (const phase of LOOP_PHASE_ORDER) {
			const phaseProtocol = this.buildProtocolForPhase(phase);
			if (phaseProtocol.taskCount === 0) continue;

			const phaseReport = await phaseProtocol.execute();
			cycleReport.phaseReports[phase] = phaseReport;
			this.ingestResults(phaseReport, cycleReport);
		}

		cycleReport.durationMs = performance.now() - cycleStartTime;
		cycleReport.converged = cycleReport.tasksFalsified.length === 0;
		return cycleReport;
	};

	private buildProtocolForPhase = (targetPhase: LoopPhase): Protocol & { taskCount: number } => {
		const phaseProtocol = new Protocol(this.hypothesis, {
			maxIterations: DEFAULT_MAX_ITERATIONS,
		});
		let registeredCount = 0;

		for (const task of this.tasks.values()) {
			if (task.phase !== targetPhase || this.resolved.has(task.name)) continue;

			const validDeps = this.resolvePhaseDeps(task, targetPhase);
			if (!validDeps) continue;

			phaseProtocol.addTask(task.fn, {
				name: task.name,
				risk: task.risk,
				dependsOn: validDeps,
				timeoutMs: task.timeoutMs,
				retry: task.retryCount,
			});
			registeredCount++;
		}

		return Object.assign(phaseProtocol, { taskCount: registeredCount });
	};

	/** Resolve valid dependencies for a task in the current phase. null = skip task. */
	private resolvePhaseDeps = (task: LoopTask, targetPhase: LoopPhase): string[] | null => {
		const validDeps: string[] = [];

		for (const depName of task.dependsOn) {
			const depStatus = this.resolved.get(depName);
			if (depStatus && depStatus !== TaskStatus.VERIFIED) return null;
			if (depStatus) continue;

			const depTask = this.tasks.get(depName);
			if (depTask?.phase !== targetPhase) return null;
			validDeps.push(depName);
		}

		return validDeps;
	};

	private ingestResults = (executionReport: ExecutionReport, cycleReport: CycleReport): void => {
		for (const taskResult of executionReport.taskResults) {
			if (taskResult.status === TaskStatus.VERIFIED) {
				this.resolved.set(taskResult.taskName, TaskStatus.VERIFIED);
				const taskPhase = this.tasks.get(taskResult.taskName)?.phase;
				if (taskPhase === LoopPhase.DELIVER) {
					cycleReport.tasksDelivered.push(taskResult.taskName);
				} else {
					cycleReport.tasksVerified.push(taskResult.taskName);
				}
			} else if (TERMINAL_STATUSES.has(taskResult.status)) {
				this.resolved.set(taskResult.taskName, taskResult.status);
				cycleReport.tasksFalsified.push(taskResult.taskName);
			}
		}
	};

	private remainingTasks = (): string[] =>
		[...this.tasks.values()]
			.filter((task) => !this.resolved.has(task.name))
			.map((task) => task.name);

	private isTimedOut = (startTime: number): boolean => {
		if (!this.config.globalTimeoutMs) return false;
		return performance.now() - startTime >= this.config.globalTimeoutMs;
	};
}
