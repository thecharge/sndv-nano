import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { MAX_TASK_NAME_LENGTH, SNDV_DIR_NAME } from "@thecharge/sndv-config";
import { parseQmd } from "@thecharge/sndv-qmd";

export interface TaskOpts {
	projectDir: string;
	action: string;
	name?: string;
	risk?: string;
	dependsOn?: string;
	description?: string;
}

export const TASK_USAGE = `sndv task <action> [options]

Actions:
  list                      List all tasks in the protocol
  add --name <n> [options]  Add a task to the protocol
  remove --name <n>         Remove a task from the protocol

Options (for add):
  --name <name>             Task name (required)
  --risk <0.0-1.0>          Risk score (default: 0.5)
  --depends-on <a,b>        Comma-separated dependency names
  --description <text>      What to try to break`;

export const task = async (opts: TaskOpts): Promise<string> => {
	if (opts.action === "list") return listTasks(opts.projectDir);
	if (opts.action === "add") return addTask(opts);
	if (opts.action === "remove") return removeTask(opts);
	return TASK_USAGE;
};

const qmdPath = (projectDir: string): string => join(projectDir, SNDV_DIR_NAME, "protocol.qmd");

const listTasks = async (projectDir: string): Promise<string> => {
	const filePath = qmdPath(projectDir);
	const exists = await ensureQmdExists(filePath);
	if (!exists) return "Error: protocol.qmd not found. Run `sndv init` first.";

	const doc = await parseQmd(filePath);
	if (doc.tasks.length === 0) return "No tasks defined in protocol.qmd";

	const lines = doc.tasks.map((t, i) => {
		const deps = t.dependsOn.length > 0 ? ` depends_on=[${t.dependsOn.join(", ")}]` : "";
		return `  ${i + 1}. ${t.name} (risk=${t.risk}${deps})`;
	});
	return `Tasks in protocol.qmd:\n${lines.join("\n")}`;
};

const addTask = async (opts: TaskOpts): Promise<string> => {
	if (!opts.name) return "Error: --name is required for task add";
	if (!isValidTaskName(opts.name)) {
		return `Error: task name must be snake_case and <= ${MAX_TASK_NAME_LENGTH} chars`;
	}

	const filePath = qmdPath(opts.projectDir);
	const exists = await ensureQmdExists(filePath);
	if (!exists) return "Error: protocol.qmd not found. Run `sndv init` first.";

	const raw = await readFile(filePath, "utf-8");

	const doc = await parseQmd(filePath);
	const existing = doc.tasks.find((t) => t.name === opts.name);
	if (existing) return `Error: task "${opts.name}" already exists`;

	const risk = opts.risk ? parseFloat(opts.risk) : 0.5;
	if (risk < 0 || risk > 1 || Number.isNaN(risk)) return "Error: risk must be between 0.0 and 1.0";

	const taskBlock = buildTaskBlock(opts.name, risk, opts.dependsOn, opts.description);
	const updated = `${raw.trimEnd()}\n\n${taskBlock}\n`;
	await writeFile(filePath, updated, "utf-8");

	return `Added task "${opts.name}" (risk=${risk})`;
};

const removeTask = async (opts: TaskOpts): Promise<string> => {
	if (!opts.name) return "Error: --name is required for task remove";
	if (!isValidTaskName(opts.name)) {
		return `Error: task name must be snake_case and <= ${MAX_TASK_NAME_LENGTH} chars`;
	}

	const filePath = qmdPath(opts.projectDir);
	const exists = await ensureQmdExists(filePath);
	if (!exists) return "Error: protocol.qmd not found. Run `sndv init` first.";

	const raw = await readFile(filePath, "utf-8");

	const doc = await parseQmd(filePath);
	const existing = doc.tasks.find((t) => t.name === opts.name);
	if (!existing) return `Error: task "${opts.name}" not found`;

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
