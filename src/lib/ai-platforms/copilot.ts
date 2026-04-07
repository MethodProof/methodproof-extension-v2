/** GitHub Copilot Chat interaction observer */

import { isModuleEnabled, sendEvent, addMetric, recordPlatform, trackVisibility, getInputLength, waitForStable, isJournal } from "./shared";

const PLATFORM = "copilot";

// Runs on github.com but only activates if copilot chat panel is present
if (location.hostname === "github.com") {
  isModuleEnabled().then(ok => {
    if (!ok) return;
    waitForPanel(activate);
  });
}

function waitForPanel(cb: (panel: Element) => void): void {
  const find = () => document.querySelector('[class*="copilot-chat"], [id*="copilot"], .copilot-chat-panel');
  const existing = find();
  if (existing) { cb(existing); return; }
  const check = setInterval(() => {
    const el = find();
    if (el) { clearInterval(check); cb(el); }
  }, 2000);
  setTimeout(() => clearInterval(check), 30_000);
}

function activate(panel: Element): void {
  recordPlatform(PLATFORM);
  trackVisibility();

  const getInput = (): Element | null =>
    panel.querySelector('textarea, [contenteditable="true"], [role="textbox"]');

  const getMessages = (): NodeListOf<Element> =>
    panel.querySelectorAll('[class*="message"], [class*="response"], [class*="answer"]');

  // Prompt detection
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter" || e.shiftKey) return;
    const input = getInput();
    if (!input || document.activeElement !== input) return;
    const len = getInputLength(input);
    const promptText = input?.textContent ?? "";
    if (len > 0) watchResponse(len, promptText, Date.now(), getMessages().length, getMessages);
  }, true);

  // Code suggestion acceptance
  document.addEventListener("click", e => {
    const btn = (e.target as HTMLElement).closest("button");
    if (!btn || !panel.contains(btn)) return;
    const label = (btn.getAttribute("aria-label") ?? btn.textContent ?? "").toLowerCase();
    if (label.includes("copy") || label.includes("insert") || label.includes("apply")) {
      sendEvent("ai_response_accept", {
        platform: PLATFORM,
        action: label.includes("copy") ? "copy" : label.includes("insert") ? "insert" : "apply",
        content_length: btn.closest("pre, [class*='code']")?.textContent?.length ?? 0,
      });
      addMetric("accepts");
    }
  }, true);
}

function watchResponse(
  promptLen: number, promptText: string, sentAt: number, startCount: number,
  getMessages: () => NodeListOf<Element>,
): void {
  const poll = setInterval(() => {
    const msgs = getMessages();
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
