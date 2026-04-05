import {
	type Hypothesis,
	SmepErrors,
	type TaskContextInterface,
	type TaskFn,
} from "@thecharge/sndv-config";

export type { TaskFn };

/**
 * Runtime toolbox injected into every task.
 *
 * Three things you do with it:
 *   - Record what you observe  → ctx.evidence("key", value)
 *   - Declare something broke  → ctx.falsify("reason")
 *   - Run sub-work with timeout → ctx.run(fn, ...args)
 */
export class TaskContext implements TaskContextInterface {
	readonly taskId: string;
	readonly hypothesis: Hypothesis;
	readonly shared: Record<string, unknown>;
	private readonly evidenceStore: Record<string, unknown> = {};
	private readonly taskTimeoutMs?: number;
	private activeTimerIds: ReturnType<typeof setTimeout>[] = [];

	constructor(opts: {
		taskId: string;
		hypothesis: Hypothesis;
		shared: Record<string, unknown>;
		timeoutMs?: number;
	}) {
		this.taskId = opts.taskId;
		this.hypothesis = opts.hypothesis;
		this.shared = opts.shared;
		this.taskTimeoutMs = opts.timeoutMs;
	}

	/** Record a piece of evidence (metric, observation, artifact). */
	evidence = (key: string, value: unknown): void => {
		this.evidenceStore[key] = value;
	};

	/** Declare this task's assumption is broken. Stops execution immediately. */
	falsify = (reason: string): never => {
		throw SmepErrors.falsification(reason, { ...this.evidenceStore });
	};

	/** Assert a hypothesis constraint still holds. */
	checkConstraint = (label: string, violated: boolean, detail = ""): void => {
		if (!violated) return;
		throw SmepErrors.constraintViolation(label, detail);
	};

	/** Execute fn within the task's timeout budget. Works with sync and async. */
	run = async <T>(fn: (...args: unknown[]) => T | Promise<T>, ...args: unknown[]): Promise<T> => {
		const result = fn(...args);
		if (!(result instanceof Promise)) return result as T;
		if (!this.taskTimeoutMs) return result;

		return new Promise<T>((resolve, reject) => {
			const timerId = setTimeout(() => {
				reject(new Error("Task timeout"));
			}, this.taskTimeoutMs);
			this.activeTimerIds.push(timerId);

			result.then(
				(value) => {
					clearTimeout(timerId);
					resolve(value);
				},
				(error) => {
					clearTimeout(timerId);
					reject(error);
				},
			);
		});
	};

	/** Get all recorded evidence as a plain object. */
	getEvidence = (): Record<string, unknown> => {
		return { ...this.evidenceStore };
	};

	/** Clear all active timers — call after task completes to prevent leaks. */
	clearTimers = (): void => {
		for (const timerId of this.activeTimerIds) {
			clearTimeout(timerId);
		}
		this.activeTimerIds = [];
	};
}
