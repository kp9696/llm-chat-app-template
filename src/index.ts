/**
 * LLM Chat Application Template
 *
 * A simple chat application using Cloudflare Workers AI.
 * This template demonstrates how to implement an LLM-powered chat interface with
 * streaming responses using Server-Sent Events (SSE).
 *
 * @license MIT
 */
import { Env, ChatMessage } from "./types";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_PRIMARY_MODEL = "google/gemma-4-26b-a4b-it:free";

// Cloudflare Workers AI model used as fallback
// https://developers.cloudflare.com/workers-ai/models/
const CF_FALLBACK_MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

// Default system prompt
const SYSTEM_PROMPT =
	"You are a helpful, friendly assistant. Provide concise and accurate responses.";

export default {
	/**
	 * Main request handler for the Worker
	 */
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// Handle static assets (frontend)
		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		// API Routes
		if (url.pathname === "/api/chat") {
			// Handle POST requests for chat
			if (request.method === "POST") {
				return handleChatRequest(request, env);
			}

			// Method not allowed for other request types
			return new Response("Method not allowed", { status: 405 });
		}

		// Handle 404 for unmatched routes
		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;

/**
 * Handles chat API requests
 */
async function handleChatRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	let messages: ChatMessage[] = [];

	// Parse JSON request body
	const payload = (await request.json()) as {
		messages: ChatMessage[];
	};
	messages = payload.messages ?? [];

	// Add system prompt if not present
	if (!messages.some((msg) => msg.role === "system")) {
		messages.unshift({ role: "system", content: SYSTEM_PROMPT });
	}

	// --- Primary: OpenRouter ---
	if (env.OPENROUTER_API_KEY) {
		try {
			return await handleOpenRouterRequest(messages, env);
		} catch (error) {
			console.error("OpenRouter primary failed, trying Cloudflare AI fallback:", error);
		}
	}

	// --- Fallback: Cloudflare Workers AI ---
	try {
		const stream = await env.AI.run(
			CF_FALLBACK_MODEL_ID,
			{
				messages,
				max_tokens: 1024,
				stream: true,
			},
			{
				// Uncomment to use AI Gateway
				// gateway: {
				//   id: "YOUR_GATEWAY_ID", // Replace with your AI Gateway ID
				//   skipCache: false,      // Set to true to bypass cache
				//   cacheTtl: 3600,        // Cache time-to-live in seconds
				// },
			},
		);

		return new Response(stream, {
			headers: getSseHeaders(),
		});
	} catch (error) {
		console.error("Cloudflare AI fallback also failed:", error);
		return new Response(
			JSON.stringify({ error: "Failed to process request" }),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			},
		);
	}
}

function getSseHeaders(): HeadersInit {
	return {
		"content-type": "text/event-stream; charset=utf-8",
		"cache-control": "no-cache",
		connection: "keep-alive",
	};
}

async function handleOpenRouterRequest(
	messages: ChatMessage[],
	env: Env,
): Promise<Response> {
	const model = env.OPENROUTER_MODEL ?? OPENROUTER_PRIMARY_MODEL;
	const response = await fetch(OPENROUTER_API_URL, {
		method: "POST",
		headers: {
			authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
			"content-type": "application/json",
			"http-referer": "https://workers.cloudflare.com/",
			"x-title": "llm-chat-app-template",
		},
		body: JSON.stringify({
			model,
			messages,
			stream: true,
		}),
	});

	if (!response.ok || !response.body) {
		const errorText = await response.text();
		throw new Error(`OpenRouter request error: ${response.status} ${errorText}`);
	}

	return new Response(response.body, {
		headers: getSseHeaders(),
	});
}
