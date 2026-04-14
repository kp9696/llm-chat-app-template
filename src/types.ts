/**
 * Type definitions for the LLM chat application.
 */

export interface Env {
	/**
	 * Binding for the Workers AI API.
	 */
	AI: Ai;

	/**
	 * Optional OpenRouter API key used as the primary provider when present.
	 */
	OPENROUTER_API_KEY?: string;

	/**
	 * Optional OpenRouter model override for OpenRouter requests.
	 */
	OPENROUTER_MODEL?: string;

	/**
	 * Optional API key for admin ingestion endpoints.
	 */
	INGEST_API_KEY?: string;

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
