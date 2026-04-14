/**
 * JwithKP AI Chat — Frontend
 */

// ── AI avatar ──
const ROBOT_EMOJI = "🤖";

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
const themeToggleBtn = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");
const themeLabel = document.getElementById("theme-label");
const userChipEl = document.getElementById("user-chip");
const userChipName = document.getElementById("user-chip-name");
const userChipAvatar = document.getElementById("user-chip-avatar");
const changeUserBtn = document.getElementById("change-user-btn");

// ── State ──
const STORAGE_KEY = "jwithkp_chat_history";
const THEME_KEY = "zhivo_theme";
const USER_NAME_KEY = "username";
const HISTORY_LIMIT = 10;
const WELCOME_MSG = "Hello! I'm CTSP AI Powered By JwithKP. How can I help you today?";

function buildWelcomeMsg(name) {
	if (name) {
		return `Hi ${name} 👋 I’m CTSP AI Powered By JwithKP. How can I help you today?`;
	}
	return WELCOME_MSG;
}

function getUserInitials(name) {
	const parts = (name || "User").trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "U";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

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

function applyTheme(theme) {
	document.documentElement.setAttribute("data-theme", theme);
	if (themeLabel) {
		themeLabel.textContent = theme === "dark" ? "Dark" : "Light";
	}
	if (themeIcon) {
		themeIcon.textContent = theme === "dark" ? "🌙" : "☀️";
	}
}

function toggleTheme() {
	const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
	const nextTheme = currentTheme === "dark" ? "light" : "dark";
	applyTheme(nextTheme);
	try {
		localStorage.setItem(THEME_KEY, nextTheme);
	} catch (_) {}
}

function initTheme() {
	let storedTheme = null;
	try {
		storedTheme = localStorage.getItem(THEME_KEY);
	} catch (_) {}

	if (storedTheme === "dark" || storedTheme === "light") {
		applyTheme(storedTheme);
		return;
	}

	const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
	applyTheme(prefersDark ? "dark" : "light");
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
	const currentUserName = checkUser() || "User";
	avatar.textContent = getUserInitials(currentUserName);
	avatar.title = currentUserName;
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
	avatar.innerHTML = `<span class="ai-emoji" aria-hidden="true">${ROBOT_EMOJI}</span>`;

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
	const conversation = chatHistory
		.filter((m) => m.role === "user" || m.role === "assistant")
		.slice(-HISTORY_LIMIT);
	chatHistory = conversation.length > 0 ? conversation : [{ role: "assistant", content: WELCOME_MSG }];
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

	// If nothing in history, use a personalised welcome when we know the user's name
	if (chatHistory.length === 0 || (chatHistory.length === 1 && chatHistory[0].content === WELCOME_MSG)) {
		const name = checkUser();
		chatHistory = [{ role: "assistant", content: name ? buildWelcomeMsg(name) : WELCOME_MSG }];
	}

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
		.map(m => `### ${m.role === "user" ? "You" : "CTSP AI Powered By JwithKP"}\n\n${m.content}`)
		.join("\n\n---\n\n");
	const doc = `# CTSP AI Powered By JwithKP — Chat Export\n_Exported: ${new Date().toLocaleString()}_\n\n---\n\n${content}`;
	const blob = new Blob([doc], { type: "text/markdown" });
	const url  = URL.createObjectURL(blob);
	const a    = document.createElement("a");
	a.href = url;
	a.download = `ctsp-ai-chat-${new Date().toISOString().slice(0, 10)}.md`;
	a.click();
	URL.revokeObjectURL(url);
}

// ── Button wiring ──
newChatBtn.addEventListener("click", () => { if (!isProcessing) { clearHistory(); userInput.focus(); } });
exportBtn.addEventListener("click", exportChat);
if (themeToggleBtn) {
	themeToggleBtn.addEventListener("click", toggleTheme);
}

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
		const username = checkUser() || "User";
		const history = chatHistory
			.slice(0, -1)
			.filter((m) => m.role === "user" || m.role === "assistant")
			.slice(-HISTORY_LIMIT);

		const response = await fetch("/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				message,
				username,
				history,
			}),
		});

		if (!response.ok) throw new Error("Failed to get response");
		const data = await response.json();
		const responseText = typeof data.response === "string" ? data.response : "";

		if (!responseText) throw new Error("Empty AI response");
		addMessageToChat("assistant", responseText);
		chatHistory.push({ role: "assistant", content: responseText });
		saveHistory();

	} catch (error) {
		console.error("Error:", error);
		const fallback = "Sorry, there was an error processing your request.";
		addMessageToChat("assistant", fallback);
		chatHistory.push({ role: "assistant", content: fallback });
		saveHistory();
	} finally {
		typingIndicator.classList.remove("visible");
		isProcessing  = false;
		userInput.disabled = false;
		sendButton.disabled = false;
		userInput.focus();
	}
}

// ── User name helpers ──

/** Save name to localStorage */
function saveName(name) {
	try { localStorage.setItem(USER_NAME_KEY, name); } catch (_) {}
}

/** Return stored name or null */
function checkUser() {
	try { return localStorage.getItem(USER_NAME_KEY) || null; } catch (_) { return null; }
}

/** Clear stored user data and reload */
function resetUser() {
	try {
		localStorage.removeItem(USER_NAME_KEY);
		localStorage.removeItem(STORAGE_KEY);
	} catch (_) {}
	location.reload();
}

/** Show the username chip in the header */
function displayUsername(name) {
	if (!userChipEl || !userChipName || !userChipAvatar || !changeUserBtn) return;
	userChipAvatar.textContent = name.charAt(0).toUpperCase();
	userChipName.textContent = name;
	userChipEl.classList.add("visible");
	changeUserBtn.style.display = "flex";
}

// ── Name modal ──
function initNameModal() {
	// Make page visible regardless — prevents any visibility flicker
	document.body.style.visibility = "visible";
	if (changeUserBtn) changeUserBtn.addEventListener("click", resetUser);

	const modal = document.getElementById("name-modal");
	const input = document.getElementById("modal-name-input");
	const submitBtn = document.getElementById("modal-submit");
	const errorEl = document.getElementById("modal-error");

	const storedName = checkUser();

	// Returning visitor — skip modal & show chip
	if (storedName) {
		displayUsername(storedName);
		return;
	}

	if (!modal || !input || !submitBtn) return;

	// First visit — show modal
	requestAnimationFrame(() => modal.classList.add("open"));
	setTimeout(() => input.focus(), 280);

	function validate() {
		const val = input.value.trim();
		const ok = val.length >= 2;
		submitBtn.disabled = !ok;
		if (ok) {
			input.classList.remove("invalid");
			if (errorEl) errorEl.textContent = "";
		}
		return ok;
	}

	function showError(msg) {
		if (errorEl) errorEl.textContent = msg;
		input.classList.add("invalid");
	}

	function onSubmit() {
		const name = input.value.trim();
		if (name.length < 2) {
			showError("Please enter at least 2 characters.");
			input.focus();
			return;
		}
		saveName(name);
		modal.classList.remove("open");
		displayUsername(name);
		// Personalise the initial history entry shown after modal closes
		chatHistory = [{ role: "assistant", content: buildWelcomeMsg(name) }];
		chatMessages.innerHTML = "";
		addMessageToChat("assistant", chatHistory[0].content);
	}

	input.addEventListener("input", validate);
	submitBtn.addEventListener("click", onSubmit);
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") { e.preventDefault(); onSubmit(); }
	});
}

// ── Init ──
initTheme();
initNameModal();
loadHistory();
