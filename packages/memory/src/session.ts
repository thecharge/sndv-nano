import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	DECISIONS_FILENAME,
	type Decision,
	type DecisionAction,
	EVIDENCE_FILENAME,
	type EvidenceEntry,
	type Pattern,
	SESSION_META_FILENAME,
	type SessionContext,
} from "@thecharge/sndv-config";
import { appendJsonlBatch, readJsonl } from "./jsonl";

interface SessionMeta {
	hypothesisId: string;
	goal: string;
	created: string;
	runCount: number;
	lastRun?: string;
	lastStatus?: string;
}

interface RunData {
	goal: string;
	status: string;
	durationMs: number;
	iterations: number;
	survivingPath: string[];
	prunedPaths: string[];
	taskResults: Array<{
		taskName: string;
		status: string;
		evidence: Record<string, unknown>;
		error?: string;
		durationMs: number;
	}>;
}

/**
 * Medium-term memory - per-hypothesis session files on disk.
 *
 * Directory layout:
 *   .sndv/sessions/{hypothesis_id}/
 *     session.json      - run metadata (small, atomic JSON)
 *     evidence.jsonl    - captured evidence (append-only JSONL)
 *     decisions.jsonl   - what was tried (append-only JSONL)
 *
 * Evidence and decisions use JSONL for safe append-only writes.
 * No full-file reads needed for writes - prevents memory leaks on large files.
 */
export class SessionMemory {
	private readonly sessionsDir: string;

	constructor(root: string) {
		this.sessionsDir = join(root, "sessions");
	}

	init = async (): Promise<void> => {
		await mkdir(this.sessionsDir, { recursive: true });
	};

	/** Persist results after a run. Append-only for evidence and decisions. */
	recordRun = async (hypothesisId: string, run: RunData): Promise<void> => {
		const dir = this.sessionDir(hypothesisId);
		await mkdir(dir, { recursive: true });

		const now = new Date().toISOString();
		const runId = crypto.randomUUID().slice(0, 12);

		const meta = await this.loadMeta(dir, hypothesisId, run.goal);
		meta.runCount += 1;
		meta.lastRun = now;
		meta.lastStatus = run.status;
		await writeFile(join(dir, SESSION_META_FILENAME), JSON.stringify(meta, null, 2), "utf-8");

		const evidenceRecords = this.buildEvidenceRecords(run.taskResults, hypothesisId, now, runId);
		if (evidenceRecords.length > 0) {
			await appendJsonlBatch(join(dir, EVIDENCE_FILENAME), evidenceRecords);
		}

		const decisionRecords = this.buildDecisionRecords(run.taskResults, now, runId);
		await appendJsonlBatch(join(dir, DECISIONS_FILENAME), decisionRecords);
	};

	/** Load full session context before a run. */
	loadContext = async (
		hypothesisId: string,
		patterns: Pattern[] = [],
		constraints: string[] = [],
	): Promise<SessionContext> => {
		const dir = this.sessionDir(hypothesisId);
		const meta = await this.loadMeta(dir, hypothesisId, "");
		const decisions = await readJsonl<Decision>(join(dir, DECISIONS_FILENAME));
		const evidence = await readJsonl<EvidenceEntry>(join(dir, EVIDENCE_FILENAME));

		return {
			hypothesisId,
			previousRuns: meta.runCount,
			lastRunStatus: meta.lastStatus ?? null,
			pastDecisions: decisions,
			pastEvidence: evidence,
			relevantPatterns: patterns,
			constraintsLearned: constraints,
		};
	};

	/** List all tracked hypotheses. */
	listHypotheses = async (): Promise<
		Array<{ id: string; goal: string; runs: number; lastStatus: string }>
	> => {
		const results: Array<{ id: string; goal: string; runs: number; lastStatus: string }> = [];
		try {
			const dirs = await readdir(this.sessionsDir, { withFileTypes: true });
			for (const d of dirs) {
				if (!d.isDirectory()) continue;
				const meta = await this.loadMeta(join(this.sessionsDir, d.name), d.name, "");
				results.push({
					id: d.name,
					goal: meta.goal,
					runs: meta.runCount,
					lastStatus: meta.lastStatus ?? "unknown",
				});
			}
		} catch {
			// sessions dir doesn't exist yet
		}
		return results;
	};

	// --- Private ---

	private sessionDir = (hypothesisId: string): string => {
		const safe = hypothesisId.replace(/[^a-zA-Z0-9_-]/g, "_");
		return join(this.sessionsDir, safe);
	};

	private buildEvidenceRecords = (
		taskResults: RunData["taskResults"],
		hypothesisId: string,
		timestamp: string,
		runId: string,
	): EvidenceEntry[] =>
		taskResults.flatMap((tr) =>
			Object.entries(tr.evidence).map(([key, value]) => ({
				key,
				value,
				task: tr.taskName,
				hypothesisId,
				timestamp,
				runId,
				status: tr.status,
			})),
		);

	private buildDecisionRecords = (
		taskResults: RunData["taskResults"],
		timestamp: string,
		runId: string,
	): Decision[] =>
		taskResults.map((tr) => ({
			task: tr.taskName,
			action: tr.status as DecisionAction,
			reason: tr.error ?? "Passed falsification",
			evidence: tr.evidence,
			timestamp,
			runId,
		}));

	private loadMeta = async (
		dir: string,
		hypothesisId: string,
		goal: string,
	): Promise<SessionMeta> => {
		try {
			const raw = await readFile(join(dir, SESSION_META_FILENAME), "utf-8");
			return JSON.parse(raw);
		} catch {
			return { hypothesisId, goal, created: new Date().toISOString(), runCount: 0 };
		}
	};
}
