/**
 * SMEP Enums — every enum in the system lives here.
 *
 * No string literals anywhere. Import from @thecharge/sndv-config.
 */

/** Status a task can be in during protocol execution. */
export enum TaskStatus {
	PENDING = "pending",
	RUNNING = "running",
	VERIFIED = "verified",
	FALSIFIED = "falsified",
	ERRORED = "errored",
	SKIPPED = "skipped",
	TIMED_OUT = "timed_out",
}

/** Terminal statuses — once a task reaches one, it never moves forward. */
export const TERMINAL_STATUSES: ReadonlySet<TaskStatus> = new Set([
	TaskStatus.FALSIFIED,
	TaskStatus.ERRORED,
	TaskStatus.SKIPPED,
	TaskStatus.TIMED_OUT,
]);

/** Phase in the Double Loop converging spiral. */
export enum LoopPhase {
	FALSIFY = "falsify",
	DELIVER = "deliver",
	VERIFY = "verify",
}

/** The execution order of phases within a single cycle. */
export const LOOP_PHASE_ORDER: readonly LoopPhase[] = [
	LoopPhase.FALSIFY,
	LoopPhase.DELIVER,
	LoopPhase.VERIFY,
] as const;

/** Outcome of a full protocol execution. */
export enum ProtocolOutcome {
	VERIFIED = "verified",
	FALSIFIED = "falsified",
	ERRORED = "errored",
}

/** Outcome of the double loop after all cycles. */
export enum LoopOutcome {
	VERIFIED = "verified",
	FALSIFIED = "falsified",
	IN_PROGRESS = "in_progress",
}

/** Project type for CLI initialization. */
export enum ProjectType {
	GREENFIELD = "greenfield",
	BROWNFIELD = "brownfield",
}

/** Chat message role for LLM adapter. */
export enum ChatRole {
	SYSTEM = "system",
	USER = "user",
	ASSISTANT = "assistant",
}

/** LLM verdict on a task. */
export enum VerdictStatus {
	VERIFIED = "verified",
	FALSIFIED = "falsified",
}

/** Decision action in session memory (what happened). */
export enum DecisionAction {
	VERIFIED = "verified",
	FALSIFIED = "falsified",
	ERRORED = "errored",
	TIMED_OUT = "timed_out",
	SKIPPED = "skipped",
}
