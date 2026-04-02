/**
 * AI Usage module — lifecycle management and metrics aggregation.
 * Runs in background (service worker) context.
 *
 * Integration needed in background.ts:
 *   import { initAiUsage, destroyAiUsage } from "./modules/ai-usage";
 *   - Call initAiUsage() inside activateSession()
 *   - Call destroyAiUsage() inside deactivateSession() (before flushEvents)
 *
 * Integration needed in manifest.json:
 *   - Add "scripting" to permissions array
 *
 * Integration needed in webpack.config.js:
 *   - Add entry points for each ai-platforms/*.ts file outputting to ai-platforms/ dir
 */

import type { BrowserEvent } from "../types";
import { bufferEvent, generateEventId, syncedTimestamp } from "../lib/telemetry";

const SCRIPTS = [
  { id: "mp-ai-chatgpt", matches: ["*://chatgpt.com/*", "*://chat.openai.com/*"], js: ["ai-platforms/chatgpt.js"] },
  { id: "mp-ai-claude", matches: ["*://*.claude.ai/*"], js: ["ai-platforms/claude.js"] },
  { id: "mp-ai-copilot", matches: ["*://github.com/*"], js: ["ai-platforms/copilot.js"] },
  { id: "mp-ai-cursor", matches: ["*://*.cursor.sh/*", "*://*.cursor.com/*"], js: ["ai-platforms/cursor.js"] },
] as const;

const SCRIPT_IDS = SCRIPTS.map(s => s.id);

/** Initialize AI usage module — registers platform content scripts if enabled */
export async function initAiUsage(): Promise<void> {
  if (!(await isEnabled())) return;
  await chrome.storage.local.remove(["ai_metrics", "ai_platforms_used"]);

  if (!chrome.scripting?.registerContentScripts) return;
  try {
    await chrome.scripting.registerContentScripts(
      SCRIPTS.map(s => ({ id: s.id, matches: [...s.matches], js: [...s.js], runAt: "document_idle" as const })),
    );
  } catch {
    // Already registered from a previous session — update instead
    try {
      await chrome.scripting.updateContentScripts(
        SCRIPTS.map(s => ({ id: s.id, matches: [...s.matches], js: [...s.js], runAt: "document_idle" as const })),
      );
    } catch { /* scripting API unavailable — content scripts must be in manifest */ }
  }
}

/** Destroy AI usage module — emits summary event, unregisters scripts, clears metrics */
export async function destroyAiUsage(): Promise<void> {
  await emitSummary();
  if (chrome.scripting?.unregisterContentScripts) {
    try { await chrome.scripting.unregisterContentScripts({ ids: [...SCRIPT_IDS] }); } catch { /* noop */ }
  }
  await chrome.storage.local.remove(["ai_metrics", "ai_platforms_used"]);
}

/** Read current aggregated AI metrics (callable from popup or background) */
export async function getAiMetrics(): Promise<Record<string, unknown>> {
  const [mr, pr] = await Promise.all([
    chrome.storage.local.get("ai_metrics"),
    chrome.storage.local.get("ai_platforms_used"),
  ]);
  const m = (mr.ai_metrics ?? {}) as Record<string, number>;
  const platforms = (pr.ai_platforms_used ?? []) as string[];
  const sent = m.prompts_sent ?? 0;
  return {
    prompts_sent: sent,
    avg_response_wait_ms: sent ? Math.round((m.total_response_wait_ms ?? 0) / sent) : 0,
    accept_rate: sent ? Number(((m.accepts ?? 0) / sent).toFixed(2)) : 0,
    platforms_used: platforms,
    total_interaction_time_ms: m.total_interaction_time_ms ?? 0,
  };
}

async function emitSummary(): Promise<void> {
  const session = await getSession();
  if (!session?.active) return;
  const metrics = await getAiMetrics();
  if ((metrics.prompts_sent as number) === 0) return;

  const event: BrowserEvent = {
    event_id: generateEventId(),
    type: "ai_usage_summary",
    timestamp: syncedTimestamp(session.clock_offset_ms),
    session_id: session.session_id,
    data: metrics,
  };
  await bufferEvent(event);
}

async function isEnabled(): Promise<boolean> {
  const result = await chrome.storage.sync.get("modules");
  const modules = result.modules as Record<string, boolean> | undefined;
  return modules?.ai_usage !== false;
}

async function getSession(): Promise<{ session_id: string; clock_offset_ms: number; active: boolean } | null> {
  const result = await chrome.storage.session.get("session");
  return (result.session as { session_id: string; clock_offset_ms: number; active: boolean } | undefined) ?? null;
}
