import { detectMusic } from './music';
/** MethodProof content script — copy, search, and AI chat detection */

function send(eventType: string, data: Record<string, unknown>): void {
  chrome.runtime.sendMessage({ type: "content_event", event_type: eventType, data }).catch(() => {
    // Background may be inactive (no session) — event intentionally dropped
  });
}

let _journalCache: boolean | null = null;
async function isJournal(): Promise<boolean> {
  if (_journalCache !== null) return _journalCache;
  try {
    const resp = await chrome.runtime.sendMessage({ type: "get_session" });
    _journalCache = resp?.journal ?? false;
    return _journalCache;
  } catch { return false; }
}
// Reset cache when session changes
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "session_changed") _journalCache = null;
});

// --- Copy detection ---
document.addEventListener("copy", () => {
  const selection = document.getSelection()?.toString() ?? "";
  if (!selection) return;
  const data: Record<string, unknown> = {
    source_url: location.hostname,
    source_domain: location.hostname,
    text_length: selection.length,
    text_snippet: "",
  };
  isJournal().then(j => {
    if (j) data.text_snippet = selection.slice(0, 500);
    send("browser_copy", data);
  });
});

// --- Search query extraction ---
const SEARCH_ENGINES: Record<string, string> = {
  "www.google.com": "google", "google.com": "google",
  "www.bing.com": "bing", "bing.com": "bing",
  "duckduckgo.com": "duckduckgo", "www.duckduckgo.com": "duckduckgo",
};

function detectSearch(): void {
  const engine = SEARCH_ENGINES[location.hostname];
  if (!engine) return;
  const query = new URLSearchParams(location.search).get("q");
  if (!query) return;
  const data: Record<string, unknown> = {
    engine, query_length: query.length, word_count: query.split(/\s+/).length, result_count: 0,
  };
  isJournal().then(j => {
    if (j) data.query = query;
    send("browser_search", data);
  });
}

// --- AI chat detection (platform only, no URL path) ---
const AI_PLATFORMS: Record<string, string> = {
  "chat.openai.com": "chatgpt", "chatgpt.com": "chatgpt",
  "claude.ai": "claude",
  "perplexity.ai": "perplexity",
};

function detectAiChat(): void {
  const platform = AI_PLATFORMS[location.hostname];
  if (!platform) return;
  send("browser_ai_chat", { platform, url: location.hostname, detected_input: false });
}

// --- CLI pairing detection (localhost:9877/pair) ---
function detectPairing(): void {
  if (location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;
  if (!location.port || location.port !== "9877") return;
  if (!location.pathname.startsWith("/pair")) return;

  const el = document.getElementById("methodproof-pair-data");
  if (!el) return;

  const sessionId = el.dataset.sessionId;
  const token = el.dataset.token;
  const apiBase = el.dataset.apiBase;
  const e2eKey = el.dataset.e2eKey;
  const journal = el.dataset.journal === "true";
  if (!sessionId || !token || !apiBase) return;

  chrome.runtime.sendMessage(
    { type: "activate", session_id: sessionId, token, api_base: apiBase, e2e_key: e2eKey || undefined, journal },
    () => { window.dispatchEvent(new Event("methodproof-paired")); },
  );
}

// --- Bridge discovery: wake background to check for CLI sessions ---
function triggerDiscovery(): void {
  chrome.runtime.sendMessage({ type: "check_bridge" }).catch(() => {});
}

// Run detections on page load
detectSearch();
detectAiChat();
detectMusic();
detectPairing();
triggerDiscovery();
