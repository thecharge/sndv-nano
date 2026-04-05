import { describe, expect, test } from "bun:test";
import { Protocol, summary, type TaskContextInterface } from "../src/index";

describe("Protocol", () => {
	// ===== Happy flows =====

	test("all tasks verified → report status is verified", async () => {
		const p = new Protocol({ goal: "Test", constraints: ["no bugs"] });

		p.addTask(
			async (ctx: TaskContextInterface) => {
				ctx.evidence("result", "ok");
			},
			{ name: "task_a", risk: 0.9 },
		);

		p.addTask(
			async (ctx: TaskContextInterface) => {
				ctx.evidence("result", "ok");
			},
			{ name: "task_b", risk: 0.5, dependsOn: ["task_a"] },
		);

		const report = await p.execute();
		expect(report.status).toBe("verified");
		expect(report.survivingPath).toEqual(["task_a", "task_b"]);
	});

	test("parallel tasks run when no dependencies", async () => {
		const p = new Protocol({ goal: "Parallel test" });
		const order: string[] = [];

		p.addTask(
			async () => {
				order.push("a");
			},
			{ name: "a", risk: 0.9 },
		);
		p.addTask(
			async () => {
				order.push("b");
			},
			{ name: "b", risk: 0.8 },
		);

		const report = await p.execute();
		expect(report.status).toBe("verified");
		expect(order).toContain("a");
		expect(order).toContain("b");
	});

	test("evidence is captured in the report", async () => {
		const p = new Protocol({ goal: "Evidence test" });

		p.addTask(
			async (ctx: TaskContextInterface) => {
				ctx.evidence("metric", 42);
				ctx.evidence("label", "ok");
			},
			{ name: "t1" },
		);

		const report = await p.execute();
		expect(report.allEvidence.metric).toBe(42);
		expect(report.allEvidence.label).toBe("ok");
	});

	// ===== Side flows =====

	test("falsified task prunes downstream tasks", async () => {
		const p = new Protocol({ goal: "Prune test" });

		p.addTask(
			async (ctx: TaskContextInterface) => {
				ctx.falsify("broken");
			},
			{ name: "root", risk: 0.9 },
		);

		p.addTask(async () => {}, { name: "child", risk: 0.5, dependsOn: ["root"] });

		const report = await p.execute();
		expect(report.status).toBe("falsified");
		expect(report.prunedPaths).toContain("root");
		expect(report.prunedPaths).toContain("child");
	});

	test("task with retries recovers from transient error", async () => {
		let attempts = 0;
		const p = new Protocol({ goal: "Retry test" });

		p.addTask(
			async () => {
				attempts++;
				if (attempts < 2) throw new Error("transient");
			},
			{ name: "flaky", risk: 0.5, retry: 2 },
		);

		const report = await p.execute();
		expect(report.status).toBe("verified");
		expect(attempts).toBe(2);
	});

	test("onComplete callback fires for each task", async () => {
		const p = new Protocol({ goal: "Callback test" });
		const completed: string[] = [];

		p.onComplete((r) => completed.push(r.taskName));
		p.addTask(async () => {}, { name: "a" });
		p.addTask(async () => {}, { name: "b" });

		await p.execute();
		expect(completed).toContain("a");
		expect(completed).toContain("b");
	});

	// ===== Critical paths =====

	test("rejects empty protocol", () => {
		const p = new Protocol({ goal: "Empty" });
		expect(p.execute()).rejects.toThrow("No tasks registered");
	});

	test("rejects cyclic dependencies", () => {
		const p = new Protocol({ goal: "Cycle test" });
		p.addTask(async () => {}, { name: "a", risk: 0.5, dependsOn: ["b"] });
		p.addTask(async () => {}, { name: "b", risk: 0.5, dependsOn: ["a"] });
		expect(p.execute()).rejects.toThrow("cycle");
	});

	test("rejects missing dependency", () => {
		const p = new Protocol({ goal: "Missing dep" });
		p.addTask(async () => {}, { name: "a", risk: 0.5, dependsOn: ["nonexistent"] });
		expect(p.execute()).rejects.toThrow("unknown task");
	});

	test("rejects duplicate task name", () => {
		const p = new Protocol({ goal: "Dup test" });
		p.addTask(async () => {}, { name: "a" });
		expect(() => p.addTask(async () => {}, { name: "a" })).toThrow("Duplicate");
	});

	test("rejects invalid risk", () => {
		const p = new Protocol({ goal: "Risk test" });
		expect(() => p.addTask(async () => {}, { name: "a", risk: 1.5 })).toThrow();
	});

	test("rejects empty goal", () => {
		expect(() => new Protocol({ goal: "" })).toThrow();
	});

	test("summary produces readable output", async () => {
		const p = new Protocol({ goal: "Summary test", constraints: ["no bugs"] });
		p.addTask(async (ctx: TaskContextInterface) => ctx.evidence("x", 1), { name: "t1" });

		const report = await p.execute();
		const text = summary(report);
		expect(text).toContain("Summary test");
		expect(text).toContain("VERIFIED");
	});

	test("reset allows re-execution", async () => {
		const p = new Protocol({ goal: "Reset test" });
		p.addTask(async () => {}, { name: "a" });

		await p.execute();
		p.reset();
		const report = await p.execute();
		expect(report.status).toBe("verified");
	});

	test("visualize shows task graph", () => {
		const p = new Protocol({ goal: "Viz test" });
		p.addTask(async () => {}, { name: "root", risk: 0.9 });
		p.addTask(async () => {}, { name: "child", risk: 0.3, dependsOn: ["root"] });

		const viz = p.visualize();
		expect(viz).toContain("root");
		expect(viz).toContain("child");
		expect(viz).toContain("○");
	});
});
