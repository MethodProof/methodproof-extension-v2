/** MethodProof content script — copy, search, and AI chat detection */

function send(eventType: string, data: Record<string, unknown>): void {
  chrome.runtime.sendMessage({ type: "content_event", event_type: eventType, data }).catch(() => {
    // Background may be inactive (no session) — event intentionally dropped
  });
}

// --- Copy detection ---
document.addEventListener("copy", () => {
  const selection = document.getSelection()?.toString() ?? "";
  if (!selection) return;
  send("browser_copy", {
    source_url: location.href,
    source_domain: location.hostname,
    text_length: selection.length,
    text_snippet: selection.slice(0, 100),
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
  send("browser_search", { engine, query });
}

// --- AI chat detection ---
const AI_PLATFORMS: Record<string, string> = {
  "chat.openai.com": "chatgpt", "chatgpt.com": "chatgpt",
  "claude.ai": "claude",
  "perplexity.ai": "perplexity",
};

function detectAiChat(): void {
  const platform = AI_PLATFORMS[location.hostname];
  if (!platform) return;
  send("browser_ai_chat", { platform, url: location.href });
}

// Run detections on page load
detectSearch();
detectAiChat();
