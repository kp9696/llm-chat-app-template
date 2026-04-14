/**
 * JwithKP AI Chat — Frontend
 */

// ── Robot avatar SVG ──
const ROBOT_SVG = `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
	<line x1="16" y1="2" x2="16" y2="7" stroke="#f47920" stroke-width="1.5" stroke-linecap="round"/>
	<circle cx="16" cy="1.8" r="1.8" fill="#f47920"/>
	<rect x="4" y="7" width="24" height="19" rx="4" fill="#1e3a6e" stroke="#f47920" stroke-width="1"/>
	<circle class="eye" cx="11.5" cy="15.5" r="3" fill="#f47920"/>
	<circle class="eye" cx="20.5" cy="15.5" r="3" fill="#f47920"/>
	<circle cx="12.2" cy="14.8" r="1.2" fill="#fff"/>
	<circle cx="21.2" cy="14.8" r="1.2" fill="#fff"/>
	<rect x="8" y="21" width="16" height="3" rx="1.5" fill="#f47920" opacity="0.75"/>
	<rect x="10.5" y="21.5" width="1.8" height="2" rx="0.5" fill="#0f1826"/>
	<rect x="14" y="21.5" width="1.8" height="2" rx="0.5" fill="#0f1826"/>
	<rect x="17.5" y="21.5" width="1.8" height="2" rx="0.5" fill="#0f1826"/>
	<circle cx="4" cy="15.5" r="2" fill="#f47920"/>
	<circle cx="28" cy="15.5" r="2" fill="#f47920"/>
</svg>`;

// ── Icon SVGs ──
const COPY_SVG  = `<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
const CHECK_SVG = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`;
const UP_SVG    = `<svg viewBox="0 0 24 24"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>`;
const DOWN_SVG  = `<svg viewBox="0 0 24 24"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L10.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg>`;

// ── DOM refs ──
const chatMessages = document.getElementById("chat-messages");
const userInput    = document.getElementById("user-input");
const sendButton   = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");
const newChatBtn   = document.getElementById("new-chat-btn");
const exportBtn    = document.getElementById("export-btn");
const scrollBtn    = document.getElementById("scroll-btn");

// ── State ──
const STORAGE_KEY = "jwithkp_chat_history";
const WELCOME_MSG = "Hello! I'm the JwithKP AI assistant. How can I help you on your journey with knowledge & practice today?";
let chatHistory  = [{ role: "assistant", content: WELCOME_MSG }];
let isProcessing = false;
let autoScroll   = true;

// ── marked.js config ──
marked.setOptions({ breaks: true, gfm: true });

// ── Helpers ──
function formatTime() {
	return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderMarkdown(text) {
	const div = document.createElement("div");
	div.className = "msg-body";
	const unsafeHtml = marked.parse(text);
	const safeHtml = typeof DOMPurify !== "undefined"
		? DOMPurify.sanitize(unsafeHtml)
		: unsafeHtml;
	div.innerHTML = safeHtml;
	div.querySelectorAll("pre code").forEach(el => hljs.highlightElement(el));
	return div;
}

function scrollToBottom() {
	if (autoScroll) chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ── Auto-scroll + jump button ──
chatMessages.addEventListener("scroll", () => {
	const gap = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight;
	autoScroll = gap < 80;
	scrollBtn.classList.toggle("visible", !autoScroll);
});

scrollBtn.addEventListener("click", () => {
	autoScroll = true;
	chatMessages.scrollTop = chatMessages.scrollHeight;
	scrollBtn.classList.remove("visible");
});

// ── Message builders ──
function buildUserWrapper(content) {
	const wrapper = document.createElement("div");
	wrapper.className = "message-wrapper user-wrapper";
	const p = document.createElement("p");
	p.textContent = content;
	const bubble = document.createElement("div");
	bubble.className = "message user-message";
	bubble.appendChild(p);
	const timeEl = document.createElement("span");
	timeEl.className = "msg-time";
	timeEl.textContent = formatTime();
	const group = document.createElement("div");
	group.className = "bubble-group";
	group.appendChild(bubble);
	group.appendChild(timeEl);
	const avatar = document.createElement("div");
	avatar.className = "avatar avatar-user";
	avatar.textContent = "U";
	wrapper.appendChild(avatar);
	wrapper.appendChild(group);
	return wrapper;
}

function buildAiWrapper(content, isStreaming = false) {
	const wrapper = document.createElement("div");
	wrapper.className = "message-wrapper";

	// Avatar
	const avatar = document.createElement("div");
	avatar.className = "avatar avatar-ai";
	avatar.innerHTML = ROBOT_SVG;

	// Message body
	let msgBody;
	if (isStreaming) {
		msgBody = document.createElement("div");
		msgBody.className = "msg-body streaming-cursor";
		const p = document.createElement("p");
		msgBody.appendChild(p);
	} else {
		msgBody = renderMarkdown(content);
	}

	// Actions bar
	const actions = document.createElement("div");
	actions.className = "msg-actions";
	actions.innerHTML = `
		<button class="copy-btn" title="Copy message">${COPY_SVG}</button>
		<span class="action-sep"></span>
		<button class="fb-btn" data-v="up" title="Good response">${UP_SVG}</button>
		<button class="fb-btn" data-v="down" title="Poor response">${DOWN_SVG}</button>`;

	// Bubble
	const bubble = document.createElement("div");
	bubble.className = "message assistant-message";
	bubble.appendChild(msgBody);
	bubble.appendChild(actions);

	// Time
	const timeEl = document.createElement("span");
	timeEl.className = "msg-time";
	timeEl.textContent = formatTime();

	// Group
	const group = document.createElement("div");
	group.className = "bubble-group";
	group.appendChild(bubble);
	group.appendChild(timeEl);

	wrapper.appendChild(avatar);
	wrapper.appendChild(group);

	// Copy handler
	const copyBtn = actions.querySelector(".copy-btn");
	copyBtn.addEventListener("click", () => {
		const text = wrapper.querySelector(".msg-body").textContent;
		navigator.clipboard.writeText(text).then(() => {
			copyBtn.innerHTML = CHECK_SVG;
			copyBtn.classList.add("copied");
			setTimeout(() => { copyBtn.innerHTML = COPY_SVG; copyBtn.classList.remove("copied"); }, 2000);
		});
	});

	// Feedback handlers
	actions.querySelectorAll(".fb-btn").forEach(btn => {
		btn.addEventListener("click", () => {
			actions.querySelectorAll(".fb-btn").forEach(b => b.classList.remove("active-up", "active-down"));
			btn.classList.add(btn.dataset.v === "up" ? "active-up" : "active-down");
		});
	});

	return wrapper;
}

// ── Add message to chat ──
function addMessageToChat(role, content) {
	const wrapper = role === "user" ? buildUserWrapper(content) : buildAiWrapper(content);
	chatMessages.appendChild(wrapper);
	scrollToBottom();
}

// ── localStorage ──
function saveHistory() {
	try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory)); } catch (_) {}
}

function loadHistory() {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			const parsed = JSON.parse(saved);
			if (Array.isArray(parsed) && parsed.length > 0) chatHistory = parsed;
		}
	} catch (_) {}
	// Always render from chatHistory (clears initial HTML placeholder)
	chatMessages.innerHTML = "";
	for (const msg of chatHistory) addMessageToChat(msg.role, msg.content);
}

function clearHistory() {
	chatHistory = [{ role: "assistant", content: WELCOME_MSG }];
	localStorage.removeItem(STORAGE_KEY);
	chatMessages.innerHTML = "";
	addMessageToChat("assistant", WELCOME_MSG);
}

// ── Export ──
function exportChat() {
	const content = chatHistory
		.map(m => `### ${m.role === "user" ? "You" : "JwithKP AI"}\n\n${m.content}`)
		.join("\n\n---\n\n");
	const doc = `# JwithKP AI — Chat Export\n_Exported: ${new Date().toLocaleString()}_\n\n---\n\n${content}`;
	const blob = new Blob([doc], { type: "text/markdown" });
	const url  = URL.createObjectURL(blob);
	const a    = document.createElement("a");
	a.href = url;
	a.download = `jwithkp-chat-${new Date().toISOString().slice(0, 10)}.md`;
	a.click();
	URL.revokeObjectURL(url);
}

// ── Button wiring ──
newChatBtn.addEventListener("click", () => { if (!isProcessing) { clearHistory(); userInput.focus(); } });
exportBtn.addEventListener("click", exportChat);

// ── Input handlers ──
userInput.addEventListener("input", function () {
	this.style.height = "auto";
	this.style.height = this.scrollHeight + "px";
});

userInput.addEventListener("keydown", function (e) {
	if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

sendButton.addEventListener("click", sendMessage);

// ── Send message ──
async function sendMessage() {
	const message = userInput.value.trim();
	if (!message || isProcessing) return;

	isProcessing = true;
	userInput.disabled = true;
	sendButton.disabled = true;

	addMessageToChat("user", message);
	userInput.value = "";
	userInput.style.height = "auto";
	typingIndicator.classList.add("visible");
	chatHistory.push({ role: "user", content: message });
	saveHistory();

	try {
		// Build streaming wrapper
		const wrapperEl  = buildAiWrapper("", true);
		chatMessages.appendChild(wrapperEl);
		const msgBodyEl   = wrapperEl.querySelector(".msg-body");
		const streamingP  = msgBodyEl.querySelector("p");
		autoScroll = true;
		scrollToBottom();

		const response = await fetch("/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ messages: chatHistory }),
		});

		if (!response.ok)   throw new Error("Failed to get response");
		if (!response.body) throw new Error("Response body is null");

		const reader  = response.body.getReader();
		const decoder = new TextDecoder();
		let responseText = "";
		let buffer = "";

		const flush = () => { streamingP.textContent = responseText; scrollToBottom(); };

		let sawDone = false;
		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				const parsed = consumeSseEvents(buffer + "\n\n");
				for (const data of parsed.events) {
					if (data === "[DONE]") break;
					try {
						const j = JSON.parse(data);
						const c = (typeof j.response === "string" && j.response) || j.choices?.[0]?.delta?.content || "";
						if (c) { responseText += c; flush(); }
					} catch (_) {}
				}
				break;
			}

			buffer += decoder.decode(value, { stream: true });
			const parsed = consumeSseEvents(buffer);
			buffer = parsed.buffer;
			for (const data of parsed.events) {
				if (data === "[DONE]") { sawDone = true; buffer = ""; break; }
				try {
					const j = JSON.parse(data);
					const c = (typeof j.response === "string" && j.response) || j.choices?.[0]?.delta?.content || "";
					if (c) { responseText += c; flush(); }
				} catch (_) {}
			}
			if (sawDone) break;
		}

		// Replace streaming plain-text with rendered markdown
		if (responseText.length > 0) {
			const rendered = renderMarkdown(responseText);
			msgBodyEl.replaceWith(rendered);
			scrollToBottom();
			chatHistory.push({ role: "assistant", content: responseText });
			saveHistory();
		}

	} catch (error) {
		console.error("Error:", error);
		addMessageToChat("assistant", "Sorry, there was an error processing your request.");
	} finally {
		typingIndicator.classList.remove("visible");
		isProcessing  = false;
		userInput.disabled = false;
		sendButton.disabled = false;
		userInput.focus();
	}
}

// ── SSE parser ──
function consumeSseEvents(buffer) {
	let normalized = buffer.replace(/\r/g, "");
	const events = [];
	let idx;
	while ((idx = normalized.indexOf("\n\n")) !== -1) {
		const raw = normalized.slice(0, idx);
		normalized = normalized.slice(idx + 2);
		const dataLines = raw.split("\n")
			.filter(l => l.startsWith("data:"))
			.map(l => l.slice("data:".length).trimStart());
		if (dataLines.length) events.push(dataLines.join("\n"));
	}
	return { events, buffer: normalized };
}

// ── Init ──
loadHistory();
