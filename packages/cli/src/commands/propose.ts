import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { LlmClient } from "@thecharge/sndv-adapter";
import { ChatRole, MAX_TASK_NAME_LENGTH, SNDV_DIR_NAME } from "@thecharge/sndv-config";
import { parseQmdString } from "@thecharge/sndv-qmd";

export interface ProposeOpts {
	projectDir: string;
	goal?: string;
	goalFile?: string;
	append?: boolean;
	type?: string;
}

export const PROPOSE_USAGE = `sndv propose --goal <text> [options]
sndv propose --goal-file <path> [options]

Ask the LLM to decompose a goal into falsification tasks.

Options:
  --goal <text>         Goal as inline text
  --goal-file <path>    Read goal from a file (supports large/multiline goals)
  --append              Append tasks to existing protocol instead of creating new
	--type <greenfield|brownfield>  Protocol type (default: greenfield)

Environment:
  SNDV_LLM_API_KEY      API key for the LLM endpoint
  SNDV_LLM_BASE_URL     Base URL (default: Ollama localhost)
  SNDV_LLM_MODEL        Model name`;

const DECOMPOSE_PROMPT = (
	projectType: string,
): string => `You are a SMEP protocol designer. Your job is to take a goal and decompose it into falsification tasks.

RULES:
1. Each task must try to BREAK an assumption, not confirm it.
2. Assign risk 0.0–1.0: higher = more likely to fail = evaluate first.
3. Set depends_on when a task only makes sense if another passes.
4. Task names must be snake_case, max 64 chars.
5. Write 3–8 tasks. Fewer for simple goals, more for complex ones.
6. Each task description should be 1–3 sentences explaining what to attack.

OUTPUT FORMAT (exactly this, no markdown fences, no extra text):

---
goal: "<the goal>"
type: ${projectType}
max_iterations: 10
constraints:
	- "<constraint>"
---

# Task: <name>
risk: <float>

<description>

# Task: <name>
risk: <float>
depends_on: [<dep>]

<description>`;

export const propose = async (opts: ProposeOpts): Promise<string> => {
	const goalText = await resolveGoal(opts);
	if (!goalText) return PROPOSE_USAGE;
	const projectType = opts.type === "brownfield" ? "brownfield" : "greenfield";

	const client = new LlmClient();

	console.log("  [LLM] Decomposing goal into falsification tasks...");
	const response = await client.chat([
		{ role: ChatRole.SYSTEM, content: DECOMPOSE_PROMPT(projectType) },
		{ role: ChatRole.USER, content: goalText },
	]);

	const qmdContent = stripCodeFences(response.trim());
	const validationError = validateQmd(qmdContent);
	if (validationError) return `LLM response invalid: ${validationError}\n\n${qmdContent}`;

	const qmdPath = join(opts.projectDir, SNDV_DIR_NAME, "protocol.qmd");

	if (opts.append) {
		const existing = await readFile(qmdPath, "utf-8").catch(() => "");
		if (!existing) return "Error: protocol.qmd not found. Run `sndv init` first.";

		const taskSection = stripFrontmatter(qmdContent);
		await writeFile(qmdPath, `${existing.trimEnd()}\n\n${taskSection}\n`, "utf-8");
		return `Appended LLM-proposed tasks to protocol.qmd\n\nReview and edit: ${qmdPath}`;
	}

	await writeFile(qmdPath, `${qmdContent}\n`, "utf-8");
	return `Wrote LLM-proposed protocol to: ${qmdPath}\n\nReview and edit before running.`;
};

const resolveGoal = async (opts: ProposeOpts): Promise<string | undefined> => {
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
