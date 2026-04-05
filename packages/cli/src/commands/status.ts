import { join } from "node:path";
import { REPORT_SEPARATOR, SNDV_DIR_NAME } from "@thecharge/sndv-config";
import { MemoryRepository } from "@thecharge/sndv-memory";

export interface StatusOpts {
	projectDir: string;
}

/** Show project status: hypotheses, memory stats. */
export const status = async (opts: StatusOpts): Promise<string> => {
	const memoryRepository = new MemoryRepository({ root: join(opts.projectDir, SNDV_DIR_NAME) });

	const hypotheses = await memoryRepository.sessions.listHypotheses();
	const patterns = await memoryRepository.longTerm.getPatterns();
	const constraints = await memoryRepository.longTerm.getConstraints();

	const lines = [
		"SMEP Project Status",
		REPORT_SEPARATOR,
		`Hypotheses tracked: ${hypotheses.length}`,
		`Institutional patterns: ${patterns.length}`,
		`Learned constraints: ${constraints.length}`,
	];

	if (hypotheses.length > 0) {
		lines.push("", "Recent hypotheses:");
		for (const hypothesis of hypotheses.slice(-5)) {
			const displayStatus = hypothesis.lastStatus.toUpperCase().padEnd(10);
			lines.push(`  [${displayStatus}] ${hypothesis.id} (${hypothesis.runs} runs)`);
		}
	}

	if (patterns.length > 0) {
		lines.push("", "Patterns:");
		for (const pattern of patterns.slice(-5)) {
			lines.push(
				`  - ${pattern.pattern} (${(pattern.confidence * 100).toFixed(0)}%, ${pattern.occurrences}x)`,
			);
		}
	}

	return lines.join("\n");
};
