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

const CHUNK_SIZE = 1000;

// Lightweight in-memory store for admin ingestion flows.
// Note: Worker isolates are ephemeral; this is suitable for demo/local use.
const knowledgeBase = new Map<string, string[]>();

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

		if (url.pathname === "/api/ingest") {
			if (request.method === "GET") {
				return handleIngestList();
			}

			if (request.method === "POST") {
				return handleIngestCreate(request, env);
			}

			if (request.method === "DELETE") {
				return handleIngestDelete(request, env);
			}

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
	let payload: { messages?: ChatMessage[] };
	try {
		payload = (await request.json()) as { messages?: ChatMessage[] };
	} catch {
		return jsonResponse({ error: "Invalid JSON payload" }, 400);
	}

	if (!Array.isArray(payload.messages)) {
		return jsonResponse({ error: "Expected 'messages' array" }, 400);
	}

	if (!isValidChatMessageArray(payload.messages)) {
		return jsonResponse({ error: "Invalid message format" }, 400);
	}

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

function handleIngestList(): Response {
	const sources = Array.from(knowledgeBase.entries()).map(([source, chunks]) => ({
		source,
		chunks: chunks.length,
	}));

	return jsonResponse({ sources });
}

async function handleIngestCreate(request: Request, env: Env): Promise<Response> {
	if (!isAuthorized(request, env)) {
		return jsonResponse({ error: "Unauthorized" }, 401);
	}

	let payload: { source?: string; content?: string };
	try {
		payload = (await request.json()) as { source?: string; content?: string };
	} catch {
		return jsonResponse({ error: "Invalid JSON payload" }, 400);
	}

	const source = payload.source?.trim();
	const content = payload.content?.trim();

	if (!source) {
		return jsonResponse({ error: "'source' is required" }, 400);
	}

	if (!content) {
		return jsonResponse({ error: "'content' is required" }, 400);
	}

	const chunks = chunkText(content, CHUNK_SIZE);
	knowledgeBase.set(source, chunks);

	return jsonResponse({
		message: `Ingested '${source}' with ${chunks.length} chunks`,
		source,
		chunks: chunks.length,
	});
}

async function handleIngestDelete(request: Request, env: Env): Promise<Response> {
	if (!isAuthorized(request, env)) {
		return jsonResponse({ error: "Unauthorized" }, 401);
	}

	let payload: { source?: string };
	try {
		payload = (await request.json()) as { source?: string };
	} catch {
		return jsonResponse({ error: "Invalid JSON payload" }, 400);
	}

	const source = payload.source?.trim();
	if (!source) {
		return jsonResponse({ error: "'source' is required" }, 400);
	}

	if (!knowledgeBase.has(source)) {
		return jsonResponse({ error: "Source not found" }, 404);
	}

	knowledgeBase.delete(source);
	return jsonResponse({ message: `Deleted '${source}'` });
}

function isAuthorized(request: Request, env: Env): boolean {
	if (!env.INGEST_API_KEY) {
		return true;
	}

	const authHeader = request.headers.get("authorization");
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return false;
	}

	const token = authHeader.slice("Bearer ".length).trim();
	return token === env.INGEST_API_KEY;
}

function chunkText(content: string, maxChars: number): string[] {
	const normalized = content.replace(/\r\n?/g, "\n").trim();
	if (!normalized) {
		return [];
	}

	const chunks: string[] = [];
	for (let i = 0; i < normalized.length; i += maxChars) {
		chunks.push(normalized.slice(i, i + maxChars));
	}

	return chunks;
}

function isValidChatMessageArray(messages: unknown[]): messages is ChatMessage[] {
	const validRoles = new Set(["system", "user", "assistant"]);

	return messages.every((message) => {
		if (!message || typeof message !== "object") {
			return false;
		}

		const maybeMessage = message as { role?: unknown; content?: unknown };
		return (
			typeof maybeMessage.role === "string" &&
			validRoles.has(maybeMessage.role) &&
			typeof maybeMessage.content === "string"
		);
	});
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

export const __test = {
	chunkText,
	isValidChatMessageArray,
};

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
