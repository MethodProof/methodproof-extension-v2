/**
 * Docs Reading Tracker module — captures documentation reading patterns.
 * Runs in content script context (needs DOM access for scroll/heading observation).
 *
 * Integration needed in content.ts:
 *   import { initDocsTracker, destroyDocsTracker } from "./modules/docs-tracker";
 *   - Call initDocsTracker() at the end of content.ts
 *   - destroyDocsTracker() available for cleanup on deactivate
 */

import { detectDocsSite } from "../lib/docs/sites";
import { startReading, stopReading } from "../lib/docs/reading";

let active = false;

function send(eventType: string, data: Record<string, unknown>): void {
  chrome.runtime.sendMessage({ type: "content_event", event_type: eventType, data }).catch(() => {});
}

/** Initialize docs tracker — activates only on documentation sites when enabled */
export async function initDocsTracker(): Promise<void> {
  if (!(await isEnabled())) return;
  const site = detectDocsSite();
  if (!site) return;
  active = true;
  startReading(site, send);
}

/** Destroy docs tracker — cleans up all listeners and emits pending events */
export function destroyDocsTracker(): void {
  if (!active) return;
  active = false;
  stopReading();
}

async function isEnabled(): Promise<boolean> {
  const result = await chrome.storage.sync.get("modules");
  const modules = result.modules as Record<string, boolean> | undefined;
  return modules?.docs_tracker !== false;
}
