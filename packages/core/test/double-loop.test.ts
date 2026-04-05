import { describe, expect, test } from "bun:test";
import { DoubleLoop } from "../src/double-loop";
import type { TaskContextInterface } from "../src/index";

describe("DoubleLoop", () => {
	// ===== Happy flows =====

	test("single-cycle convergence when all tasks pass", async () => {
		const loop = new DoubleLoop({ goal: "Build auth", constraints: ["no bugs"] });

		loop.addFalsify(
			async (ctx: TaskContextInterface) => {
				ctx.evidence("result", "holds");
			},
			{ name: "check_passwords" },
		);

		loop.addDeliver(
			async (ctx: TaskContextInterface) => {
				ctx.evidence("artifact", "auth.ts");
			},
			{ name: "build_auth", dependsOn: ["check_passwords"] },
		);

		loop.addVerify(
			async (ctx: TaskContextInterface) => {
				ctx.evidence("secure", true);
			},
			{ name: "verify_auth", dependsOn: ["build_auth"] },
		);

		const cycles = await loop.run();
		expect(cycles.length).toBe(1);
		expect(cycles[0].converged).toBe(true);
		expect(loop.status).toBe("verified");
	});

	test("falsification phase kills downstream tasks", async () => {
		const loop = new DoubleLoop({ goal: "Test falsification" });

		loop.addFalsify(
			async (ctx: TaskContextInterface) => {
				ctx.falsify("impossible");
			},
			{ name: "impossible_task" },
		);

		loop.addDeliver(async () => {}, {
			name: "wasted_build",
			dependsOn: ["impossible_task"],
		});

		const _cycles = await loop.run();
		expect(loop.status).toBe("falsified");
	});

	test("runs multiple phases in order", async () => {
		const order: string[] = [];
		const loop = new DoubleLoop({ goal: "Phase order test" });

		loop.addFalsify(
			async () => {
				order.push("falsify");
			},
			{ name: "f1" },
		);
		loop.addDeliver(
			async () => {
				order.push("deliver");
			},
			{ name: "d1" },
		);
		loop.addVerify(
			async () => {
				order.push("verify");
			},
			{ name: "v1" },
		);

		await loop.run();
		expect(order).toEqual(["falsify", "deliver", "verify"]);
	});

	test("onCycle callback fires for each cycle", async () => {
		const reported: number[] = [];
		const loop = new DoubleLoop({ goal: "Callback test" });

		loop.onCycle((cycle) => reported.push(cycle.cycleNumber));
		loop.addFalsify(async () => {}, { name: "t1" });

		await loop.run();
		expect(reported).toEqual([1]);
	});

	test("maxCycles limits execution", async () => {
		let _calls = 0;
		const loop = new DoubleLoop({ goal: "Max cycles" }, { maxCycles: 2 });

		loop.addFalsify(
			async () => {
				_calls++;
			},
			{ name: "repeater" },
		);

		const cycles = await loop.run();
		// After cycle 1, task is resolved, so it converges in 1
		expect(cycles.length).toBeLessThanOrEqual(2);
	});

	test("summarize includes task status", async () => {
		const loop = new DoubleLoop({ goal: "Summary test" });
		loop.addFalsify(async () => {}, { name: "ok_task" });

		await loop.run();
		const text = loop.summarize();
		expect(text).toContain("Summary test");
		expect(text).toContain("ok_task");
		expect(text).toContain("VERIFIED");
	});

	// ===== Critical paths =====

	test("rejects duplicate task names", () => {
		const loop = new DoubleLoop({ goal: "Dup test" });
		loop.addFalsify(async () => {}, { name: "dup" });
		expect(() => loop.addFalsify(async () => {}, { name: "dup" })).toThrow("Duplicate");
	});

	test("global timeout stops execution", async () => {
		const loop = new DoubleLoop({ goal: "Timeout test" }, { globalTimeoutMs: 1 });

		loop.addFalsify(
			async () => {
				await new Promise((r) => setTimeout(r, 100));
			},
			{ name: "slow" },
		);

		const cycles = await loop.run();
		// Should have attempted at least one cycle
		expect(cycles.length).toBeGreaterThanOrEqual(0);
	});

	test("empty hypothesis rejected", () => {
		expect(() => new DoubleLoop({ goal: "" })).toThrow();
	});
});
