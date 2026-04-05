import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	buildAgentsInstructions,
	buildClaudeInstructions,
	buildCopilotInstructions,
	buildScaffoldUsage,
	CLI_SCAFFOLD_TARGETS,
	CliScaffoldTarget,
	SNDV_DIR_NAME,
} from "@thecharge/sndv-config";
import type { Command } from "./command";

export interface ScaffoldOpts {
	projectDir: string;
	target?: CliScaffoldTarget;
	force?: boolean;
}

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

export class ScaffoldCommand implements Command {
	private readonly projectDir: string;
	private readonly target?: CliScaffoldTarget;
	private readonly force?: boolean;

	constructor(opts: ScaffoldOpts) {
		this.projectDir = opts.projectDir;
		this.target = opts.target;
		this.force = opts.force;
	}

	execute = async (): Promise<string> => {
		if (!this.target) return buildScaffoldUsage();
		const validTarget = CLI_SCAFFOLD_TARGETS.includes(this.target);
		if (!validTarget) return buildScaffoldUsage();

		const configPath = join(this.projectDir, SNDV_DIR_NAME, "config.json");
		const projectName = await resolveProjectName(configPath);
		const results: string[] = ["Scaffolding agent instruction files:"];

		if (this.target === CliScaffoldTarget.CLAUDE || this.target === CliScaffoldTarget.ALL) {
			results.push(
				await writeIfMissing(
					join(this.projectDir, "CLAUDE.md"),
					buildClaudeInstructions(projectName),
					this.force,
				),
			);
		}

		if (this.target === CliScaffoldTarget.COPILOT || this.target === CliScaffoldTarget.ALL) {
			const copilotPath = join(this.projectDir, ".github", "copilot-instructions.md");
			results.push(await writeIfMissing(copilotPath, buildCopilotInstructions(), this.force));
		}

		if (this.target === CliScaffoldTarget.OPENCODE || this.target === CliScaffoldTarget.ALL) {
			results.push(
				await writeIfMissing(
					join(this.projectDir, "AGENTS.md"),
					buildAgentsInstructions(),
					this.force,
				),
			);
		}

		return results.join("\n");
	};
}

const resolveProjectName = async (configPath: string): Promise<string> => {
	try {
		const config = JSON.parse(await readFile(configPath, "utf-8"));
		const name = String(config.name ?? "").trim();
		if (name.length > 0) return name;
		return "my-project";
	} catch {
		return "my-project";
	}
};
