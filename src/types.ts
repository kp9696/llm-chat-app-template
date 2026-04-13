/**
 * Type definitions for the LLM chat application.
 */

export interface Env {
	/**
	 * Binding for the Workers AI API.
	 */
	AI: Ai;

	/**
	 * Optional OpenRouter API key used as fallback when Workers AI is unavailable.
	 */
	OPENROUTER_API_KEY?: string;

	/**
	 * Optional OpenRouter model override for fallback requests.
	 */
	OPENROUTER_MODEL?: string;

	/**
	 * Binding for static assets.
	 */
	ASSETS: { fetch: (request: Request) => Promise<Response> };
}

/**
 * Represents a chat message.
 */
export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}
