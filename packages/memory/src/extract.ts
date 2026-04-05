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

	const failureGroups = await collectFailureGroups(sessions);
	return buildPatterns(failureGroups, minOccurrences, minConfidence);
};

const collectFailureGroups = async (
	sessions: SessionMemory,
): Promise<
	Map<string, Array<{ hypothesis: string; task: string; reason: string; timestamp: string }>>
> => {
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

	return failureGroups;
};

const buildPatterns = async (
	failureGroups: Map<
		string,
		Array<{ hypothesis: string; task: string; reason: string; timestamp: string }>
	>,
	minOccurrences: number,
	minConfidence: number,
): Promise<Pattern[]> => {
	const patterns: Pattern[] = [];
	for (const [, occurrences] of failureGroups) {
		const pattern = await buildPattern(occurrences, minOccurrences, minConfidence);
		if (!pattern) continue;
		patterns.push(pattern);
	}
	return patterns;
};

const buildPattern = async (
	occurrences: Array<{ hypothesis: string; task: string; reason: string; timestamp: string }>,
	minOccurrences: number,
	minConfidence: number,
): Promise<Pattern | null> => {
	if (occurrences.length < minOccurrences) return null;
	const confidence = Math.min(1.0, occurrences.length / (minOccurrences * 3));
	if (confidence < minConfidence) return null;

	const sourceHypotheses = [...new Set(occurrences.map((occurrence) => occurrence.hypothesis))];
	const timestamps = occurrences.map((occurrence) => occurrence.timestamp).filter(Boolean);
	const representativeReason = occurrences[0].reason;
	const patternId = `auto-${await hashString(normalizeReason(representativeReason))}`;
	const { firstSeen, lastSeen } = resolveBounds(timestamps);

	return {
		id: patternId,
		pattern: representativeReason,
		confidence,
		occurrences: occurrences.length,
		firstSeen,
		lastSeen,
		sourceHypotheses,
		tags: extractTags(representativeReason),
	};
};

const resolveBounds = (timestamps: string[]): { firstSeen: string; lastSeen: string } => {
	if (timestamps.length === 0) {
		const now = new Date().toISOString();
		return { firstSeen: now, lastSeen: now };
	}
	const sorted = [...timestamps].sort();
	return { firstSeen: sorted[0], lastSeen: sorted[sorted.length - 1] };
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
