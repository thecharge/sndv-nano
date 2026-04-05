import {
	DEFAULT_MIN_PATTERN_CONFIDENCE,
	DEFAULT_MIN_PATTERN_OCCURRENCES,
	DecisionAction,
	KNOWN_PATTERN_TAGS,
	type Pattern,
} from "@thecharge/sndv-config";
import type { SessionMemory } from "./session";

/**
 * Scan all sessions for repeated failure modes and extract patterns.
 *
 * This is how medium-term memory graduates to long-term memory.
 * Repeated failures across different hypotheses become institutional knowledge.
 */
export const extractPatterns = async (
	sessions: SessionMemory,
	opts: { minOccurrences?: number; minConfidence?: number } = {},
): Promise<Pattern[]> => {
	const minOccurrences = opts.minOccurrences ?? DEFAULT_MIN_PATTERN_OCCURRENCES;
	const minConfidence = opts.minConfidence ?? DEFAULT_MIN_PATTERN_CONFIDENCE;

	const hypotheses = await sessions.listHypotheses();
	const failureGroups = new Map<
		string,
		Array<{ hypothesis: string; task: string; reason: string; timestamp: string }>
	>();

	for (const hypothesis of hypotheses) {
		const sessionContext = await sessions.loadContext(hypothesis.id);
		for (const decision of sessionContext.pastDecisions) {
			if (decision.action !== DecisionAction.FALSIFIED) continue;
			const normalizedReason = normalizeReason(decision.reason);
			const group = failureGroups.get(normalizedReason) ?? [];
			group.push({
				hypothesis: hypothesis.id,
				task: decision.task,
				reason: decision.reason,
				timestamp: decision.timestamp,
			});
			failureGroups.set(normalizedReason, group);
		}
	}

	const patterns: Pattern[] = [];

	for (const [, occurrences] of failureGroups) {
		if (occurrences.length < minOccurrences) continue;

		const confidence = Math.min(1.0, occurrences.length / (minOccurrences * 3));
		if (confidence < minConfidence) continue;

		const sourceHypotheses = [...new Set(occurrences.map((occurrence) => occurrence.hypothesis))];
		const timestamps = occurrences.map((occurrence) => occurrence.timestamp).filter(Boolean);
		const representativeReason = occurrences[0].reason;

		const patternId = `auto-${await hashString(normalizeReason(representativeReason))}`;

		patterns.push({
			id: patternId,
			pattern: representativeReason,
			confidence,
			occurrences: occurrences.length,
			firstSeen: timestamps.length > 0 ? timestamps.sort()[0] : new Date().toISOString(),
			lastSeen: timestamps.length > 0 ? timestamps.sort().at(-1)! : new Date().toISOString(),
			sourceHypotheses,
			tags: extractTags(representativeReason),
		});
	}

	return patterns;
};

const normalizeReason = (reason: string): string =>
	reason
		.replace(/\d+\.?\d*/g, "N")
		.toLowerCase()
		.trim();

const extractTags = (text: string): string[] => {
	const lowerText = text.toLowerCase();
	return KNOWN_PATTERN_TAGS.filter((tag) => lowerText.includes(tag));
};

const hashString = async (input: string): Promise<string> => {
	const encoder = new TextEncoder();
	const data = encoder.encode(input);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(hashBuffer))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("")
		.slice(0, 8);
};
