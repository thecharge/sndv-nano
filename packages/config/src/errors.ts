/**
 * SMEP Error Hierarchy — all errors originate from factories, never raw `throw new`.
 *
 * Usage:
 *   throw SmepErrors.protocolEmpty()
 *   throw SmepErrors.duplicateTask("my_task")
 *   throw SmepErrors.falsification("Latency too high", { p99_ms: 120 })
 */

// ---------------------------------------------------------------------------
// Error classes (internal — consumers use factories below)
// ---------------------------------------------------------------------------

class ProtocolError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ProtocolError";
	}
}

class FalsificationError extends ProtocolError {
	readonly evidence: Record<string, unknown>;

	constructor(reason: string, evidence: Record<string, unknown> = {}) {
		super(reason);
		this.name = "FalsificationError";
		this.evidence = evidence;
	}
}

class ConstraintViolation extends ProtocolError {
	readonly constraint: string;
	readonly detail: string;

	constructor(constraint: string, detail = "") {
		super(`Constraint violated: ${constraint}. ${detail}`);
		this.name = "ConstraintViolation";
		this.constraint = constraint;
		this.detail = detail;
	}
}

class CycleDetectedError extends ProtocolError {
	constructor(message = "Dependency graph contains a cycle") {
		super(message);
		this.name = "CycleDetectedError";
	}
}

class TimeoutExceededError extends ProtocolError {
	readonly durationMs: number;
	readonly limitMs: number;

	constructor(durationMs: number, limitMs: number) {
		super(`Timeout exceeded: ${durationMs.toFixed(0)}ms > ${limitMs}ms`);
		this.name = "TimeoutExceededError";
		this.durationMs = durationMs;
		this.limitMs = limitMs;
	}
}

class LlmRequestError extends Error {
	readonly httpStatusCode: number;
	readonly responseBody: string;

	constructor(httpStatusCode: number, responseBody: string) {
		super(`LLM request failed (HTTP ${httpStatusCode}): ${responseBody}`);
		this.name = "LlmRequestError";
		this.httpStatusCode = httpStatusCode;
		this.responseBody = responseBody;
	}
}

class LlmResponseParseError extends Error {
	readonly rawResponse: string;

	constructor(rawResponse: string) {
		super("Failed to parse LLM response as valid JSON verdict");
		this.name = "LlmResponseParseError";
		this.rawResponse = rawResponse;
	}
}

class CliError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CliError";
	}
}

// ---------------------------------------------------------------------------
// Type guards (used for catch blocks)
// ---------------------------------------------------------------------------

export const isProtocolError = (error: unknown): error is ProtocolError =>
	error instanceof ProtocolError;

export const isFalsificationError = (error: unknown): error is FalsificationError =>
	error instanceof FalsificationError;

export const isConstraintViolation = (error: unknown): error is ConstraintViolation =>
	error instanceof ConstraintViolation;

export const isCycleDetectedError = (error: unknown): error is CycleDetectedError =>
	error instanceof CycleDetectedError;

export const isTimeoutExceededError = (error: unknown): error is TimeoutExceededError =>
	error instanceof TimeoutExceededError;

export const isLlmRequestError = (error: unknown): error is LlmRequestError =>
	error instanceof LlmRequestError;

export const isLlmResponseParseError = (error: unknown): error is LlmResponseParseError =>
	error instanceof LlmResponseParseError;

// ---------------------------------------------------------------------------
// Error factories — the only way to create errors in SMEP
// ---------------------------------------------------------------------------

export const SmepErrors = {
	/** Protocol has no registered tasks. */
	protocolEmpty: () => new ProtocolError("No tasks registered"),

	/** Goal string is missing or blank. */
	emptyGoal: () => new ProtocolError("Goal cannot be empty"),

	/** Two tasks share the same name. */
	duplicateTask: (taskName: string) => new ProtocolError(`Duplicate task name: ${taskName}`),

	/** Task was registered without a name. */
	unnamedTask: () => new ProtocolError("Task must have a name"),

	/** Task references a dependency that does not exist. */
	missingDependency: (taskName: string, dependencyName: string) =>
		new ProtocolError(`Task '${taskName}' depends on unknown task '${dependencyName}'`),

	/** Dependency graph has a cycle (detected via Kahn's algorithm). */
	cycleDetected: () => new CycleDetectedError(),

	/** A task determined its assumption is broken. */
	falsification: (reason: string, evidence: Record<string, unknown> = {}) =>
		new FalsificationError(reason, evidence),

	/** A constraint was explicitly violated. */
	constraintViolation: (constraint: string, detail = "") =>
		new ConstraintViolation(constraint, detail),

	/** Global or per-task timeout exceeded. */
	timeoutExceeded: (durationMs: number, limitMs: number) =>
		new TimeoutExceededError(durationMs, limitMs),

	/** Task execution threw an unexpected error. */
	taskFailed: (taskName: string, originalError: unknown) => {
		const message =
			originalError instanceof Error
				? `${originalError.name}: ${originalError.message}`
				: String(originalError);
		return new ProtocolError(`Task '${taskName}' failed: ${message}`);
	},

	/** LLM HTTP request failed. */
	llmRequestFailed: (httpStatusCode: number, responseBody: string) =>
		new LlmRequestError(httpStatusCode, responseBody),

	/** LLM response could not be parsed as JSON verdict. */
	llmResponseParseFailed: (rawResponse: string) => new LlmResponseParseError(rawResponse),

	/** Global timeout string for marking remaining tasks. */
	globalTimeoutMessage: () => "Global timeout exceeded",

	/** Skipped task message for pruned downstream. */
	skippedDueToUpstream: () => "Skipped: upstream dependency failed",
} as const;

export const CliErrors = {
	invalidCompletionFormat: (format: string) => new CliError(`Invalid completion format: ${format}`),
	invalidTaskName: (maxLength: number) =>
		new CliError(`Task name must be lowercase letters, numbers, or underscores (1-${maxLength}).`),
	invalidRisk: () => new CliError("Task risk must be between 0 and 1."),
	missingProtocol: () => new CliError("Error: protocol.qmd not found. Run `sndv init` first."),
	duplicateTask: (taskName: string) => new CliError(`Task already exists: ${taskName}`),
	unknownTask: (taskName: string) => new CliError(`Task not found: ${taskName}`),
	invalidArchiveName: () =>
		new CliError("Archive name must contain only letters, numbers, dashes, or underscores."),
	archiveExists: (archiveName: string) => new CliError(`Archive already exists: ${archiveName}`),
	archiveMissing: (archiveName: string) => new CliError(`Archive not found: ${archiveName}`),
	linkTargetMissing: (targetPath: string) => new CliError(`Target binary missing: ${targetPath}`),
	linkDirCreateFailed: (dirPath: string) => new CliError(`Failed to create directory: ${dirPath}`),
	linkFailed: (linkPath: string) => new CliError(`Failed to create symlink at ${linkPath}`),
} as const;

// Re-export classes for instanceof checks in catch blocks
export {
	ConstraintViolation,
	CycleDetectedError,
	FalsificationError,
	LlmRequestError,
	LlmResponseParseError,
	ProtocolError,
	TimeoutExceededError,
};
