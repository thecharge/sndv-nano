import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
	type MemoryConfig,
	MemoryConfigSchema,
	type Pattern,
	type SessionContext,
} from "@thecharge/sndv-config";
import { extractPatterns } from "./extract";
import { LongTermMemory } from "./long-term";
import { buildPromptFragment } from "./prompt";
import { SessionMemory } from "./session";
import { ShortTermMemory } from "./short-term";

/**
 * Unified access to all 3 memory tiers. (Repository pattern)
 *
 *   Short-term:  runtime Map - ctx.evidence(), ctx.shared
 *   Medium-term: per-hypothesis session files on disk
 *   Long-term:   institutional patterns + learned constraints
 */
export class MemoryRepository {
	readonly shortTerm: ShortTermMemory;
	readonly sessions: SessionMemory;
	readonly longTerm: LongTermMemory;
	readonly config: MemoryConfig;

	constructor(config?: Partial<MemoryConfig>) {
		this.config = MemoryConfigSchema.parse(config ?? {});
		this.shortTerm = new ShortTermMemory(this.config.maxShortTermEntries);
		this.sessions = new SessionMemory(this.config.root);
		this.longTerm = new LongTermMemory(join(this.config.root, "memory"));
	}

	/** Ensure directories exist. Call once at startup. */
	async init(): Promise<void> {
		await mkdir(this.config.root, { recursive: true });
		await this.sessions.init();
		await this.longTerm.init();
	}

	/** Load full context for a hypothesis (medium + long-term). */
	async loadContext(hypothesisId: string): Promise<SessionContext> {
		const [patterns, constraints] = await Promise.all([
			this.longTerm.getPatterns(),
			this.longTerm.getConstraints(),
		]);
		return this.sessions.loadContext(hypothesisId, patterns, constraints);
	}

	/** Generate LLM-ready prompt from memory context. */
	async exportForLlm(hypothesisId: string): Promise<string> {
		const ctx = await this.loadContext(hypothesisId);
		return buildPromptFragment(ctx);
	}

	/** Scan sessions for repeated failures -> record as patterns. */
	async graduatePatterns(opts?: { minOccurrences?: number }): Promise<Pattern[]> {
		const patterns = await extractPatterns(this.sessions, opts);
		for (const p of patterns) {
			await this.longTerm.recordPattern(p);
		}
		return patterns;
	}
}
