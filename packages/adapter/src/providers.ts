import {
	type ChatCompletionResponse,
	type ChatMessage,
	ChatRole,
	type LlmConfig,
	SmepErrors,
} from "@thecharge/sndv-config";

// ---------------------------------------------------------------------------
// Provider definitions
// ---------------------------------------------------------------------------

export enum LlmProvider {
	OLLAMA = "ollama",
	OPENAI = "openai",
	GEMINI = "gemini",
	GROK = "grok",
	OPENROUTER = "openrouter",
	ANTHROPIC = "anthropic",
	LM_STUDIO = "lm_studio",
	TOGETHER = "together",
	CUSTOM = "custom",
}

export interface ProviderPreset {
	baseUrl: string;
	defaultModel: string;
	apiKeyEnvHint: string;
}

export const PROVIDER_PRESETS: Readonly<Record<LlmProvider, ProviderPreset>> = {
	[LlmProvider.OLLAMA]: {
		baseUrl: "http://localhost:11434/v1",
		defaultModel: "llama3",
		apiKeyEnvHint: "(not required for local)",
	},
	[LlmProvider.OPENAI]: {
		baseUrl: "https://api.openai.com/v1",
		defaultModel: "gpt-4o-mini",
		apiKeyEnvHint: "sk-...",
	},
	[LlmProvider.GEMINI]: {
		baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
		defaultModel: "gemini-2.0-flash",
		apiKeyEnvHint: "GOOGLE_API_KEY or AIza...",
	},
	[LlmProvider.GROK]: {
		baseUrl: "https://api.x.ai/v1",
		defaultModel: "grok-2",
		apiKeyEnvHint: "xai-...",
	},
	[LlmProvider.OPENROUTER]: {
		baseUrl: "https://openrouter.ai/api/v1",
		defaultModel: "anthropic/claude-sonnet-4-20250514",
		apiKeyEnvHint: "sk-or-v1-...",
	},
	[LlmProvider.ANTHROPIC]: {
		baseUrl: "https://api.anthropic.com",
		defaultModel: "claude-sonnet-4-20250514",
		apiKeyEnvHint: "sk-ant-...",
	},
	[LlmProvider.LM_STUDIO]: {
		baseUrl: "http://localhost:1234/v1",
		defaultModel: "local-model",
		apiKeyEnvHint: "(not required for local)",
	},
	[LlmProvider.TOGETHER]: {
		baseUrl: "https://api.together.xyz/v1",
		defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
		apiKeyEnvHint: "...",
	},
	[LlmProvider.CUSTOM]: {
		baseUrl: "http://localhost:8000/v1",
		defaultModel: "default",
		apiKeyEnvHint: "...",
	},
};

// ---------------------------------------------------------------------------
// Provider auto-detection from base URL
// ---------------------------------------------------------------------------

export const detectProvider = (baseUrl: string): LlmProvider => {
	const url = baseUrl.toLowerCase();
	if (url.includes("anthropic.com")) return LlmProvider.ANTHROPIC;
	if (url.includes("openrouter.ai")) return LlmProvider.OPENROUTER;
	if (url.includes("generativelanguage.googleapis.com")) return LlmProvider.GEMINI;
	if (url.includes("api.x.ai")) return LlmProvider.GROK;
	if (url.includes("api.openai.com")) return LlmProvider.OPENAI;
	if (url.includes("api.together.xyz")) return LlmProvider.TOGETHER;
	if (url.includes("localhost:11434")) return LlmProvider.OLLAMA;
	if (url.includes("localhost:1234")) return LlmProvider.LM_STUDIO;
	return LlmProvider.CUSTOM;
};

// ---------------------------------------------------------------------------
// Provider-specific request building
// ---------------------------------------------------------------------------

interface ProviderRequest {
	url: string;
	headers: Record<string, string>;
	body: string;
}

export const buildProviderRequest = (
	provider: LlmProvider,
	config: LlmConfig,
	messages: ChatMessage[],
): ProviderRequest => {
	const baseUrl = config.baseUrl.replace(/\/+$/, "");
	if (provider === LlmProvider.ANTHROPIC) return buildAnthropicRequest(baseUrl, config, messages);
	return buildOpenAiRequest(baseUrl, config, messages, provider);
};

const buildAnthropicRequest = (
	baseUrl: string,
	config: LlmConfig,
	messages: ChatMessage[],
): ProviderRequest => {
	const systemParts = messages.filter((m) => m.role === ChatRole.SYSTEM);
	const nonSystem = messages.filter((m) => m.role !== ChatRole.SYSTEM);
	const systemText = systemParts.map((m) => m.content).join("\n\n");

	return {
		url: `${baseUrl}/v1/messages`,
		headers: {
			"Content-Type": "application/json",
			"x-api-key": config.apiKey,
			"anthropic-version": "2023-06-01",
		},
		body: JSON.stringify({
			model: config.model,
			max_tokens: config.maxTokens ?? 4096,
			...(systemText ? { system: systemText } : {}),
			messages: nonSystem.map((m) => ({ role: m.role, content: m.content })),
		}),
	};
};

const buildOpenAiRequest = (
	baseUrl: string,
	config: LlmConfig,
	messages: ChatMessage[],
	provider: LlmProvider,
): ProviderRequest => {
	const headers: Record<string, string> = { "Content-Type": "application/json" };

	if (config.apiKey) {
		headers.Authorization = `Bearer ${config.apiKey}`;
	}

	if (provider === LlmProvider.OPENROUTER) {
		headers["HTTP-Referer"] = "https://sndv.xyz";
		headers["X-Title"] = "sndv-nano";
	}

	return {
		url: `${baseUrl}/chat/completions`,
		headers,
		body: JSON.stringify({
			model: config.model,
			messages,
			temperature: config.temperature,
			max_tokens: config.maxTokens,
		}),
	};
};

// ---------------------------------------------------------------------------
// Provider-specific response parsing
// ---------------------------------------------------------------------------

interface AnthropicResponse {
	content: Array<{ type: string; text: string }>;
	stop_reason: string;
	usage?: { input_tokens: number; output_tokens: number };
}

export const parseProviderResponse = (provider: LlmProvider, data: unknown): string => {
	if (provider === LlmProvider.ANTHROPIC) {
		const res = data as AnthropicResponse;
		const textBlock = res.content?.find((c) => c.type === "text");
		if (!textBlock?.text) throw SmepErrors.llmResponseParseFailed("Empty Anthropic response");
		return textBlock.text;
	}

	const res = data as ChatCompletionResponse;
	const content = res.choices?.[0]?.message?.content;
	if (!content) throw SmepErrors.llmResponseParseFailed("Empty response from LLM");
	return content;
};
