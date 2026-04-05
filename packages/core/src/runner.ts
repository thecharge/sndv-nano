import {
	type Hypothesis,
	isConstraintViolation,
	isFalsificationError,
	type RunnableTask,
	type TaskFn,
	type TaskResult,
	TaskStatus,
} from "@thecharge/sndv-config";
import { TaskContext } from "./context";

export interface RunContext {
	hypothesis: Hypothesis;
	shared: Record<string, unknown>;
	onEvidence: (taskId: string, evidence: Record<string, unknown>) => void;
}

class TimeoutSignal extends Error {
	constructor() {
		super("timeout");
		this.name = "TimeoutSignal";
	}
}

/** Execute one task. Handles retries, timeouts, falsification, and evidence capture. */
export const runTask = async (task: RunnableTask, runCtx: RunContext): Promise<TaskResult> => {
	const maxAttempts = task.retryCount + 1;
	let lastErrorMessage: string | undefined;
	let attemptStartTime = performance.now();

	for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber++) {
		const taskCtx = new TaskContext({
			taskId: task.id,
			hypothesis: runCtx.hypothesis,
			shared: runCtx.shared,
			timeoutMs: task.timeoutMs,
		});

		attemptStartTime = performance.now();

		try {
			const returnValue = await executeWithTimeout(task.fn, taskCtx, task.timeoutMs);
			const evidence = taskCtx.getEvidence();
			taskCtx.clearTimers();
			runCtx.onEvidence(task.id, evidence);
			return buildTaskResult(
				task,
				TaskStatus.VERIFIED,
				performance.now() - attemptStartTime,
				evidence,
				undefined,
				returnValue,
			);
		} catch (caughtError) {
			taskCtx.clearTimers();
			const errorOutcome = classifyError(caughtError, taskCtx, task, runCtx, attemptStartTime);
			if (errorOutcome.isTerminal) return errorOutcome.result;
			lastErrorMessage = errorOutcome.errorMessage;
		}
	}

	const finalStatus = lastErrorMessage?.startsWith("Timed out")
		? TaskStatus.TIMED_OUT
		: TaskStatus.ERRORED;
	return buildTaskResult(
		task,
		finalStatus,
		performance.now() - attemptStartTime,
		{},
		lastErrorMessage,
	);
};

// --- Private helpers ---

interface ErrorOutcome {
	isTerminal: boolean;
	result: TaskResult;
	errorMessage: string;
}

const classifyError = (
	caughtError: unknown,
	taskCtx: TaskContext,
	task: RunnableTask,
	runCtx: RunContext,
	attemptStartTime: number,
): ErrorOutcome => {
	if (isFalsificationError(caughtError)) {
		const evidence = { ...taskCtx.getEvidence(), ...caughtError.evidence };
		runCtx.onEvidence(task.id, evidence);
		return {
			isTerminal: true,
			result: buildTaskResult(
				task,
				TaskStatus.FALSIFIED,
				performance.now() - attemptStartTime,
				evidence,
				caughtError.message,
			),
			errorMessage: caughtError.message,
		};
	}

	if (isConstraintViolation(caughtError)) {
		const evidence = taskCtx.getEvidence();
		runCtx.onEvidence(task.id, evidence);
		return {
			isTerminal: true,
			result: buildTaskResult(
				task,
				TaskStatus.FALSIFIED,
				performance.now() - attemptStartTime,
				evidence,
				caughtError.message,
			),
			errorMessage: caughtError.message,
		};
	}

	if (caughtError instanceof TimeoutSignal) {
		return {
			isTerminal: false,
			result: buildTaskResult(task, TaskStatus.TIMED_OUT, performance.now() - attemptStartTime, {}),
			errorMessage: `Timed out after ${task.timeoutMs}ms`,
		};
	}

	const errorMessage =
		caughtError instanceof Error
			? `${caughtError.name}: ${caughtError.message}`
			: String(caughtError);
	return {
		isTerminal: false,
		result: buildTaskResult(
			task,
			TaskStatus.ERRORED,
			performance.now() - attemptStartTime,
			{},
			errorMessage,
		),
		errorMessage,
	};
};

const executeWithTimeout = async (
	taskFunction: TaskFn,
	taskCtx: TaskContext,
	taskTimeoutMs?: number,
): Promise<unknown> => {
	if (!taskTimeoutMs) return taskFunction(taskCtx);

	let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			taskFunction(taskCtx),
			new Promise<never>((_resolve, reject) => {
				timeoutHandle = setTimeout(() => reject(new TimeoutSignal()), taskTimeoutMs);
			}),
		]);
	} finally {
		if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
	}
};

const buildTaskResult = (
	task: RunnableTask,
	status: TaskStatus,
	durationMs: number,
	evidence: Record<string, unknown>,
	error?: string,
	returnValue?: unknown,
): TaskResult => ({
	taskId: task.id,
	taskName: task.name,
	status,
	durationMs,
	evidence,
	error,
	returnValue,
});
