import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { LlmClient } from "@thecharge/sndv-adapter";
import {
	buildDecomposePrompt,
	buildProposeUsage,
	ChatRole,
	CliErrors,
	MAX_TASK_NAME_LENGTH,
	ProjectType,
	SNDV_DIR_NAME,
} from "@thecharge/sndv-config";
import { parseQmdString } from "@thecharge/sndv-qmd";
import type { Command } from "./command";

export interface ProposeOpts {
	projectDir: string;
	goal?: string;
	goalFile?: string;
	append?: boolean;
	type?: ProjectType;
}

export class ProposeCommand implements Command {
	private readonly projectDir: string;
	private readonly goal?: string;
	private readonly goalFile?: string;
	private readonly append?: boolean;
	private readonly type?: ProjectType;

	constructor(opts: ProposeOpts) {
		this.projectDir = opts.projectDir;
		this.goal = opts.goal;
		this.goalFile = opts.goalFile;
		this.append = opts.append;
		this.type = opts.type;
	}

	execute = async (): Promise<string> => {
		const goalText = await resolveGoal({ goal: this.goal, goalFile: this.goalFile });
		if (!goalText) return buildProposeUsage();
		const projectType = this.type === ProjectType.BROWNFIELD ? "brownfield" : "greenfield";

		const client = new LlmClient();
		console.log("  [LLM] Decomposing goal into falsification tasks...");
		const response = await client.chat([
			{ role: ChatRole.SYSTEM, content: buildDecomposePrompt(projectType) },
			{ role: ChatRole.USER, content: goalText },
		]);

		const qmdContent = stripCodeFences(response.trim());
		const validationError = validateQmd(qmdContent);
		if (validationError) return `LLM response invalid: ${validationError}\n\n${qmdContent}`;

		const qmdPath = join(this.projectDir, SNDV_DIR_NAME, "protocol.qmd");

		if (this.append) {
			const existing = await readFile(qmdPath, "utf-8").catch(() => "");
			if (!existing) return CliErrors.missingProtocol().message;

			const taskSection = stripFrontmatter(qmdContent);
			await writeFile(qmdPath, `${existing.trimEnd()}\n\n${taskSection}\n`, "utf-8");
			return `Appended LLM-proposed tasks to protocol.qmd\n\nReview and edit: ${qmdPath}`;
		}

		await writeFile(qmdPath, `${qmdContent}\n`, "utf-8");
		return `Wrote LLM-proposed protocol to: ${qmdPath}\n\nReview and edit before running.`;
	};
}

const resolveGoal = async (opts: {
	goal?: string;
	goalFile?: string;
}): Promise<string | undefined> => {
	if (opts.goalFile) {
		try {
			return await readFile(opts.goalFile, "utf-8");
		} catch {
			return undefined;
		}
	}
	return opts.goal;
};

const stripFrontmatter = (content: string): string => {
	const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
	return match ? match[1].trim() : content.trim();
};

const stripCodeFences = (content: string): string =>
	content
		.replace(/^```[a-zA-Z]*\n/, "")
		.replace(/\n```$/, "")
		.trim();

const validateQmd = (content: string): string | null => {
	if (!content.includes("# Task:")) return "no task sections found";
	const doc = parseQmdString(content);
	if (!doc.frontmatter.goal) return "missing goal in frontmatter";
	if (doc.tasks.length === 0) return "no tasks parsed";

	for (const task of doc.tasks) {
		if (!/^[a-z0-9_]+$/.test(task.name)) return `invalid task name: ${task.name}`;
		if (task.name.length > MAX_TASK_NAME_LENGTH) return `task name too long: ${task.name}`;
		if (!Number.isFinite(task.risk) || task.risk < 0 || task.risk > 1) {
			return `invalid risk for task: ${task.name}`;
		}
		if (!task.description.trim()) return `missing description for task: ${task.name}`;
	}

	return null;
};
