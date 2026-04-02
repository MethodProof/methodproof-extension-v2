/** Claude.ai interaction observer — structural metrics only, never captures content */

import { isModuleEnabled, sendEvent, addMetric, recordPlatform, trackVisibility, getInputLength, waitForStable } from "./shared";

const PLATFORM = "claude";

if (location.hostname === "claude.ai" || location.hostname.endsWith(".claude.ai")) {
  isModuleEnabled().then(ok => ok && activate());
}

function activate(): void {
  recordPlatform(PLATFORM);
  trackVisibility();
  observePrompts();
  observeClicks();
}

function getInput(): Element | null {
  return document.querySelector('[contenteditable="true"], .ProseMirror, textarea');
}

function getResponses(): NodeListOf<Element> {
  return document.querySelectorAll('[data-is-streaming], .font-claude-message, [class*="assistant-message"]');
}

function observePrompts(): void {
  const submit = () => {
    const len = getInputLength(getInput());
    if (len > 0) watchResponse(len, Date.now(), getResponses().length);
  };

  document.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey && document.activeElement?.matches('[contenteditable], .ProseMirror, textarea')) {
      setTimeout(submit, 50);
    }
  }, true);

  document.addEventListener("click", e => {
    if ((e.target as HTMLElement).closest('button[aria-label*="Send"], button[type="submit"]')) submit();
  }, true);
}

function watchResponse(promptLen: number, sentAt: number, startCount: number): void {
  const poll = setInterval(() => {
    const responses = getResponses();
    if (responses.length <= startCount) return;
    const last = responses[responses.length - 1];
    if (last.getAttribute("data-is-streaming") === "true") return;
    clearInterval(poll);
    waitForStable(() => last, responseLen => {
      const waitMs = Date.now() - sentAt;
      sendEvent("ai_prompt_cycle", {
        platform: PLATFORM, prompt_length: promptLen,
        response_length: responseLen, response_wait_ms: waitMs,
      });
      addMetric("prompts_sent");
      addMetric("total_response_wait_ms", waitMs);
    });
  }, 300);
  setTimeout(() => clearInterval(poll), 300_000);
}

function observeClicks(): void {
  document.addEventListener("click", e => {
    const btn = (e.target as HTMLElement).closest("button");
    if (!btn) return;
    const label = (btn.getAttribute("aria-label") ?? btn.textContent ?? "").toLowerCase();

    // Copy actions
    if (label.includes("copy")) {
      const isCode = !!btn.closest("pre, code, [class*='code']");
      const container = btn.closest("pre, [class*='message'], [class*='response']");
      sendEvent("ai_response_accept", {
        platform: PLATFORM, action: "copy",
        section: isCode ? "code_block" : "response",
        content_length: container?.textContent?.length ?? 0,
      });
      addMetric("accepts");
      return;
    }

    // Artifact interactions
    if (btn.closest("[class*='artifact']")) {
      const action = label.includes("edit") ? "edit" : label.includes("copy") ? "copy" : "create";
      sendEvent("ai_artifact_interaction", {
        platform: PLATFORM,
        artifact_type: btn.closest("pre, code") ? "code" : "document",
        action,
      });
      return;
    }

    // Conversation branching (edit/retry)
    if (label.includes("edit") || label.includes("retry")) {
      const msg = btn.closest("[class*='message'], [class*='human']");
      sendEvent("ai_conversation_branch", {
        platform: PLATFORM,
        action: label.includes("retry") ? "retry" : "edit",
        original_prompt_length: msg?.textContent?.length ?? 0,
      });
    }
  }, true);
}
