/** Default maximum iterations for a protocol run. */
export const DEFAULT_MAX_ITERATIONS = 20;

/** Default maximum cycles for a double loop. */
export const DEFAULT_MAX_CYCLES = 5;

/** Default maximum entries in short-term memory before LRU eviction. */
export const DEFAULT_MAX_SHORT_TERM_ENTRIES = 100;

/** Default LLM temperature for SMEP evaluations. */
export const DEFAULT_LLM_TEMPERATURE = 0.2;

/** Default LLM max tokens for responses. */
export const DEFAULT_LLM_MAX_TOKENS = 4096;

/** Default LLM model name — vendor-agnostic, override via SNDV_LLM_MODEL. */
export const DEFAULT_LLM_MODEL = "default";

/** Default LLM base URL — override via SNDV_LLM_BASE_URL. */
export const DEFAULT_LLM_BASE_URL = "http://localhost:11434/v1";

/** Environment variable names for LLM configuration (vendor-agnostic). */
export const ENV_LLM_API_KEY = "SNDV_LLM_API_KEY";
export const ENV_LLM_BASE_URL = "SNDV_LLM_BASE_URL";
export const ENV_LLM_MODEL = "SNDV_LLM_MODEL";
export const ENV_LLM_PROVIDER = "SNDV_LLM_PROVIDER";

/** Maximum allowed task name length in characters. */
export const MAX_TASK_NAME_LENGTH = 128;

/** Maximum recent decisions to include in LLM prompt fragments. */
export const MAX_PROMPT_RECENT_DECISIONS = 10;

/** Maximum recent evidence entries to include in LLM prompt fragments. */
export const MAX_PROMPT_RECENT_EVIDENCE = 15;

/** Default minimum occurrences for pattern extraction. */
export const DEFAULT_MIN_PATTERN_OCCURRENCES = 2;

/** Default minimum confidence for pattern extraction. */
export const DEFAULT_MIN_PATTERN_CONFIDENCE = 0.6;

/** Separator line for ASCII reports. */
export const REPORT_SEPARATOR = "=".repeat(60);

/** Visual icons for task statuses in ASCII output. */
export const STATUS_ICONS: Readonly<Record<string, string>> = {
	pending: "○",
	running: "◉",
	verified: "✓",
	falsified: "✗",
	errored: "!",
	skipped: "–",
	timed_out: "⏱",
} as const;

/** Known tags for auto-tagging patterns extracted from failure reasons. */
export const KNOWN_PATTERN_TAGS: readonly string[] = [
	"latency",
	"timeout",
	"memory",
	"throughput",
	"connection",
	"pool",
	"redis",
	"database",
	"api",
	"auth",
	"cache",
	"migration",
	"schema",
	"deploy",
	"build",
	"test",
	"p99",
	"p95",
	"cpu",
	"disk",
	"network",
] as const;

/** SNDV project directory name. */
export const SNDV_DIR_NAME = ".sndv";

/** Sessions subdirectory within SNDV project dir. */
export const SESSIONS_DIR_NAME = "sessions";

/** Memory subdirectory for long-term storage. */
export const MEMORY_DIR_NAME = "memory";

/** Patterns filename in long-term storage (JSONL). */
export const PATTERNS_FILENAME = "patterns.jsonl";

/** Constraints filename in long-term storage (JSONL). */
export const CONSTRAINTS_FILENAME = "constraints.jsonl";

/** Session metadata filename per hypothesis. */
export const SESSION_META_FILENAME = "session.json";

/** Evidence store filename per hypothesis (JSONL — append-only). */
export const EVIDENCE_FILENAME = "evidence.jsonl";

/** Decisions store filename per hypothesis (JSONL — append-only). */
export const DECISIONS_FILENAME = "decisions.jsonl";

/** Default protocol QMD filename. */
export const DEFAULT_PROTOCOL_FILENAME = "protocol.qmd";

/** Config filename within SNDV dir. */
export const CONFIG_FILENAME = "config.json";
