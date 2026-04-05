import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	buildCompletionUsage,
	buildProtocolUsage,
	buildScaffoldUsage,
	buildTaskUsage,
	CliCompletionFormat,
	CliErrors,
	CliProtocolAction,
	CliScaffoldTarget,
	CliTaskAction,
} from "@thecharge/sndv-config";
import { CompletionCommand } from "../src/commands/completion";
import { ProtocolCommand } from "../src/commands/protocol";
import { ScaffoldCommand } from "../src/commands/scaffold";
import { TaskCommand } from "../src/commands/task";

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
	const scaffoldCases = [
		{
			name: "scaffolds CLAUDE.md for claude target",
			target: CliScaffoldTarget.CLAUDE,
			relativePath: "CLAUDE.md",
			expects: ["SNDV Protocol", "sndv status"],
		},
		{
			name: "scaffolds copilot instructions",
			target: CliScaffoldTarget.COPILOT,
			relativePath: join(".github", "copilot-instructions.md"),
			expects: ["SNDV Protocol"],
		},
		{
			name: "scaffolds AGENTS.md for opencode",
			target: CliScaffoldTarget.OPENCODE,
			relativePath: "AGENTS.md",
			expects: ["SNDV Protocol"],
		},
	];

	for (const testCase of scaffoldCases) {
		test(testCase.name, async () => {
			const output = await new ScaffoldCommand({
				projectDir: tempDir,
				target: testCase.target,
			}).execute();
			expect(output).toContain("created:");
			const content = await readFile(join(tempDir, testCase.relativePath), "utf-8");
			for (const expected of testCase.expects) {
				expect(content).toContain(expected);
			}
		});
	}

	const allCase = {
		name: "scaffolds all targets",
		target: CliScaffoldTarget.ALL,
		expects: ["CLAUDE.md", "copilot-instructions.md", "AGENTS.md"],
	};

	test(allCase.name, async () => {
		const output = await new ScaffoldCommand({
			projectDir: tempDir,
			target: allCase.target,
		}).execute();
		for (const expected of allCase.expects) {
			expect(output).toContain(expected);
		}
	});

	const overwriteCases = [
		{
			name: "skips existing files",
			force: false,
			expectedOutput: "exists:",
			expectedContent: "existing content",
		},
		{
			name: "overwrites existing files with force",
			force: true,
			expectedOutput: "overwritten:",
			expectedContent: "SNDV Protocol",
		},
	];

	for (const testCase of overwriteCases) {
		test(testCase.name, async () => {
			await writeFile(join(tempDir, "CLAUDE.md"), "existing content");
			const output = await new ScaffoldCommand({
				projectDir: tempDir,
				target: CliScaffoldTarget.CLAUDE,
				force: testCase.force,
			}).execute();
			expect(output).toContain(testCase.expectedOutput);
			const content = await readFile(join(tempDir, "CLAUDE.md"), "utf-8");
			expect(content).toContain(testCase.expectedContent);
		});
	}

	test("returns usage for invalid target", async () => {
		const output = await new ScaffoldCommand({
			projectDir: tempDir,
			target: "invalid" as CliScaffoldTarget,
		}).execute();
		expect(output).toBe(buildScaffoldUsage());
	});
});

// --- task ---

describe("task", () => {
	const taskCases = [
		{
			name: "lists tasks",
			opts: { action: CliTaskAction.LIST },
			assert: (output: string) => {
				expect(output).toContain("existing_task");
				expect(output).toContain("risk=0.9");
			},
		},
		{
			name: "adds a task",
			opts: {
				action: CliTaskAction.ADD,
				name: "new_task",
				risk: "0.7",
				dependsOn: "existing_task",
				description: "Break something new",
			},
			assert: async (output: string) => {
				expect(output).toContain('Added task "new_task"');
				const raw = await readFile(join(tempDir, ".sndv", "protocol.qmd"), "utf-8");
				expect(raw).toContain("# Task: new_task");
				expect(raw).toContain("risk: 0.7");
				expect(raw).toContain("depends_on: [existing_task]");
			},
		},
		{
			name: "rejects duplicate task name",
			opts: { action: CliTaskAction.ADD, name: "existing_task" },
			assert: (output: string) => {
				expect(output).toBe(CliErrors.duplicateTask("existing_task").message);
			},
		},
		{
			name: "rejects invalid risk",
			opts: { action: CliTaskAction.ADD, name: "bad_risk", risk: "1.5" },
			assert: (output: string) => {
				expect(output).toBe(CliErrors.invalidRisk().message);
			},
		},
		{
			name: "removes a task",
			opts: { action: CliTaskAction.REMOVE, name: "existing_task" },
			assert: async (output: string) => {
				expect(output).toContain('Removed task "existing_task"');
				const raw = await readFile(join(tempDir, ".sndv", "protocol.qmd"), "utf-8");
				expect(raw).not.toContain("# Task: existing_task");
			},
		},
		{
			name: "rejects removing nonexistent task",
			opts: { action: CliTaskAction.REMOVE, name: "nope" },
			assert: (output: string) => {
				expect(output).toBe(CliErrors.unknownTask("nope").message);
			},
		},
		{
			name: "returns usage for unknown action",
			opts: { action: "wat" as CliTaskAction },
			assert: (output: string) => {
				expect(output).toBe(buildTaskUsage());
			},
		},
	];

	for (const testCase of taskCases) {
		test(testCase.name, async () => {
			const output = await new TaskCommand({
				projectDir: tempDir,
				...testCase.opts,
			}).execute();
			await testCase.assert(output);
		});
	}
});

// --- protocol ---

describe("protocol", () => {
	const protocolCases = [
		{
			name: "lists current protocol",
			opts: { action: CliProtocolAction.LIST },
			assert: (output: string) => {
				expect(output).toContain("Current: Test goal");
				expect(output).toContain("1 tasks");
			},
		},
		{
			name: "archives current protocol",
			opts: { action: CliProtocolAction.ARCHIVE, name: "v1" },
			assert: async (output: string) => {
				expect(output).toContain('Archived current protocol as "v1"');
				const archived = await readFile(join(tempDir, ".sndv", "archive", "v1.qmd"), "utf-8");
				expect(archived).toContain("Test goal");
			},
		},
		{
			name: "restores archived protocol",
			opts: { action: CliProtocolAction.RESTORE, name: "v1" },
			prepare: async () => {
				await new ProtocolCommand({
					projectDir: tempDir,
					action: CliProtocolAction.ARCHIVE,
					name: "v1",
				}).execute();
				await writeFile(join(tempDir, ".sndv", "protocol.qmd"), `---\ngoal: "New goal"\n---\n`);
			},
			assert: async (output: string) => {
				expect(output).toContain('Restored protocol "v1" as current');
				const current = await readFile(join(tempDir, ".sndv", "protocol.qmd"), "utf-8");
				expect(current).toContain("Test goal");
			},
		},
		{
			name: "lists archived protocols",
			opts: { action: CliProtocolAction.LIST },
			prepare: async () => {
				await new ProtocolCommand({
					projectDir: tempDir,
					action: CliProtocolAction.ARCHIVE,
					name: "v1",
				}).execute();
				await writeFile(join(tempDir, ".sndv", "protocol.qmd"), `---\ngoal: "New"\n---\n`);
			},
			assert: (output: string) => {
				expect(output).toContain("v1:");
				expect(output).toContain("Test goal");
			},
		},
		{
			name: "rejects restoring nonexistent archive",
			opts: { action: CliProtocolAction.RESTORE, name: "nope" },
			assert: (output: string) => {
				expect(output).toBe(CliErrors.archiveMissing("nope").message);
			},
		},
		{
			name: "returns usage for unknown action",
			opts: { action: "wat" as CliProtocolAction },
			assert: (output: string) => {
				expect(output).toBe(buildProtocolUsage());
			},
		},
	];

	for (const testCase of protocolCases) {
		test(testCase.name, async () => {
			if (testCase.prepare) await testCase.prepare();
			const output = await new ProtocolCommand({
				projectDir: tempDir,
				...testCase.opts,
			}).execute();
			await testCase.assert(output);
		});
	}
});

// --- completion ---

describe("completion", () => {
	const completionCases = [
		{
			name: "renders bash completion",
			format: CliCompletionFormat.BASH,
			expects: "_sndv_complete",
		},
		{
			name: "renders zsh completion",
			format: CliCompletionFormat.ZSH,
			expects: "#compdef sndv",
		},
		{
			name: "renders fish completion",
			format: CliCompletionFormat.FISH,
			expects: "complete -c sndv",
		},
	];

	for (const testCase of completionCases) {
		test(testCase.name, async () => {
			const output = await new CompletionCommand({ format: testCase.format }).execute();
			expect(output).toContain(testCase.expects);
		});
	}

	const invalidCases = [
		{
			name: "returns usage for missing format",
			format: undefined,
			expects: buildCompletionUsage(),
		},
		{
			name: "returns error for unknown format",
			format: "wat" as CliCompletionFormat,
			expects: CliErrors.invalidCompletionFormat("wat").message,
		},
	];

	for (const testCase of invalidCases) {
		test(testCase.name, async () => {
			const output = await new CompletionCommand({ format: testCase.format }).execute();
			expect(output).toBe(testCase.expects);
		});
	}
});
