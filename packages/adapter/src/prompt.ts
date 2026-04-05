/**
 * Build the SMEP system prompt for an LLM.
 *
 * Tells the agent: goal, constraints, how to operate, response format.
 */
export const buildSystemPrompt = (opts: {
	goal: string;
	constraints: string[];
	tasks: Array<{ name: string; risk: number; dependsOn: string[] }>;
}): string => {
	const constraintList = opts.constraints.map((constraint) => `  - ${constraint}`).join("\n");
	const taskList = opts.tasks
		.map((task) => `  - ${task.name} (risk=${task.risk}, deps=[${task.dependsOn.join(", ")}])`)
		.join("\n");

	return `You are executing SMEP — the Self-Managing Execution Protocol.

GOAL: ${opts.goal}

CONSTRAINTS (you must NEVER violate these):
${constraintList || "  (none)"}

TASKS (ordered by risk, highest first):
${taskList}

RULES:
1. For each task, TRY TO BREAK the assumption, not confirm it.
2. If the assumption holds: report VERIFIED with evidence.
3. If the assumption fails: report FALSIFIED with reason.
4. Record evidence as key=value pairs.
5. Falsified tasks auto-skip all downstream tasks.

Respond in valid JSON:
{"task":"<task_name>","status":"verified"|"falsified","evidence":{"key":"value"},"reason":"only if falsified"}`;
};
