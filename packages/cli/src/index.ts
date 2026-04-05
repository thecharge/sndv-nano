#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	buildCliUsage,
	CLI_COMMAND_ALIASES,
	CliCommand,
	CliCompletionFormat,
	CliFlag,
	CliProtocolAction,
	CliScaffoldTarget,
	CliTaskAction,
	ProjectType,
} from "@thecharge/sndv-config";
import type { Command } from "./commands/command";
import { CompletionCommand } from "./commands/completion";
import { InitCommand } from "./commands/init";
import { LinkCommand } from "./commands/link";
import { MemoryCommand } from "./commands/memory";
import { ProposeCommand } from "./commands/propose";
import { ProtocolCommand } from "./commands/protocol";
import { RunCommand } from "./commands/run";
import { ScaffoldCommand } from "./commands/scaffold";
import { StatusCommand } from "./commands/status";
import { TaskCommand } from "./commands/task";

const VERSION = resolveVersion();
const USAGE = buildCliUsage(VERSION);

const args = process.argv.slice(2);
const command = resolveCommand(args[0]);
const currentWorkingDir = process.cwd();

const flag = (name: CliFlag): string | undefined => {
	const flagIndex = args.indexOf(name);
	if (flagIndex === -1 || flagIndex + 1 >= args.length) return undefined;
	return args[flagIndex + 1];
};

const hasFlag = (name: CliFlag): boolean => args.includes(name);

const main = async (): Promise<void> => {
	if (!command) {
		console.log(USAGE);
		return;
	}

	if (command === CliCommand.HELP) {
		console.log(USAGE);
		return;
	}

	if (command === CliCommand.VERSION) {
		console.log(`sndv v${VERSION}`);
		return;
	}

	const commandInstance = buildCommand(command, args, currentWorkingDir);
	if (!commandInstance) {
		console.log(USAGE);
		return;
	}
	const output = await commandInstance.execute();
	console.log(output);
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

function resolveCommand(value?: string): CliCommand | undefined {
	if (!value) return undefined;
	return CLI_COMMAND_ALIASES[value];
}

function buildCommand(
	command: CliCommand,
	argv: string[],
	projectDir: string,
): Command | undefined {
	if (command === CliCommand.INIT) {
		const projectType = parseProjectType(flag(CliFlag.TYPE));
		return new InitCommand({
			projectDir,
			type: projectType,
			name: flag(CliFlag.NAME),
		});
	}

	if (command === CliCommand.RUN) {
		return new RunCommand({
			projectDir,
			qmdPath: flag(CliFlag.QMD),
			dryRun: hasFlag(CliFlag.DRY_RUN),
			noLlm: hasFlag(CliFlag.NO_LLM),
		});
	}

	if (command === CliCommand.STATUS) return new StatusCommand({ projectDir });

	if (command === CliCommand.MEMORY) {
		return new MemoryCommand({
			projectDir,
			exportId: flag(CliFlag.EXPORT),
			patterns: hasFlag(CliFlag.PATTERNS),
			graduate: hasFlag(CliFlag.GRADUATE),
		});
	}

	if (command === CliCommand.TASK) {
		return new TaskCommand({
			projectDir,
			action: parseTaskAction(argv[1]),
			name: flag(CliFlag.NAME),
			risk: flag(CliFlag.RISK),
			dependsOn: flag(CliFlag.DEPENDS_ON),
			description: flag(CliFlag.DESCRIPTION),
		});
	}

	if (command === CliCommand.PROTOCOL) {
		return new ProtocolCommand({
			projectDir,
			action: parseProtocolAction(argv[1]),
			name: flag(CliFlag.NAME),
		});
	}

	if (command === CliCommand.PROPOSE) {
		return new ProposeCommand({
			projectDir,
			goal: flag(CliFlag.GOAL),
			goalFile: flag(CliFlag.GOAL_FILE),
			append: hasFlag(CliFlag.APPEND),
			type: parseProjectType(flag(CliFlag.TYPE)),
		});
	}

	if (command === CliCommand.SCAFFOLD) {
		return new ScaffoldCommand({
			projectDir,
			target: parseScaffoldTarget(argv[1]),
			force: hasFlag(CliFlag.FORCE),
		});
	}

	if (command === CliCommand.COMPLETION) {
		return new CompletionCommand({ format: parseCompletionFormat(argv[1]) });
	}

	if (command === CliCommand.LINK) {
		return new LinkCommand({ projectDir, linkPath: flag(CliFlag.PATH) });
	}

	return undefined;
}

function parseProjectType(value?: string): ProjectType {
	if (value === ProjectType.BROWNFIELD) return ProjectType.BROWNFIELD;
	return ProjectType.GREENFIELD;
}

function parseTaskAction(value?: string): CliTaskAction | undefined {
	if (value === CliTaskAction.LIST) return CliTaskAction.LIST;
	if (value === CliTaskAction.ADD) return CliTaskAction.ADD;
	if (value === CliTaskAction.REMOVE) return CliTaskAction.REMOVE;
	return undefined;
}

function parseProtocolAction(value?: string): CliProtocolAction | undefined {
	if (value === CliProtocolAction.LIST) return CliProtocolAction.LIST;
	if (value === CliProtocolAction.ARCHIVE) return CliProtocolAction.ARCHIVE;
	if (value === CliProtocolAction.RESTORE) return CliProtocolAction.RESTORE;
	return undefined;
}

function parseScaffoldTarget(value?: string): CliScaffoldTarget | undefined {
	if (value === CliScaffoldTarget.CLAUDE) return CliScaffoldTarget.CLAUDE;
	if (value === CliScaffoldTarget.COPILOT) return CliScaffoldTarget.COPILOT;
	if (value === CliScaffoldTarget.OPENCODE) return CliScaffoldTarget.OPENCODE;
	if (value === CliScaffoldTarget.ALL) return CliScaffoldTarget.ALL;
	return undefined;
}

function parseCompletionFormat(value?: string): CliCompletionFormat | undefined {
	if (value === CliCompletionFormat.BASH) return CliCompletionFormat.BASH;
	if (value === CliCompletionFormat.ZSH) return CliCompletionFormat.ZSH;
	if (value === CliCompletionFormat.FISH) return CliCompletionFormat.FISH;
	return undefined;
}
