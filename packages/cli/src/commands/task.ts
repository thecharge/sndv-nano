import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	buildTaskUsage,
	CliErrors,
	CliTaskAction,
	MAX_TASK_NAME_LENGTH,
	SNDV_DIR_NAME,
} from "@thecharge/sndv-config";
import { parseQmd } from "@thecharge/sndv-qmd";
import type { Command } from "./command";

export interface TaskOpts {
	projectDir: string;
	action?: CliTaskAction;
	name?: string;
	risk?: string;
	dependsOn?: string;
	description?: string;
}

export class TaskCommand implements Command {
	private readonly projectDir: string;
	private readonly action?: CliTaskAction;
	private readonly name?: string;
	private readonly risk?: string;
	private readonly dependsOn?: string;
	private readonly description?: string;

	constructor(opts: TaskOpts) {
		this.projectDir = opts.projectDir;
		this.action = opts.action;
		this.name = opts.name;
		this.risk = opts.risk;
		this.dependsOn = opts.dependsOn;
		this.description = opts.description;
	}

	execute = async (): Promise<string> => {
		if (!this.action) return buildTaskUsage();
		if (this.action === CliTaskAction.LIST) return listTasks(this.projectDir);
		if (this.action === CliTaskAction.ADD)
			return addTask({
				projectDir: this.projectDir,
				name: this.name,
				risk: this.risk,
				dependsOn: this.dependsOn,
				description: this.description,
			});
		if (this.action === CliTaskAction.REMOVE)
			return removeTask({
				projectDir: this.projectDir,
				name: this.name,
			});
		return buildTaskUsage();
	};
}

const qmdPath = (projectDir: string): string => join(projectDir, SNDV_DIR_NAME, "protocol.qmd");

const listTasks = async (projectDir: string): Promise<string> => {
	const filePath = qmdPath(projectDir);
	const exists = await ensureQmdExists(filePath);
	if (!exists) return CliErrors.missingProtocol().message;

	const doc = await parseQmd(filePath);
	if (doc.tasks.length === 0) return "No tasks defined in protocol.qmd";

	const lines = doc.tasks.map((t, i) => {
		const deps = t.dependsOn.length > 0 ? ` depends_on=[${t.dependsOn.join(", ")}]` : "";
		return `  ${i + 1}. ${t.name} (risk=${t.risk}${deps})`;
	});
	return `Tasks in protocol.qmd:\n${lines.join("\n")}`;
};

const addTask = async (opts: TaskOpts): Promise<string> => {
	if (!opts.name) return CliErrors.invalidTaskName(MAX_TASK_NAME_LENGTH).message;
	if (!isValidTaskName(opts.name)) return CliErrors.invalidTaskName(MAX_TASK_NAME_LENGTH).message;

	const filePath = qmdPath(opts.projectDir);
	const exists = await ensureQmdExists(filePath);
	if (!exists) return CliErrors.missingProtocol().message;

	const raw = await readFile(filePath, "utf-8");

	const doc = await parseQmd(filePath);
	const existing = doc.tasks.find((t) => t.name === opts.name);
	if (existing) return CliErrors.duplicateTask(opts.name).message;

	const risk = opts.risk ? parseFloat(opts.risk) : 0.5;
	if (risk < 0 || risk > 1 || Number.isNaN(risk)) return CliErrors.invalidRisk().message;

	const taskBlock = buildTaskBlock(opts.name, risk, opts.dependsOn, opts.description);
	const updated = `${raw.trimEnd()}\n\n${taskBlock}\n`;
	await writeFile(filePath, updated, "utf-8");

	return `Added task "${opts.name}" (risk=${risk})`;
};

const removeTask = async (opts: TaskOpts): Promise<string> => {
	if (!opts.name) return CliErrors.invalidTaskName(MAX_TASK_NAME_LENGTH).message;
	if (!isValidTaskName(opts.name)) return CliErrors.invalidTaskName(MAX_TASK_NAME_LENGTH).message;

	const filePath = qmdPath(opts.projectDir);
	const exists = await ensureQmdExists(filePath);
	if (!exists) return CliErrors.missingProtocol().message;

	const raw = await readFile(filePath, "utf-8");

	const doc = await parseQmd(filePath);
	const existing = doc.tasks.find((t) => t.name === opts.name);
	if (!existing) return CliErrors.unknownTask(opts.name).message;

	const taskPattern = new RegExp(
		`\\n?# Task: ${escapeRegex(opts.name)}\\n[\\s\\S]*?(?=\\n# Task: |$)`,
	);
	const updated = raw.replace(taskPattern, "");
	await writeFile(filePath, `${updated.trimEnd()}\n`, "utf-8");

	return `Removed task "${opts.name}"`;
};

const buildTaskBlock = (
	name: string,
	risk: number,
	dependsOn?: string,
	description?: string,
): string => {
	const lines = [`# Task: ${name}`, `risk: ${risk}`];
	if (dependsOn) {
		const deps = dependsOn
			.split(",")
			.map((d) => d.trim())
			.filter(Boolean)
			.join(", ");
		if (deps) lines.push(`depends_on: [${deps}]`);
	}
	lines.push("", description ?? "Describe what to try to break here.");
	return lines.join("\n");
};

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isValidTaskName = (name: string): boolean => {
	if (name.length === 0 || name.length > MAX_TASK_NAME_LENGTH) return false;
	return /^[a-z0-9_]+$/.test(name);
};

const ensureQmdExists = async (filePath: string): Promise<boolean> => {
	try {
		await readFile(filePath, "utf-8");
		return true;
	} catch {
		return false;
	}
};
