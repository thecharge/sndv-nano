#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ProjectType } from "@thecharge/sndv-config";
import { init } from "./commands/init";
import { memory } from "./commands/memory";
import { propose } from "./commands/propose";
import { protocol } from "./commands/protocol";
import { run } from "./commands/run";
import { scaffold } from "./commands/scaffold";
import { status } from "./commands/status";
import { task } from "./commands/task";

const VERSION = resolveVersion();

const USAGE = `sndv — SMEP CLI (v${VERSION})

Usage:
  sndv init [--type greenfield|brownfield] [--name project-name]
  sndv run [--qmd path] [--dry-run] [--no-llm]
  sndv status
  sndv memory [--export id] [--patterns] [--graduate]
  sndv task <list|add|remove> [--name n] [--risk 0.9] [--depends-on a,b]
  sndv protocol <list|archive|restore> [--name n]
	sndv propose --goal <text> | --goal-file <path> [--append] [--type greenfield|brownfield]
	sndv scaffold <claude|copilot|opencode|all> [--force]
  sndv --version

Commands:
  init       Create a new SMEP project in the current directory
  run        Execute protocol — with LLM by default, --no-llm for offline
  status     Show project status and memory summary
  memory     Inspect and manage memory (export, patterns, graduate)
  task       Add, remove, or list tasks in the protocol
  protocol   Archive, restore, or list protocols
	propose    Ask the LLM to decompose a goal into falsification tasks
	scaffold   Generate agent instruction files (CLAUDE.md, copilot, AGENTS.md)

Environment (vendor-agnostic):
  SNDV_LLM_API_KEY    API key for any OpenAI-compatible endpoint
  SNDV_LLM_BASE_URL   Base URL (default: http://localhost:11434/v1)
  SNDV_LLM_MODEL      Model name (default: "default")`;

const args = process.argv.slice(2);
const command = args[0];
const currentWorkingDir = process.cwd();

const flag = (name: string): string | undefined => {
	const flagIndex = args.indexOf(`--${name}`);
	if (flagIndex === -1 || flagIndex + 1 >= args.length) return undefined;
	return args[flagIndex + 1];
};

const hasFlag = (name: string): boolean => args.includes(`--${name}`);

const main = async (): Promise<void> => {
	if (!command || command === "help" || command === "--help" || command === "-h") {
		console.log(USAGE);
		return;
	}

	if (command === "--version" || command === "-v") {
		console.log(`sndv v${VERSION}`);
		return;
	}

	if (command === "init") {
		const projectType = (flag("type") ?? ProjectType.GREENFIELD) as ProjectType;
		const projectName = flag("name");
		const createdPath = await init({
			projectDir: currentWorkingDir,
			type: projectType,
			name: projectName,
		});
		console.log(`Initialized SMEP project at ${createdPath}`);
		return;
	}

	if (command === "run") {
		const qmdPath = flag("qmd");
		const dryRun = hasFlag("dry-run");
		const noLlm = hasFlag("no-llm");
		const output = await run({ projectDir: currentWorkingDir, qmdPath, dryRun, noLlm });
		console.log(output);
		return;
	}

	if (command === "status") {
		const output = await status({ projectDir: currentWorkingDir });
		console.log(output);
		return;
	}

	if (command === "memory") {
		const exportId = flag("export");
		const showPatterns = hasFlag("patterns");
		const shouldGraduate = hasFlag("graduate");
		const output = await memory({
			projectDir: currentWorkingDir,
			exportId,
			patterns: showPatterns,
			graduate: shouldGraduate,
		});
		console.log(output);
		return;
	}

	if (command === "task") {
		const action = args[1] ?? "";
		const output = await task({
			projectDir: currentWorkingDir,
			action,
			name: flag("name"),
			risk: flag("risk"),
			dependsOn: flag("depends-on"),
			description: flag("description"),
		});
		console.log(output);
		return;
	}

	if (command === "protocol") {
		const action = args[1] ?? "";
		const output = await protocol({
			projectDir: currentWorkingDir,
			action,
			name: flag("name"),
		});
		console.log(output);
		return;
	}

	if (command === "propose") {
		const output = await propose({
			projectDir: currentWorkingDir,
			goal: flag("goal"),
			goalFile: flag("goal-file"),
			append: hasFlag("append"),
			type: flag("type"),
		});
		console.log(output);
		return;
	}

	if (command === "scaffold") {
		const target = args[1] ?? "";
		const output = await scaffold({
			projectDir: currentWorkingDir,
			target,
			force: hasFlag("force"),
		});
		console.log(output);
		return;
	}

	console.log(USAGE);
};

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});

function resolveVersion(): string {
	try {
		const here = dirname(fileURLToPath(import.meta.url));
		const pkgPath = join(here, "..", "package.json");
		const parsed = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version?: string };
		return parsed.version ?? "0.1.0";
	} catch {
		return "0.1.0";
	}
}
