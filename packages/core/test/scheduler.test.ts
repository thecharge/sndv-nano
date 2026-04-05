import { describe, expect, test } from "bun:test";
import type { SchedulableTask } from "@thecharge/sndv-config";
import { CycleDetectedError, ProtocolError } from "@thecharge/sndv-config";
import { propagatePruning, readyTasks, validateGraph } from "../src/scheduler";

function makeTasks(
	defs: { id: string; risk: number; dependsOn?: string[]; status?: string }[],
): Map<string, SchedulableTask> {
	return new Map(
		defs.map((d) => [
			d.id,
			{
				id: d.id,
				risk: d.risk,
				dependsOn: d.dependsOn ?? [],
				status: (d.status ?? "pending") as SchedulableTask["status"],
			},
		]),
	);
}

describe("validateGraph", () => {
	test("accepts clean DAG", () => {
		const tasks = makeTasks([
			{ id: "a", risk: 0.9 },
			{ id: "b", risk: 0.5, dependsOn: ["a"] },
		]);
		expect(() => validateGraph(tasks)).not.toThrow();
	});

	test("detects missing dependency", () => {
		const tasks = makeTasks([{ id: "a", risk: 0.5, dependsOn: ["missing"] }]);
		expect(() => validateGraph(tasks)).toThrow(ProtocolError);
	});

	test("detects simple cycle", () => {
		const tasks = makeTasks([
			{ id: "a", risk: 0.5, dependsOn: ["b"] },
			{ id: "b", risk: 0.5, dependsOn: ["a"] },
		]);
		expect(() => validateGraph(tasks)).toThrow(CycleDetectedError);
	});

	test("detects transitive cycle", () => {
		const tasks = makeTasks([
			{ id: "a", risk: 0.5, dependsOn: ["c"] },
			{ id: "b", risk: 0.5, dependsOn: ["a"] },
			{ id: "c", risk: 0.5, dependsOn: ["b"] },
		]);
		expect(() => validateGraph(tasks)).toThrow(CycleDetectedError);
	});
});

describe("readyTasks", () => {
	test("returns tasks with met dependencies", () => {
		const tasks = makeTasks([
			{ id: "a", risk: 0.9, status: "verified" },
			{ id: "b", risk: 0.8 },
			{ id: "c", risk: 0.5, dependsOn: ["a"] },
			{ id: "d", risk: 0.3, dependsOn: ["b"] },
		]);
		expect(readyTasks(tasks)).toEqual(["b", "c"]);
	});

	test("sorts by risk descending", () => {
		const tasks = makeTasks([
			{ id: "low", risk: 0.1 },
			{ id: "high", risk: 0.9 },
			{ id: "mid", risk: 0.5 },
		]);
		expect(readyTasks(tasks)).toEqual(["high", "mid", "low"]);
	});

	test("returns empty when nothing is ready", () => {
		const tasks = makeTasks([
			{ id: "a", risk: 0.5, dependsOn: ["b"] },
			{ id: "b", risk: 0.5, dependsOn: ["a"] },
		]);
		// Both have unmet deps, nothing is ready
		expect(readyTasks(tasks)).toEqual([]);
	});
});

describe("propagatePruning", () => {
	test("skips downstream of falsified", () => {
		const tasks = makeTasks([
			{ id: "a", risk: 0.9, status: "falsified" },
			{ id: "b", risk: 0.5, dependsOn: ["a"] },
		]);
		const pruned = propagatePruning(tasks);
		expect(pruned).toContain("b");
		expect(tasks.get("b")?.status).toBe("skipped");
	});

	test("cascading prune: skips grandchildren", () => {
		const tasks = makeTasks([
			{ id: "a", risk: 0.9, status: "falsified" },
			{ id: "b", risk: 0.5, dependsOn: ["a"] },
			{ id: "c", risk: 0.3, dependsOn: ["b"] },
		]);
		propagatePruning(tasks);
		expect(tasks.get("b")?.status).toBe("skipped");
		expect(tasks.get("c")?.status).toBe("skipped");
	});

	test("does not prune independent branches", () => {
		const tasks = makeTasks([
			{ id: "a", risk: 0.9, status: "falsified" },
			{ id: "b", risk: 0.8 },
			{ id: "c", risk: 0.5, dependsOn: ["a"] },
		]);
		propagatePruning(tasks);
		expect(tasks.get("b")?.status).toBe("pending");
		expect(tasks.get("c")?.status).toBe("skipped");
	});
});
