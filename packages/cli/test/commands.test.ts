import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { protocol } from "../src/commands/protocol";
import { scaffold } from "../src/commands/scaffold";
import { task } from "../src/commands/task";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "sndv-cli-test-"));
	const sndvDir = join(tempDir, ".sndv");
	await mkdir(sndvDir, { recursive: true });
	await mkdir(join(sndvDir, "long-term"), { recursive: true });
	await writeFile(
		join(sndvDir, "config.json"),
		JSON.stringify({ name: "test-project", type: "greenfield" }),
	);
	await writeFile(
		join(sndvDir, "protocol.qmd"),
		`---
goal: "Test goal"
type: greenfield
max_iterations: 10
constraints:
  - "Constraint 1"
---

# Task: existing_task
risk: 0.9

Try to break this.
`,
	);
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

// --- scaffold ---

describe("scaffold", () => {
	test("scaffolds CLAUDE.md for claude target", async () => {
		const output = await scaffold({ projectDir: tempDir, target: "claude" });
		expect(output).toContain("created:");
		const content = await readFile(join(tempDir, "CLAUDE.md"), "utf-8");
		expect(content).toContain("SNDV Protocol");
		expect(content).toContain("sndv status");
	});

	test("scaffolds copilot instructions", async () => {
		const output = await scaffold({ projectDir: tempDir, target: "copilot" });
		expect(output).toContain("created:");
		const content = await readFile(join(tempDir, ".github", "copilot-instructions.md"), "utf-8");
		expect(content).toContain("SNDV Protocol");
	});

	test("scaffolds AGENTS.md for opencode", async () => {
		const output = await scaffold({ projectDir: tempDir, target: "opencode" });
		expect(output).toContain("created:");
		const content = await readFile(join(tempDir, "AGENTS.md"), "utf-8");
		expect(content).toContain("SNDV Protocol");
	});

	test("scaffolds all targets", async () => {
		const output = await scaffold({ projectDir: tempDir, target: "all" });
		expect(output).toContain("CLAUDE.md");
		expect(output).toContain("copilot-instructions.md");
		expect(output).toContain("AGENTS.md");
	});

	test("skips existing files", async () => {
		await writeFile(join(tempDir, "CLAUDE.md"), "existing content");
		const output = await scaffold({ projectDir: tempDir, target: "claude" });
		expect(output).toContain("exists:");
		const content = await readFile(join(tempDir, "CLAUDE.md"), "utf-8");
		expect(content).toBe("existing content");
	});

	test("returns usage for invalid target", async () => {
		const output = await scaffold({ projectDir: tempDir, target: "invalid" });
		expect(output).toContain("Targets:");
	});
});

// --- task ---

describe("task", () => {
	test("lists tasks", async () => {
		const output = await task({ projectDir: tempDir, action: "list" });
		expect(output).toContain("existing_task");
		expect(output).toContain("risk=0.9");
	});

	test("adds a task", async () => {
		const output = await task({
			projectDir: tempDir,
			action: "add",
			name: "new_task",
			risk: "0.7",
			dependsOn: "existing_task",
			description: "Break something new",
		});
		expect(output).toContain('Added task "new_task"');

		const raw = await readFile(join(tempDir, ".sndv", "protocol.qmd"), "utf-8");
		expect(raw).toContain("# Task: new_task");
		expect(raw).toContain("risk: 0.7");
		expect(raw).toContain("depends_on: [existing_task]");
	});

	test("rejects duplicate task name", async () => {
		const output = await task({
			projectDir: tempDir,
			action: "add",
			name: "existing_task",
		});
		expect(output).toContain("already exists");
	});

	test("rejects invalid risk", async () => {
		const output = await task({
			projectDir: tempDir,
			action: "add",
			name: "bad_risk",
			risk: "1.5",
		});
		expect(output).toContain("risk must be between");
	});

	test("removes a task", async () => {
		const output = await task({
			projectDir: tempDir,
			action: "remove",
			name: "existing_task",
		});
		expect(output).toContain('Removed task "existing_task"');

		const raw = await readFile(join(tempDir, ".sndv", "protocol.qmd"), "utf-8");
		expect(raw).not.toContain("# Task: existing_task");
	});

	test("rejects removing nonexistent task", async () => {
		const output = await task({
			projectDir: tempDir,
			action: "remove",
			name: "nope",
		});
		expect(output).toContain("not found");
	});

	test("returns usage for unknown action", async () => {
		const output = await task({ projectDir: tempDir, action: "wat" });
		expect(output).toContain("Actions:");
	});
});

// --- protocol ---

describe("protocol", () => {
	test("lists current protocol", async () => {
		const output = await protocol({ projectDir: tempDir, action: "list" });
		expect(output).toContain("Current: Test goal");
		expect(output).toContain("1 tasks");
	});

	test("archives current protocol", async () => {
		const output = await protocol({
			projectDir: tempDir,
			action: "archive",
			name: "v1",
		});
		expect(output).toContain('Archived current protocol as "v1"');

		const archived = await readFile(join(tempDir, ".sndv", "archive", "v1.qmd"), "utf-8");
		expect(archived).toContain("Test goal");
	});

	test("restores archived protocol", async () => {
		await protocol({ projectDir: tempDir, action: "archive", name: "v1" });
		await writeFile(join(tempDir, ".sndv", "protocol.qmd"), `---\ngoal: "New goal"\n---\n`);

		const output = await protocol({
			projectDir: tempDir,
			action: "restore",
			name: "v1",
		});
		expect(output).toContain('Restored protocol "v1"');

		const current = await readFile(join(tempDir, ".sndv", "protocol.qmd"), "utf-8");
		expect(current).toContain("Test goal");
	});

	test("lists archived protocols", async () => {
		await protocol({ projectDir: tempDir, action: "archive", name: "v1" });
		await writeFile(join(tempDir, ".sndv", "protocol.qmd"), `---\ngoal: "New"\n---\n`);

		const output = await protocol({ projectDir: tempDir, action: "list" });
		expect(output).toContain("v1:");
		expect(output).toContain("Test goal");
	});

	test("rejects restoring nonexistent archive", async () => {
		const output = await protocol({
			projectDir: tempDir,
			action: "restore",
			name: "nope",
		});
		expect(output).toContain("not found");
	});

	test("returns usage for unknown action", async () => {
		const output = await protocol({ projectDir: tempDir, action: "wat" });
		expect(output).toContain("Actions:");
	});
});
