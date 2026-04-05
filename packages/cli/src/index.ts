#!/usr/bin/env node
import { ProjectType } from "@thecharge/sndv-config";
import { init } from "./commands/init";
import { memory } from "./commands/memory";
import { run } from "./commands/run";
import { status } from "./commands/status";

const USAGE = `sndv — SMEP CLI

Usage:
  sndv init [--type greenfield|brownfield] [--name project-name]
  sndv run [--qmd path/to/protocol.qmd] [--dry-run] [--no-llm]
  sndv status
  sndv memory [--export hypothesis-id] [--patterns] [--graduate]

Commands:
  init     Create a new SMEP project in the current directory
  run      Execute protocol — with LLM by default, --no-llm for offline
  status   Show project status and memory summary
  memory   Inspect and manage memory (export for LLM, view patterns)

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

	console.log(USAGE);
};

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
