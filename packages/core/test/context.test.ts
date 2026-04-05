import { describe, expect, test } from "bun:test";
import { ConstraintViolation, FalsificationError } from "@thecharge/sndv-config";
import { TaskContext } from "../src/context";

function makeCtx(overrides?: Partial<ConstructorParameters<typeof TaskContext>[0]>) {
	return new TaskContext({
		taskId: "test",
		hypothesis: { goal: "test", constraints: ["no bugs"], metadata: {} },
		shared: {},
		...overrides,
	});
}

describe("TaskContext", () => {
	// ===== Happy flows =====

	test("records evidence", () => {
		const ctx = makeCtx();
		ctx.evidence("key1", "value1");
		ctx.evidence("key2", 42);
		expect(ctx.getEvidence()).toEqual({ key1: "value1", key2: 42 });
	});

	test("run executes sync functions", async () => {
		const ctx = makeCtx();
		const result = await ctx.run(() => 42);
		expect(result).toBe(42);
	});

	test("run executes async functions", async () => {
		const ctx = makeCtx();
		const result = await ctx.run(async () => 42);
		expect(result).toBe(42);
	});

	test("shared state is accessible across tasks", () => {
		const shared: Record<string, unknown> = { x: 1 };
		const ctx = makeCtx({ shared });
		ctx.shared.y = 2;
		expect(shared.y).toBe(2);
	});

	// ===== Side flows =====

	test("checkConstraint passes when not violated", () => {
		const ctx = makeCtx();
		expect(() => ctx.checkConstraint("no bugs", false)).not.toThrow();
	});

	test("getEvidence returns a copy", () => {
		const ctx = makeCtx();
		ctx.evidence("a", 1);
		const ev = ctx.getEvidence();
		ev.b = 2;
		expect(ctx.getEvidence()).not.toHaveProperty("b");
	});

	// ===== Critical paths =====

	test("falsify throws FalsificationError with evidence", () => {
		const ctx = makeCtx();
		ctx.evidence("attempt", 1);

		try {
			ctx.falsify("broken");
			expect(true).toBe(false); // should not reach
		} catch (e) {
			expect(e).toBeInstanceOf(FalsificationError);
			expect((e as FalsificationError).evidence).toEqual({ attempt: 1 });
		}
	});

	test("checkConstraint throws on violation", () => {
		const ctx = makeCtx();
		expect(() => ctx.checkConstraint("no bugs", true, "found a bug")).toThrow(ConstraintViolation);
	});
});
