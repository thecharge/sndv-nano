import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { LlmClient } from "@thecharge/sndv-adapter";
import { ChatRole, SNDV_DIR_NAME } from "@thecharge/sndv-config";

export interface ProposeOpts {
	projectDir: string;
	goal?: string;
	goalFile?: string;
	append?: boolean;
}

export const PROPOSE_USAGE = `sndv propose --goal <text> [options]
sndv propose --goal-file <path> [options]

Ask the LLM to decompose a goal into falsification tasks.

Options:
  --goal <text>         Goal as inline text
  --goal-file <path>    Read goal from a file (supports large/multiline goals)
  --append              Append tasks to existing protocol instead of creating new

Environment:
  SNDV_LLM_API_KEY      API key for the LLM endpoint
  SNDV_LLM_BASE_URL     Base URL (default: Ollama localhost)
  SNDV_LLM_MODEL        Model name`;

const DECOMPOSE_PROMPT = `You are a SMEP protocol designer. Your job is to take a goal and decompose it into falsification tasks.

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
type: greenfield
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

	const client = new LlmClient();

	console.log("  [LLM] Decomposing goal into falsification tasks...");
	const response = await client.chat([
		{ role: ChatRole.SYSTEM, content: DECOMPOSE_PROMPT },
		{ role: ChatRole.USER, content: goalText },
	]);

	const qmdContent = response.trim();

	if (!qmdContent.includes("# Task:")) {
		return `LLM response did not contain valid tasks. Raw response:\n\n${qmdContent}`;
	}

	const qmdPath = join(opts.projectDir, SNDV_DIR_NAME, "protocol.qmd");

	if (opts.append) {
		const taskSection = qmdContent.includes("---")
			? qmdContent.split(/^---$/m).slice(2).join("---").trim()
			: qmdContent;

		const existing = await readFile(qmdPath, "utf-8");
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
