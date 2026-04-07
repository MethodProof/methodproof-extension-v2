/** Cursor web UI interaction observer */

import { isModuleEnabled, sendEvent, addMetric, recordPlatform, trackVisibility, getInputLength, waitForStable, isJournal } from "./shared";

const PLATFORM = "cursor";

if (["cursor.sh", "www.cursor.sh", "cursor.com", "www.cursor.com"].includes(location.hostname)) {
  isModuleEnabled().then(ok => ok && activate());
}

function activate(): void {
  recordPlatform(PLATFORM);
  trackVisibility();

  const getInput = (): Element | null =>
    document.querySelector('textarea, [contenteditable="true"], [role="textbox"]');

  const getResponses = (): NodeListOf<Element> =>
    document.querySelectorAll('[class*="assistant"], [class*="response"], [class*="bot-message"]');

  // Prompt detection
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter" || e.shiftKey) return;
    const input = getInput();
    if (!input || document.activeElement !== input) return;
    const len = getInputLength(input);
    const promptText = input?.textContent ?? "";
    if (len > 0) watchResponse(len, promptText, Date.now(), getResponses().length, getResponses);
  }, true);

  // Code suggestion acceptance
  document.addEventListener("click", e => {
    const btn = (e.target as HTMLElement).closest("button");
    if (!btn) return;
    const label = (btn.getAttribute("aria-label") ?? btn.textContent ?? "").toLowerCase();
    if (label.includes("copy") || label.includes("apply") || label.includes("accept")) {
      sendEvent("ai_response_accept", {
        platform: PLATFORM,
        action: label.includes("copy") ? "copy" : label.includes("accept") ? "accept" : "apply",
        content_length: btn.closest("pre, [class*='code']")?.textContent?.length ?? 0,
      });
      addMetric("accepts");
    }
  }, true);
}

function watchResponse(
  promptLen: number, promptText: string, sentAt: number, startCount: number,
  getResponses: () => NodeListOf<Element>,
): void {
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
