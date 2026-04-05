import { z } from "zod";
import { LoopPhase, ProtocolOutcome, TaskStatus } from "./enums";

// ---------------------------------------------------------------------------
// Branded types - validated at system boundaries, zero overhead at runtime
// ---------------------------------------------------------------------------

export const RiskSchema = z.number().min(0).max(1).brand<"Risk">();
export type Risk = z.infer<typeof RiskSchema>;

export const TaskIdSchema = z.string().min(1).max(128).brand<"TaskId">();
export type TaskId = z.infer<typeof TaskIdSchema>;

// ---------------------------------------------------------------------------
// Core schemas
// ---------------------------------------------------------------------------

export const TaskStatusSchema = z.nativeEnum(TaskStatus);

export const HypothesisSchema = z.object({
	goal: z.string().min(1, "Goal cannot be empty"),
	constraints: z.array(z.string().min(1)).default([]),
	metadata: z.record(z.unknown()).default({}),
});
export type HypothesisInput = z.input<typeof HypothesisSchema>;
export type Hypothesis = z.infer<typeof HypothesisSchema>;

export const ProtocolConfigSchema = z.object({
	maxIterations: z.number().int().positive().default(20),
	globalTimeoutMs: z.number().positive().optional(),
});
export type ProtocolConfig = z.infer<typeof ProtocolConfigSchema>;

export const LoopConfigSchema = z.object({
	maxCycles: z.number().int().positive().default(5),
	globalTimeoutMs: z.number().positive().optional(),
});
export type LoopConfig = z.infer<typeof LoopConfigSchema>;

export const LoopPhaseSchema = z.nativeEnum(LoopPhase);
export const ProtocolOutcomeSchema = z.nativeEnum(ProtocolOutcome);

// ---------------------------------------------------------------------------
// Task result - what one task produced
// ---------------------------------------------------------------------------

export interface TaskResult {
	taskId: string;
	taskName: string;
	status: TaskStatus;
	durationMs: number;
	evidence: Record<string, unknown>;
	error?: string;
	returnValue?: unknown;
}

// ---------------------------------------------------------------------------
// Execution report - full protocol run result
// ---------------------------------------------------------------------------

export interface ExecutionReport {
	hypothesisGoal: string;
	constraints: string[];
	status: ProtocolOutcome;
	iterations: number;
	totalDurationMs: number;
	taskResults: TaskResult[];
	survivingPath: string[];
	prunedPaths: string[];
	allEvidence: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Cycle report - one cycle within the double loop
// ---------------------------------------------------------------------------

export interface CycleReport {
	cycleNumber: number;
	phaseReports: Partial<Record<LoopPhase, ExecutionReport>>;
	tasksVerified: string[];
	tasksFalsified: string[];
	tasksDelivered: string[];
	durationMs: number;
	converged: boolean;
}

// ---------------------------------------------------------------------------
// Schedulable / Runnable interfaces (used by core engine)
// ---------------------------------------------------------------------------

export type TaskFn = (ctx: TaskContextInterface) => Promise<unknown>;

export interface TaskContextInterface {
	readonly taskId: string;
	readonly hypothesis: Hypothesis;
	readonly shared: Record<string, unknown>;
	evidence: (key: string, value: unknown) => void;
	falsify: (reason: string) => never;
	checkConstraint: (label: string, violated: boolean, detail?: string) => void;
	run: <T>(fn: (...args: unknown[]) => T | Promise<T>, ...args: unknown[]) => Promise<T>;
	getEvidence: () => Record<string, unknown>;
}

export interface SchedulableTask {
	id: string;
	risk: number;
	dependsOn: string[];
	status: TaskStatus;
}

export interface RunnableTask {
	id: string;
	name: string;
	fn: TaskFn;
	timeoutMs?: number;
	retryCount: number;
}

export interface TaskOpts {
	risk?: number;
	dependsOn?: string[];
	timeoutMs?: number;
	retry?: number;
	name?: string;
}

export interface LoopTaskOpts {
	name: string;
	risk?: number;
	dependsOn?: string[];
	timeoutMs?: number;
	retry?: number;
}
