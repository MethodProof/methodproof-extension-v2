/** ChatGPT interaction observer — structural metrics only, never captures content */

import { isModuleEnabled, sendEvent, addMetric, recordPlatform, trackVisibility, getInputLength, waitForStable, isJournal } from "./shared";

const PLATFORM = "chatgpt";

if (["chat.openai.com", "chatgpt.com"].includes(location.hostname)) {
  isModuleEnabled().then(ok => ok && activate());
}

function activate(): void {
  recordPlatform(PLATFORM);
  trackVisibility();
  observePrompts();
  observeCopyButtons();
}

function getResponses(): NodeListOf<Element> {
  return document.querySelectorAll('[data-message-author-role="assistant"]');
}

function observePrompts(): void {
  const submit = () => {
    const input = document.querySelector("#prompt-textarea, [contenteditable]");
    const len = getInputLength(input);
    const promptText = input?.textContent ?? "";
    if (len > 0) watchResponse(len, promptText, Date.now(), getResponses().length);
  };

  document.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey && document.activeElement?.matches("#prompt-textarea, [contenteditable]")) {
      setTimeout(submit, 50);
    }
  }, true);

  document.addEventListener("click", e => {
    if ((e.target as HTMLElement).closest('button[data-testid="send-button"], form button[type="submit"]')) submit();
  }, true);
}

function watchResponse(promptLen: number, promptText: string, sentAt: number, startCount: number): void {
  const poll = setInterval(() => {
    const msgs = getResponses();
    if (msgs.length <= startCount) return;
    clearInterval(poll);
    const last = msgs[msgs.length - 1];
    waitForStable(() => last, async responseLen => {
      const waitMs = Date.now() - sentAt;
      const data: Record<string, unknown> = {
        platform: PLATFORM, prompt_length: promptLen,
        response_length: responseLen, response_wait_ms: waitMs,
        model_indicator: detectModel(),
      };
      if (await isJournal()) {
        data.prompt_text = promptText;
        data.response_text = (last.textContent ?? "").slice(0, 5000);
      }
      sendEvent("ai_prompt_cycle", data);
      addMetric("prompts_sent");
      addMetric("total_response_wait_ms", waitMs);
    });
  }, 300);
  setTimeout(() => clearInterval(poll), 300_000);
}

function detectModel(): string {
  const el = document.querySelector('[data-testid="model-switcher"] span, [class*="model-switcher"]');
  return el?.textContent?.trim() ?? "unknown";
}

function observeCopyButtons(): void {
  document.addEventListener("click", async e => {
    const btn = (e.target as HTMLElement).closest("button");
    if (!btn) return;
    const label = (btn.getAttribute("aria-label") ?? "").toLowerCase();
    if (!label.includes("copy")) return;
    const isCode = !!btn.closest("pre");
    const container = btn.closest('pre, [data-message-author-role="assistant"]');
    const content = container?.textContent ?? "";
    const data: Record<string, unknown> = {
      platform: PLATFORM, action: "copy",
      section: isCode ? "code_block" : "response",
      content_length: content.length,
    };
    if (await isJournal()) data.content_snippet = content.slice(0, 2000);
    sendEvent("ai_response_accept", data);
    addMetric("accepts");
  }, true);
}
