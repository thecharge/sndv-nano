import { describe, expect, test } from "bun:test";
import { LlmClient } from "../src/base";
import { OpencodeAdapter } from "../src/opencode";
import { buildSystemPrompt } from "../src/prompt";

const tasks = [
	{ name: "verify_api", risk: 0.9, dependsOn: [] as string[] },
	{ name: "run_tests", risk: 0.5, dependsOn: ["verify_api"] },
];

describe("buildSystemPrompt", () => {
	test("includes goal, constraints, and tasks", () => {
		const prompt = buildSystemPrompt({
			goal: "Ship it",
			constraints: ["No downtime"],
			tasks,
		});
		expect(prompt).toContain("Ship it");
		expect(prompt).toContain("No downtime");
		expect(prompt).toContain("verify_api");
		expect(prompt).toContain("run_tests");
	});

	test("handles empty constraints", () => {
		const prompt = buildSystemPrompt({
			goal: "Test",
			constraints: [],
			tasks: [],
		});
		expect(prompt).toContain("(none)");
	});
});

describe("LlmClient", () => {
	test("constructor reads env vars", () => {
		const client = new LlmClient({ apiKey: "test-key", model: "gpt-4" });
		// Just verify it doesn't throw
		expect(client).toBeDefined();
	});

	test("constructor defaults work without env", () => {
		const client = new LlmClient({});
		expect(client).toBeDefined();
	});
});

describe("OpencodeAdapter", () => {
	const adapter = new OpencodeAdapter();

	test("generates instruction block with opencode guidance", () => {
		const instruction = adapter.toInstruction("Ship it", ["No downtime"], tasks);
		expect(instruction).toContain("SMEP Protocol Context");
		expect(instruction).toContain("opencode");
		expect(instruction).toContain("Ship it");
	});

	test("generates valid JSON config file", () => {
		const file = adapter.toConfigFile("Ship it", ["No downtime"], tasks);
		const parsed = JSON.parse(file);
		expect(parsed.instructions).toContain("Ship it");
		expect(parsed.tools).toContain("bash");
	});
});
