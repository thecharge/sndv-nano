import { buildSystemPrompt } from "./prompt";

interface OpencodeTask {
	name: string;
	risk: number;
	dependsOn: string[];
}

/**
 * Adapter for opencode CLI integration.
 *
 * Generates instruction files and config that opencode
 * includes as context in every conversation.
 */
export class OpencodeAdapter {
	/** Generate a markdown instruction block for `.opencode/smep-context.md`. */
	toInstruction = (goal: string, constraints: string[], tasks: OpencodeTask[]): string => {
		const systemPrompt = buildSystemPrompt({ goal, constraints, tasks });

		return [
			"---",
			"# SMEP Protocol Context",
			"---",
			"",
			systemPrompt,
			"",
			"---",
			"## How to use with opencode",
			"",
			"1. Save this as `.opencode/smep-context.md` in your project",
			"2. opencode includes it as context in every conversation",
			"3. Ask opencode to work through each task in risk order",
			"4. For each task, ask it to try to BREAK the assumption",
			"---",
		].join("\n");
	};

	/** Generate a JSON config file for opencode. */
	toConfigFile = (goal: string, constraints: string[], tasks: OpencodeTask[]): string => {
		const systemPrompt = buildSystemPrompt({ goal, constraints, tasks });

		return JSON.stringify(
			{
				instructions: systemPrompt,
				model: "default",
				tools: ["read", "write", "bash"],
			},
			null,
			2,
		);
	};
}
