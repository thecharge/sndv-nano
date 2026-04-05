import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SNDV_DIR_NAME } from "@thecharge/sndv-config";

const CLAUDE_MD = (projectName: string): string => `## SNDV Protocol — ${projectName}

This project uses SNDV for falsification-first structured execution.
You are the evaluator — do not call \`sndv run\` (that invokes a second LLM).

### Before building

1. Run \`sndv status\` to check hypothesis state and prior runs
2. Run \`sndv memory --patterns\` to see what has failed before — avoid those
3. Read \`.sndv/protocol.qmd\` to see tasks ordered by risk

### Workflow

- Work through tasks in risk order (highest risk first)
- For each task, try to BREAK the assumption — not confirm it
- If you falsify a task, skip all tasks that depend on it
- Build only what survives falsification
- After finishing, run \`sndv memory --graduate\` to extract patterns

### Creating a new protocol

If no \`.sndv/\` directory exists, run \`sndv init\` first.
Edit \`.sndv/protocol.qmd\` to define your goal, constraints, and tasks.
Each task needs a \`risk\` score (0.0–1.0) and a description of what to try to break.

### Recording results

Run \`sndv run --no-llm\` to record the protocol execution offline.
Run \`sndv memory --graduate\` to extract institutional patterns.
`;

const COPILOT_INSTRUCTIONS = `## SNDV Protocol

This project uses SNDV for structured falsification-first execution.
SNDV is installed globally via \`bun link\` from the sndv-nano repository.

### Commands

- \`sndv status\` — show hypothesis state and run history
- \`sndv memory --patterns\` — list recurring failure patterns (avoid repeating these)
- \`sndv memory --export <id>\` — export full context for a hypothesis
- \`sndv run --no-llm\` — record protocol execution offline (no LLM call)
- \`sndv memory --graduate\` — extract patterns from session data

### Workflow

1. Run \`sndv status\` first
2. Run \`sndv memory --patterns\` to see past failures
3. Read \`.sndv/protocol.qmd\` for task list ordered by risk
4. For each task (highest risk first), try to falsify the assumption
5. Build only what survives
6. Run \`sndv memory --graduate\` when done

### Creating a protocol

Run \`sndv init\` to create \`.sndv/protocol.qmd\`, then edit it with your goal, constraints, and tasks.

Do NOT run \`sndv run\` — that calls a second LLM. You are the evaluator.
`;

const AGENTS_MD = `## SNDV Protocol

This project uses SNDV for structured falsification-first execution.
SNDV is installed globally (\`sndv\` command available in shell).

### Before building

1. \`sndv status\` — check hypothesis state
2. \`sndv memory --patterns\` — see repeated failures (do NOT repeat these)
3. Read \`.sndv/protocol.qmd\` — tasks ordered by risk

### Workflow

- Work tasks in risk order, highest first
- Try to BREAK each assumption, not confirm it
- Skip dependent tasks if a task is falsified
- Build only what survives
- \`sndv memory --graduate\` when finished

### Creating a protocol

If \`.sndv/\` does not exist: \`sndv init --type greenfield --name my-project\`
Edit \`.sndv/protocol.qmd\` with your goal, constraints, and risk-ordered tasks.

### Recording

- \`sndv run --no-llm\` — record execution offline
- \`sndv memory --graduate\` — extract patterns from sessions

Do NOT run \`sndv run\` (calls a second LLM — you are the evaluator).
`;

export interface ScaffoldOpts {
	projectDir: string;
	target: string;
	force?: boolean;
}

const VALID_TARGETS = ["claude", "copilot", "opencode", "all"] as const;
type ScaffoldTarget = (typeof VALID_TARGETS)[number];

export const SCAFFOLD_USAGE = `sndv scaffold <target>

Targets:
  claude     Generate CLAUDE.md for Claude Code
  copilot    Generate .github/copilot-instructions.md for GitHub Copilot
  opencode   Generate AGENTS.md for opencode
	all        Generate instruction files for all agents

Options:
	--force    Overwrite existing files`;

const writeIfMissing = async (
	filePath: string,
	content: string,
	force?: boolean,
): Promise<string> => {
	try {
		await readFile(filePath, "utf-8");
		if (!force) return `  exists: ${filePath} (skipped)`;
	} catch {
		const { mkdir } = await import("node:fs/promises");
		const { dirname } = await import("node:path");
		await mkdir(dirname(filePath), { recursive: true });
		await writeFile(filePath, content, "utf-8");
		return `  created: ${filePath}`;
	}

	await writeFile(filePath, content, "utf-8");
	return `  overwritten: ${filePath}`;
};

export const scaffold = async (opts: ScaffoldOpts): Promise<string> => {
	const target = opts.target as ScaffoldTarget;
	if (!VALID_TARGETS.includes(target)) return SCAFFOLD_USAGE;

	const configPath = join(opts.projectDir, SNDV_DIR_NAME, "config.json");
	let projectName = "my-project";
	try {
		const config = JSON.parse(await readFile(configPath, "utf-8"));
		projectName = config.name ?? projectName;
	} catch {
		/* no config yet */
	}

	const results: string[] = ["Scaffolding agent instruction files:"];

	if (target === "claude" || target === "all") {
		results.push(
			await writeIfMissing(join(opts.projectDir, "CLAUDE.md"), CLAUDE_MD(projectName), opts.force),
		);
	}

	if (target === "copilot" || target === "all") {
		const copilotPath = join(opts.projectDir, ".github", "copilot-instructions.md");
		results.push(await writeIfMissing(copilotPath, COPILOT_INSTRUCTIONS, opts.force));
	}

	if (target === "opencode" || target === "all") {
		results.push(await writeIfMissing(join(opts.projectDir, "AGENTS.md"), AGENTS_MD, opts.force));
	}

	return results.join("\n");
};
