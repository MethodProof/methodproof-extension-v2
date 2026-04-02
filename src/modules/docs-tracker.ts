/**
 * Docs Reading Tracker module — captures documentation reading patterns.
 * Runs in content script context (needs DOM access for scroll/heading observation).
 *
 * Integration needed in content.ts:
 *   import { initDocsTracker, destroyDocsTracker } from "./modules/docs-tracker";
 *   - Call initDocsTracker() at the end of content.ts
 *   - destroyDocsTracker() available for cleanup on deactivate
 */

import { categorizeDomain } from "../lib/categorize";

let active = false;

/** Initialize docs tracker — activates only on documentation sites when enabled */
export async function initDocsTracker(): Promise<void> {
  if (!(await isEnabled())) return;
  if (categorizeDomain(location.hostname) !== "docs") return;
  active = true;
}

/** Destroy docs tracker — cleans up all listeners and emits pending events */
export function destroyDocsTracker(): void {
  if (!active) return;
  active = false;
}

async function isEnabled(): Promise<boolean> {
  const result = await chrome.storage.sync.get("modules");
  const modules = result.modules as Record<string, boolean> | undefined;
  return modules?.docs_tracker !== false;
}
