import { describe, expect, test } from "bun:test";
import {
	ChatRole,
	DecisionAction,
	HypothesisSchema,
	isFalsificationError,
	isProtocolError,
	KNOWN_PATTERN_TAGS,
	LOOP_PHASE_ORDER,
	LoopOutcome,
	LoopPhase,
	ProjectType,
	ProtocolOutcome,
	REPORT_SEPARATOR,
	RiskSchema,
	SmepErrors,
	STATUS_ICONS,
	TaskIdSchema,
	TaskStatus,
	TERMINAL_STATUSES,
	VerdictStatus,
} from "../src/index";

describe("Enums", () => {
	test("TaskStatus has all expected values", () => {
		expect(TaskStatus.PENDING).toBe("pending");
		expect(TaskStatus.RUNNING).toBe("running");
		expect(TaskStatus.VERIFIED).toBe("verified");
		expect(TaskStatus.FALSIFIED).toBe("falsified");
		expect(TaskStatus.ERRORED).toBe("errored");
		expect(TaskStatus.SKIPPED).toBe("skipped");
		expect(TaskStatus.TIMED_OUT).toBe("timed_out");
	});

	test("TERMINAL_STATUSES contains non-recoverable states", () => {
		expect(TERMINAL_STATUSES.has(TaskStatus.FALSIFIED)).toBe(true);
		expect(TERMINAL_STATUSES.has(TaskStatus.ERRORED)).toBe(true);
		expect(TERMINAL_STATUSES.has(TaskStatus.SKIPPED)).toBe(true);
		expect(TERMINAL_STATUSES.has(TaskStatus.TIMED_OUT)).toBe(true);
		expect(TERMINAL_STATUSES.has(TaskStatus.VERIFIED)).toBe(false);
		expect(TERMINAL_STATUSES.has(TaskStatus.PENDING)).toBe(false);
	});

	test("LoopPhase has 3 phases in correct order", () => {
		expect(LOOP_PHASE_ORDER).toEqual([LoopPhase.FALSIFY, LoopPhase.DELIVER, LoopPhase.VERIFY]);
	});

	test("ProtocolOutcome covers all terminal states", () => {
		expect(ProtocolOutcome.VERIFIED).toBe("verified");
		expect(ProtocolOutcome.FALSIFIED).toBe("falsified");
		expect(ProtocolOutcome.ERRORED).toBe("errored");
	});

	test("LoopOutcome includes in_progress", () => {
		expect(LoopOutcome.IN_PROGRESS).toBe("in_progress");
	});

	test("ProjectType has greenfield and brownfield", () => {
		expect(ProjectType.GREENFIELD).toBe("greenfield");
		expect(ProjectType.BROWNFIELD).toBe("brownfield");
	});

	test("ChatRole has system, user, assistant", () => {
		expect(ChatRole.SYSTEM).toBe("system");
		expect(ChatRole.USER).toBe("user");
		expect(ChatRole.ASSISTANT).toBe("assistant");
	});

	test("VerdictStatus has verified and falsified", () => {
		expect(VerdictStatus.VERIFIED).toBe("verified");
		expect(VerdictStatus.FALSIFIED).toBe("falsified");
	});

	test("DecisionAction covers all task outcomes", () => {
		expect(DecisionAction.VERIFIED).toBe("verified");
		expect(DecisionAction.FALSIFIED).toBe("falsified");
		expect(DecisionAction.ERRORED).toBe("errored");
		expect(DecisionAction.TIMED_OUT).toBe("timed_out");
		expect(DecisionAction.SKIPPED).toBe("skipped");
	});
});

describe("Branded types", () => {
	test("RiskSchema accepts valid 0-1 range", () => {
		expect(() => RiskSchema.parse(0)).not.toThrow();
		expect(() => RiskSchema.parse(0.5)).not.toThrow();
		expect(() => RiskSchema.parse(1)).not.toThrow();
	});

	test("RiskSchema rejects out of range", () => {
		expect(() => RiskSchema.parse(-0.1)).toThrow();
		expect(() => RiskSchema.parse(1.1)).toThrow();
	});

	test("TaskIdSchema accepts valid identifiers", () => {
		expect(() => TaskIdSchema.parse("verify_api")).not.toThrow();
	});

	test("TaskIdSchema rejects empty string", () => {
		expect(() => TaskIdSchema.parse("")).toThrow();
	});
});

describe("HypothesisSchema", () => {
	test("parses valid hypothesis with defaults", () => {
		const result = HypothesisSchema.parse({ goal: "Ship it" });
		expect(result.goal).toBe("Ship it");
		expect(result.constraints).toEqual([]);
		expect(result.metadata).toEqual({});
	});

	test("rejects empty goal", () => {
		expect(() => HypothesisSchema.parse({ goal: "" })).toThrow();
	});
});

describe("SmepErrors factories", () => {
	test("protocolEmpty creates ProtocolError", () => {
		const error = SmepErrors.protocolEmpty();
		expect(isProtocolError(error)).toBe(true);
		expect(error.message).toContain("No tasks");
	});

	test("duplicateTask includes task name", () => {
		const error = SmepErrors.duplicateTask("my_task");
		expect(error.message).toContain("my_task");
	});

	test("falsification carries evidence", () => {
		const error = SmepErrors.falsification("too slow", { latency_ms: 500 });
		expect(isFalsificationError(error)).toBe(true);
		expect(error.evidence).toEqual({ latency_ms: 500 });
	});

	test("constraintViolation carries constraint and detail", () => {
		const error = SmepErrors.constraintViolation("no downtime", "3 seconds of outage");
		expect(error.constraint).toBe("no downtime");
		expect(error.detail).toBe("3 seconds of outage");
	});

	test("timeoutExceeded carries duration and limit", () => {
		const error = SmepErrors.timeoutExceeded(5000, 3000);
		expect(error.durationMs).toBe(5000);
		expect(error.limitMs).toBe(3000);
	});

	test("llmRequestFailed carries HTTP status and body", () => {
		const error = SmepErrors.llmRequestFailed(429, "rate limited");
		expect(error.httpStatusCode).toBe(429);
		expect(error.responseBody).toBe("rate limited");
	});

	test("llmResponseParseFailed carries raw response", () => {
		const error = SmepErrors.llmResponseParseFailed("not json");
		expect(error.rawResponse).toBe("not json");
	});
});

describe("Constants", () => {
	test("REPORT_SEPARATOR is 60 chars", () => {
		expect(REPORT_SEPARATOR.length).toBe(60);
	});

	test("STATUS_ICONS has all task statuses", () => {
		expect(STATUS_ICONS.verified).toBe("✓");
		expect(STATUS_ICONS.falsified).toBe("✗");
		expect(STATUS_ICONS.pending).toBe("○");
	});

	test("KNOWN_PATTERN_TAGS is non-empty array", () => {
		expect(KNOWN_PATTERN_TAGS.length).toBeGreaterThan(10);
		expect(KNOWN_PATTERN_TAGS).toContain("latency");
		expect(KNOWN_PATTERN_TAGS).toContain("timeout");
	});
});
