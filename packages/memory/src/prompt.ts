import {
	type Decision,
	type EvidenceEntry,
	MAX_PROMPT_RECENT_DECISIONS,
	MAX_PROMPT_RECENT_EVIDENCE,
	type SessionContext,
} from "@thecharge/sndv-config";

/**
 * Generate an LLM-ready text block from session context.
 * Bridge between memory and the agent.
 */
export const buildPromptFragment = (ctx: SessionContext): string => {
	const lines: string[] = [];
	appendPriorContext(lines, ctx);
	appendDecisions(lines, ctx.pastDecisions);
	appendEvidence(lines, ctx.pastEvidence);
	appendPatterns(lines, ctx);
	appendConstraints(lines, ctx.constraintsLearned);
	if (lines.length === 0) return "No prior context for this hypothesis.";
	return lines.join("\n");
};

const appendPriorContext = (lines: string[], ctx: SessionContext): void => {
	if (ctx.previousRuns === 0) return;
	lines.push(`## Prior context for \`${ctx.hypothesisId}\``);
	lines.push(`This hypothesis has been attempted ${ctx.previousRuns} time(s).`);
	if (ctx.lastRunStatus) lines.push(`Last run status: **${ctx.lastRunStatus}**`);
	lines.push("");
};

const appendDecisions = (lines: string[], decisions: Decision[]): void => {
	if (decisions.length === 0) return;
	lines.push("### What was already tried");

	const falsified = decisions.filter((d) => d.action === "falsified");
	appendDecisionList(lines, falsified, "Failed approaches (DO NOT retry without changes):", true);

	const verified = decisions.filter((d) => d.action === "verified");
	appendDecisionList(lines, verified, "Previously verified (can build on these):", false);
	lines.push("");
};

const appendDecisionList = (
	lines: string[],
	decisions: Decision[],
	header: string,
	includeReason: boolean,
): void => {
	if (decisions.length === 0) return;
	lines.push("", `**${header}**`);
	for (const d of decisions.slice(-MAX_PROMPT_RECENT_DECISIONS)) {
		lines.push(includeReason ? `- \`${d.task}\`: ${d.reason}` : `- \`${d.task}\``);
	}
};

const appendEvidence = (lines: string[], evidence: EvidenceEntry[]): void => {
	if (evidence.length === 0) return;
	lines.push("### Key evidence from past runs");

	const deduped = new Map<string, EvidenceEntry>();
	for (const entry of [...evidence].reverse()) {
		if (!deduped.has(entry.key)) deduped.set(entry.key, entry);
	}

	for (const entry of [...deduped.values()].slice(0, MAX_PROMPT_RECENT_EVIDENCE)) {
		const val = typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value);
		lines.push(`- \`${entry.key}\` = \`${val}\` (from \`${entry.task}\`, ${entry.status})`);
	}
	lines.push("");
};

const appendPatterns = (lines: string[], ctx: SessionContext): void => {
	if (ctx.relevantPatterns.length === 0) return;
	lines.push("### Institutional patterns to watch for");
	for (const p of ctx.relevantPatterns) {
		lines.push(
			`- **${p.pattern}** (confidence: ${(p.confidence * 100).toFixed(0)}%, seen ${p.occurrences}x)`,
		);
	}
	lines.push("");
};

const appendConstraints = (lines: string[], constraints: string[]): void => {
	if (constraints.length === 0) return;
	lines.push("### Constraints learned from experience");
	for (const c of constraints) {
		lines.push(`- ${c}`);
	}
	lines.push("");
};
