import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { CONSTRAINTS_FILENAME, PATTERNS_FILENAME, type Pattern } from "@thecharge/sndv-config";
import { readJsonl, writeJsonl } from "./jsonl";

/**
 * Long-term memory - institutional patterns that survive forever.
 *
 * Stored as JSONL in `.sndv/memory/patterns.jsonl`.
 * Cross-hypothesis. "Every Redis test fails under 100k req/s."
 */
export class LongTermMemory {
	private readonly dir: string;
	private patternsCache: Pattern[] | null = null;
	private constraintsCache: string[] | null = null;

	constructor(dir: string) {
		this.dir = dir;
	}

	init = async (): Promise<void> => {
		await mkdir(this.dir, { recursive: true });
	};

	getPatterns = async (): Promise<Pattern[]> => {
		if (this.patternsCache) return this.patternsCache;
		this.patternsCache = await readJsonl<Pattern>(this.patternsPath());
		return this.patternsCache;
	};

	recordPattern = async (pattern: Pattern): Promise<void> => {
		const patterns = await this.getPatterns();
		const idx = patterns.findIndex((p) => p.id === pattern.id);
		if (idx >= 0) {
			patterns[idx] = pattern;
		}
		if (idx < 0) {
			patterns.push(pattern);
		}
		this.patternsCache = patterns;
		await mkdir(this.dir, { recursive: true });
		await writeJsonl(this.patternsPath(), patterns);
	};

	getConstraints = async (): Promise<string[]> => {
		if (this.constraintsCache) return this.constraintsCache;
		this.constraintsCache = await readJsonl<string>(this.constraintsPath());
		return this.constraintsCache;
	};

	recordConstraint = async (constraint: string): Promise<void> => {
		const constraints = await this.getConstraints();
		if (constraints.includes(constraint)) return;
		constraints.push(constraint);
		this.constraintsCache = constraints;
		await mkdir(this.dir, { recursive: true });
		await writeJsonl(this.constraintsPath(), constraints);
	};

	private patternsPath = (): string => join(this.dir, PATTERNS_FILENAME);
	private constraintsPath = (): string => join(this.dir, CONSTRAINTS_FILENAME);
}
