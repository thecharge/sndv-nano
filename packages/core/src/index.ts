// Re-export everything from config so consumers can import from core if they want

// Re-export config types
export type {
	CycleReport,
	ExecutionReport,
	Hypothesis,
	HypothesisInput,
	LoopConfig,
	LoopTaskOpts,
	ProtocolConfig,
	Risk,
	RunnableTask,
	SchedulableTask,
	TaskContextInterface,
	TaskFn,
	TaskId,
	TaskOpts,
	TaskResult,
} from "@thecharge/sndv-config";
export {
	// Errors
	ConstraintViolation,
	CycleDetectedError,
	DEFAULT_MAX_CYCLES,
	DEFAULT_MAX_ITERATIONS,
	FalsificationError,
	// Schemas
	HypothesisSchema,
	isConstraintViolation,
	isFalsificationError,
	isProtocolError,
	LOOP_PHASE_ORDER,
	LoopConfigSchema,
	LoopOutcome,
	LoopPhase,
	LoopPhaseSchema,
	ProtocolConfigSchema,
	ProtocolError,
	ProtocolOutcome,
	// Constants
	REPORT_SEPARATOR,
	RiskSchema,
	SmepErrors,
	STATUS_ICONS,
	TaskIdSchema,
	// Enums
	TaskStatus,
	TaskStatusSchema,
	TERMINAL_STATUSES,
	TimeoutExceededError,
} from "@thecharge/sndv-config";

// Core engine exports
export { TaskContext } from "./context";
export { DoubleLoop } from "./double-loop";
export { checkConstraint, createHypothesis } from "./hypothesis";
export { Protocol, quickProtocol } from "./protocol";
export { isVerified, summary } from "./report";
export { runTask } from "./runner";
export { propagatePruning, readyTasks, validateGraph } from "./scheduler";
