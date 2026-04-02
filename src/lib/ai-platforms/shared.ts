/** Shared utilities for AI platform content scripts — structural metrics only, never content */

/** Send event to background for telemetry buffering */
export function sendEvent(eventType: string, data: Record<string, unknown>): void {
  chrome.runtime.sendMessage({ type: "content_event", event_type: eventType, data }).catch(() => {});
}

/** Check if AI usage module is enabled (defaults to enabled) */
export async function isModuleEnabled(): Promise<boolean> {
  const result = await chrome.storage.sync.get("modules");
  const modules = result.modules as Record<string, boolean> | undefined;
  return modules?.ai_usage !== false;
}

/** Increment a metric counter in local storage */
export function addMetric(key: string, value = 1): void {
  chrome.storage.local.get("ai_metrics").then(result => {
    const m = (result.ai_metrics ?? {}) as Record<string, number>;
    m[key] = (m[key] ?? 0) + value;
    chrome.storage.local.set({ ai_metrics: m });
  }).catch(() => {});
}

/** Record a platform as used in this session */
export function recordPlatform(platform: string): void {
  chrome.storage.local.get("ai_platforms_used").then(result => {
    const p = (result.ai_platforms_used ?? []) as string[];
    if (!p.includes(platform)) chrome.storage.local.set({ ai_platforms_used: [...p, platform] });
  }).catch(() => {});
}

/** Track tab visibility time on AI platform pages */
export function trackVisibility(): void {
  let start = Date.now();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      addMetric("total_interaction_time_ms", Date.now() - start);
    } else {
      start = Date.now();
    }
  });
}

/** Get text length from an input element (handles textarea and contenteditable) */
export function getInputLength(el: Element | null): number {
  if (!el) return 0;
  if (el instanceof HTMLTextAreaElement) return el.value.length;
  if (el instanceof HTMLInputElement) return el.value.length;
  return el.textContent?.length ?? 0;
}

/** Wait for an element's text content to stabilize (streaming complete), then invoke callback */
export function waitForStable(
  getEl: () => Element | null,
  onStable: (textLength: number) => void,
): () => void {
  let prev = 0;
  let stable = 0;
  const timer = setInterval(() => {
    const len = getEl()?.textContent?.length ?? 0;
    if (len > 0 && len === prev) {
      if (++stable >= 3) { clearInterval(timer); onStable(len); }
    } else {
      stable = 0;
      prev = len;
    }
  }, 500);
  const timeout = setTimeout(() => clearInterval(timer), 300_000);
  return () => { clearInterval(timer); clearTimeout(timeout); };
}
