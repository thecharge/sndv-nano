import { join } from "node:path";
import { SNDV_DIR_NAME } from "@thecharge/sndv-config";
import { buildPromptFragment, MemoryRepository } from "@thecharge/sndv-memory";
import type { Command } from "./command";
export interface StatusOpts {
	projectDir: string;
}

/** Show project status: hypotheses, memory stats. */
export class StatusCommand implements Command {
	private readonly projectDir: string;

	constructor(opts: StatusOpts) {
		this.projectDir = opts.projectDir;
	}

	execute = async (): Promise<string> => {
		const memoryRepository = new MemoryRepository({ root: join(this.projectDir, SNDV_DIR_NAME) });
		await memoryRepository.init();

		const hypotheses = await memoryRepository.sessions.listHypotheses();
		const patterns = await memoryRepository.longTerm.getPatterns();
		const constraints = await memoryRepository.longTerm.getConstraints();

		const summary = [
			`Hypotheses: ${hypotheses.length}`,
			`Patterns: ${patterns.length}`,
			`Constraints: ${constraints.length}`,
			"",
			"Recent hypotheses:",
			...hypotheses.slice(0, 5).map((h) => `  - ${h.id} (${h.lastStatus}, runs: ${h.runs})`),
			"",
			"Recent patterns:",
			...patterns.slice(0, 5).map((p) => `  - ${p.pattern} (confidence: ${p.confidence})`),
			"",
			"Prompt fragment:",
			await buildSummaryFragment(memoryRepository, hypotheses),
		].join("\n");

		return summary;
	};
}

const buildSummaryFragment = async (
	memoryRepository: MemoryRepository,
	hypotheses: Array<{ id: string }>,
): Promise<string> => {
	if (hypotheses.length === 0) return "No prior context for this hypothesis.";
	const ctx = await memoryRepository.loadContext(hypotheses[0].id);
	return buildPromptFragment(ctx);
};
