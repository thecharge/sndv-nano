import { z } from "zod";
import { type ChatRole, DecisionAction, type VerdictStatus } from "./enums";

// ---------------------------------------------------------------------------
// Memory types
// ---------------------------------------------------------------------------

export const EvidenceEntrySchema = z.object({
	key: z.string().min(1),
	value: z.unknown(),
	task: z.string(),
	hypothesisId: z.string(),
	timestamp: z.string(),
	runId: z.string(),
	status: z.string(),
});
export type EvidenceEntry = z.infer<typeof EvidenceEntrySchema>;

export const DecisionSchema = z.object({
	task: z.string(),
	action: z.nativeEnum(DecisionAction),
	reason: z.string(),
	evidence: z.record(z.unknown()).default({}),
	timestamp: z.string(),
	runId: z.string(),
});
export type Decision = z.infer<typeof DecisionSchema>;

export const PatternSchema = z.object({
	id: z.string(),
	pattern: z.string(),
	confidence: z.number().min(0).max(1),
	occurrences: z.number().int().positive(),
	firstSeen: z.string(),
	lastSeen: z.string(),
	sourceHypotheses: z.array(z.string()),
	tags: z.array(z.string()),
});
export type Pattern = z.infer<typeof PatternSchema>;

export interface SessionContext {
	hypothesisId: string;
	previousRuns: number;
	lastRunStatus: string | null;
	pastDecisions: Decision[];
	pastEvidence: EvidenceEntry[];
	relevantPatterns: Pattern[];
	constraintsLearned: string[];
}

export const MemoryConfigSchema = z.object({
	root: z.string().default(".sndv"),
	maxShortTermEntries: z.number().int().positive().default(100),
});
export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;

// ---------------------------------------------------------------------------
// Adapter types
// ---------------------------------------------------------------------------

export interface ChatMessage {
	role: ChatRole;
	content: string;
}

export interface ChatCompletionRequest {
	model: string;
	messages: ChatMessage[];
	temperature?: number;
	max_tokens?: number;
}

export interface ChatCompletionResponse {
	choices: Array<{
		message: { role: string; content: string };
		finish_reason: string;
	}>;
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

export interface LlmConfig {
	apiKey: string;
	baseUrl: string;
	model: string;
	temperature?: number;
	maxTokens?: number;
}

export interface TaskVerdict {
	task: string;
	status: VerdictStatus;
	evidence: Record<string, unknown>;
	reason?: string;
}

// ---------------------------------------------------------------------------
// CLI / QMD types
// ---------------------------------------------------------------------------

export interface QmdDocument {
	frontmatter: Record<string, unknown>;
	tasks: QmdTask[];
	body: string;
}

export interface QmdTask {
	name: string;
	risk: number;
	dependsOn: string[];
	description: string;
}
