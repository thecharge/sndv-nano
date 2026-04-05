import { beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionContext } from "@thecharge/sndv-config";
import { LongTermMemory } from "../src/long-term";
import { buildPromptFragment } from "../src/prompt";
import { MemoryRepository } from "../src/repository";
import { SessionMemory } from "../src/session";
import { ShortTermMemory } from "../src/short-term";

describe("ShortTermMemory", () => {
	let mem: ShortTermMemory;
	beforeEach(() => {
		mem = new ShortTermMemory(3);
	});

	test("set and get", async () => {
		await mem.set("key", "value");
		expect(await mem.get("key")).toBe("value");
	});

	test("list returns all entries", async () => {
		await mem.set("a", 1);
		await mem.set("b", 2);
		expect(await mem.list()).toHaveLength(2);
	});

	test("returns undefined for missing key", async () => {
		expect(await mem.get("nope")).toBeUndefined();
	});

	test("evicts oldest when full", async () => {
		await mem.set("a", 1);
		await mem.set("b", 2);
		await mem.set("c", 3);
		await mem.set("d", 4);
		expect(await mem.get("a")).toBeUndefined();
		expect(await mem.get("d")).toBe(4);
	});

	test("delete removes entry", async () => {
		await mem.set("key", "val");
		expect(await mem.delete("key")).toBe(true);
		expect(await mem.get("key")).toBeUndefined();
	});

	test("clear removes all", async () => {
		await mem.set("a", 1);
		await mem.set("b", 2);
		await mem.clear();
		expect(mem.size).toBe(0);
	});
});

describe("SessionMemory", () => {
	let dir: string;
	let sessions: SessionMemory;

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), "sndv-session-"));
		sessions = new SessionMemory(dir);
		await sessions.init();
	});

	test("records and loads a run", async () => {
		await sessions.recordRun("test-hyp", {
			goal: "Test goal",
			status: "verified",
			durationMs: 100,
			iterations: 1,
			survivingPath: ["task_a"],
			prunedPaths: [],
			taskResults: [
				{
					taskName: "task_a",
					status: "verified",
					evidence: { result: "ok" },
					durationMs: 50,
				},
			],
		});

		const ctx = await sessions.loadContext("test-hyp");
		expect(ctx.previousRuns).toBe(1);
		expect(ctx.lastRunStatus).toBe("verified");
		expect(ctx.pastDecisions).toHaveLength(1);
		expect(ctx.pastEvidence).toHaveLength(1);
	});

	test("accumulates multiple runs", async () => {
		for (let i = 0; i < 3; i++) {
			await sessions.recordRun("multi", {
				goal: "Multi",
				status: i < 2 ? "falsified" : "verified",
				durationMs: 100,
				iterations: 1,
				survivingPath: [],
				prunedPaths: [],
				taskResults: [
					{
						taskName: `task_${i}`,
						status: i < 2 ? "falsified" : "verified",
						evidence: { attempt: i },
						error: i < 2 ? "failed" : undefined,
						durationMs: 50,
					},
				],
			});
		}

		const ctx = await sessions.loadContext("multi");
		expect(ctx.previousRuns).toBe(3);
		expect(ctx.pastDecisions).toHaveLength(3);
	});

	test("lists hypotheses", async () => {
		await sessions.recordRun("hyp-a", {
			goal: "A",
			status: "verified",
			durationMs: 0,
			iterations: 1,
			survivingPath: [],
			prunedPaths: [],
			taskResults: [],
		});
		await sessions.recordRun("hyp-b", {
			goal: "B",
			status: "falsified",
			durationMs: 0,
			iterations: 1,
			survivingPath: [],
			prunedPaths: [],
			taskResults: [],
		});

		const list = await sessions.listHypotheses();
		expect(list).toHaveLength(2);
		expect(list.map((h) => h.id)).toContain("hyp-a");
	});
});

describe("LongTermMemory", () => {
	let dir: string;
	let lt: LongTermMemory;

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), "sndv-lt-"));
		lt = new LongTermMemory(dir);
		await lt.init();
	});

	test("records and retrieves patterns", async () => {
		await lt.recordPattern({
			id: "test-pat",
			pattern: "Redis always times out under load",
			confidence: 0.8,
			occurrences: 3,
			firstSeen: "2024-01-01",
			lastSeen: "2024-06-01",
			sourceHypotheses: ["hyp-1"],
			tags: ["redis", "timeout"],
		});

		const patterns = await lt.getPatterns();
		expect(patterns).toHaveLength(1);
		expect(patterns[0].pattern).toContain("Redis");
	});

	test("records and retrieves constraints", async () => {
		await lt.recordConstraint("Never deploy on Friday");
		await lt.recordConstraint("Always run migrations first");

		const constraints = await lt.getConstraints();
		expect(constraints).toHaveLength(2);
		expect(constraints[0]).toContain("Friday");
	});

	test("deduplicates constraints", async () => {
		await lt.recordConstraint("Same thing");
		await lt.recordConstraint("Same thing");

		const constraints = await lt.getConstraints();
		expect(constraints).toHaveLength(1);
	});

	test("updates existing pattern", async () => {
		const base = {
			id: "p1",
			pattern: "fails",
			confidence: 0.5,
			occurrences: 1,
			firstSeen: "2024-01-01",
			lastSeen: "2024-01-01",
			sourceHypotheses: ["a"],
			tags: [],
		};
		await lt.recordPattern(base);
		await lt.recordPattern({ ...base, confidence: 0.9, occurrences: 5 });

		const patterns = await lt.getPatterns();
		expect(patterns).toHaveLength(1);
		expect(patterns[0].confidence).toBe(0.9);
	});
});

describe("MemoryRepository", () => {
	let dir: string;

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), "sndv-repo-"));
	});

	test("init creates directories", async () => {
		const repo = new MemoryRepository({ root: dir });
		await repo.init();

		// Should not throw
		const ctx = await repo.loadContext("nonexistent");
		expect(ctx.previousRuns).toBe(0);
	});

	test("exportForLlm returns prompt text", async () => {
		const repo = new MemoryRepository({ root: dir });
		await repo.init();

		await repo.sessions.recordRun("export-test", {
			goal: "Export test",
			status: "falsified",
			durationMs: 100,
			iterations: 1,
			survivingPath: [],
			prunedPaths: ["bad_task"],
			taskResults: [
				{
					taskName: "bad_task",
					status: "falsified",
					evidence: { reason: "timeout" },
					error: "Connection timed out",
					durationMs: 50,
				},
			],
		});

		const fragment = await repo.exportForLlm("export-test");
		expect(fragment).toContain("export-test");
		expect(fragment).toContain("bad_task");
		expect(fragment).toContain("DO NOT retry");
	});
});

describe("buildPromptFragment", () => {
	test("generates context for LLM with all sections", () => {
		const ctx: SessionContext = {
			hypothesisId: "auth-v2",
			previousRuns: 2,
			lastRunStatus: "falsified",
			pastDecisions: [
				{
					task: "check_api",
					action: "falsified",
					reason: "API broke",
					evidence: {},
					timestamp: "2024-01-01",
					runId: "r1",
				},
				{
					task: "check_db",
					action: "verified",
					reason: "ok",
					evidence: {},
					timestamp: "2024-01-01",
					runId: "r1",
				},
			],
			pastEvidence: [
				{
					key: "latency",
					value: 500,
					task: "check_api",
					hypothesisId: "auth-v2",
					timestamp: "2024-01-01",
					runId: "r1",
					status: "falsified",
				},
			],
			relevantPatterns: [
				{
					id: "p1",
					pattern: "APIs break under load",
					confidence: 0.8,
					occurrences: 3,
					firstSeen: "2024-01-01",
					lastSeen: "2024-06-01",
					sourceHypotheses: [],
					tags: [],
				},
			],
			constraintsLearned: ["Always rate-limit API calls"],
		};

		const fragment = buildPromptFragment(ctx);
		expect(fragment).toContain("auth-v2");
		expect(fragment).toContain("2 time(s)");
		expect(fragment).toContain("Failed approaches");
		expect(fragment).toContain("API broke");
		expect(fragment).toContain("Previously verified");
		expect(fragment).toContain("Key evidence");
		expect(fragment).toContain("Institutional patterns");
		expect(fragment).toContain("Always rate-limit");
	});

	test("handles empty context", () => {
		const ctx: SessionContext = {
			hypothesisId: "empty",
			previousRuns: 0,
			lastRunStatus: null,
			pastDecisions: [],
			pastEvidence: [],
			relevantPatterns: [],
			constraintsLearned: [],
		};
		expect(buildPromptFragment(ctx)).toBe("No prior context for this hypothesis.");
	});
});
