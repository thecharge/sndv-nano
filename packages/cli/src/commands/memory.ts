import { join } from "node:path";
import { SNDV_DIR_NAME } from "@thecharge/sndv-config";
import { MemoryRepository } from "@thecharge/sndv-memory";

export interface MemoryOpts {
	projectDir: string;
	exportId?: string;
	patterns?: boolean;
	graduate?: boolean;
}

/** Memory management: export for LLM, view patterns, graduate patterns. */
export const memory = async (opts: MemoryOpts): Promise<string> => {
	const memoryRepository = new MemoryRepository({ root: join(opts.projectDir, SNDV_DIR_NAME) });
	await memoryRepository.init();

	if (opts.exportId) {
		const fragment = await memoryRepository.exportForLlm(opts.exportId);
		return fragment;
	}

	if (opts.graduate) {
		const newPatterns = await memoryRepository.graduatePatterns();
		if (newPatterns.length === 0) {
			return "No new patterns extracted. Need more sessions with repeated failures.";
		}
		const lines = [`Extracted ${newPatterns.length} new pattern(s):`];
		for (const pattern of newPatterns) {
			lines.push(
				`  - ${pattern.pattern} (${(pattern.confidence * 100).toFixed(0)}%, ${pattern.occurrences}x)`,
			);
		}
		return lines.join("\n");
	}

	if (opts.patterns) {
		const patterns = await memoryRepository.longTerm.getPatterns();
		if (patterns.length === 0) return "No institutional patterns recorded yet.";
		const lines = ["Institutional Patterns:", ""];
		for (const pattern of patterns) {
			lines.push(`### ${pattern.id}`);
			lines.push(`  Pattern:    ${pattern.pattern}`);
			lines.push(`  Confidence: ${(pattern.confidence * 100).toFixed(0)}%`);
			lines.push(`  Seen:       ${pattern.occurrences}x`);
			lines.push(`  Tags:       ${pattern.tags.join(", ") || "(none)"}`);
			lines.push("");
		}
		return lines.join("\n");
	}

	return "Usage: sndv memory [--export <id>] [--patterns] [--graduate]";
};
