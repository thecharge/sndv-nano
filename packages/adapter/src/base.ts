import {
	type ChatMessage,
	ChatRole,
	DEFAULT_LLM_BASE_URL,
	DEFAULT_LLM_MAX_TOKENS,
	DEFAULT_LLM_MODEL,
	DEFAULT_LLM_TEMPERATURE,
	ENV_LLM_API_KEY,
	ENV_LLM_BASE_URL,
	ENV_LLM_MODEL,
	type LlmConfig,
	SmepErrors,
	type TaskVerdict,
	VerdictStatus,
} from "@thecharge/sndv-config";
import { buildProviderRequest, detectProvider, parseProviderResponse } from "./providers";

/**
 * fetch()-based LLM client. Vendor-agnostic.
 *
 * Auto-detects provider from base URL and handles:
 *  - OpenAI, Ollama, LM Studio, vLLM, Together (OpenAI-compatible)
 *  - Google Gemini (OpenAI-compatible endpoint)
 *  - xAI Grok (OpenAI-compatible)
 *  - OpenRouter (OpenAI-compatible + extra headers)
 *  - Anthropic Claude (native Messages API)
 *
 * Configure via environment variables:
 *   SNDV_LLM_API_KEY   - API key
 *   SNDV_LLM_BASE_URL  - endpoint (default: http://localhost:11434/v1)
 *   SNDV_LLM_MODEL     - model name (default: "default")
 */
export class LlmClient {
	private readonly config: LlmConfig;

	constructor(config: Partial<LlmConfig> = {}) {
		this.config = {
			apiKey: config.apiKey ?? process.env[ENV_LLM_API_KEY] ?? "",
			baseUrl: config.baseUrl ?? process.env[ENV_LLM_BASE_URL] ?? DEFAULT_LLM_BASE_URL,
			model: config.model ?? process.env[ENV_LLM_MODEL] ?? DEFAULT_LLM_MODEL,
			temperature: config.temperature ?? DEFAULT_LLM_TEMPERATURE,
			maxTokens: config.maxTokens ?? DEFAULT_LLM_MAX_TOKENS,
		};
	}

	/** Send messages and get a text response. Provider auto-detected. */
	chat = async (messages: ChatMessage[]): Promise<string> => {
		const provider = detectProvider(this.config.baseUrl);
		const { url, headers, body } = buildProviderRequest(provider, this.config, messages);

		const response = await fetch(url, { method: "POST", headers, body });
		if (!response.ok) {
			const responseBody = await response.text().catch(() => "unknown");
			throw SmepErrors.llmRequestFailed(response.status, responseBody);
		}

		const data: unknown = await response.json();
		return parseProviderResponse(provider, data);
	};

	/** Ask the LLM to judge a task. Returns a structured verdict. */
	judgeTask = async (
		systemPrompt: string,
		taskName: string,
		taskDescription: string,
		memoryContext: string,
	): Promise<TaskVerdict> => {
		const messages: ChatMessage[] = [{ role: ChatRole.SYSTEM, content: systemPrompt }];

		if (memoryContext) {
			messages.push({ role: ChatRole.USER, content: memoryContext });
		}

		messages.push({
			role: ChatRole.USER,
			content: [
				`Evaluate task: \`${taskName}\``,
				"",
				taskDescription,
				"",
				"TRY TO BREAK THIS - look for why it would fail, not why it would work.",
				"",
				"Respond in valid JSON:",
				'{"task":"<name>","status":"verified"|"falsified","evidence":{"key":"value"},"reason":"..."}',
			].join("\n"),
		});

		const raw = await this.chat(messages);
		return this.parseVerdict(raw, taskName);
	};

	private parseVerdict = (raw: string, taskName: string): TaskVerdict => {
		const jsonMatch = raw.match(/\{[\s\S]*\}/);
		if (!jsonMatch) throw SmepErrors.llmResponseParseFailed(raw);

		const parsed = JSON.parse(jsonMatch[0]);
		return {
			task: parsed.task ?? taskName,
			status: parsed.status === "falsified" ? VerdictStatus.FALSIFIED : VerdictStatus.VERIFIED,
			evidence: parsed.evidence ?? {},
			reason: parsed.reason,
		};
	};
}
