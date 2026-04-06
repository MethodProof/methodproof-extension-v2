/** Event buffering and API transport for browser telemetry */

import type { BrowserEvent, SessionState } from "../types";
import { logger } from "./logger";

const MAX_BUFFER = 1000;
const RETRY_BACKOFFS = [5000, 10000, 20000, 60000];
let flushing = false;

/** Generate a unique event ID */
export function generateEventId(): string {
  return crypto.randomUUID();
}

/** Get server-synced timestamp */
export function syncedTimestamp(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

async function getSession(): Promise<SessionState | null> {
  const result = await chrome.storage.session.get("session");
  return (result.session as SessionState | undefined) ?? null;
}

/** Add event to the local buffer; force-flushes at MAX_BUFFER */
export async function bufferEvent(event: BrowserEvent): Promise<void> {
  const result = await chrome.storage.local.get("events");
  const events: BrowserEvent[] = (result.events as BrowserEvent[] | undefined) ?? [];
  events.push(event);

  if (events.length >= MAX_BUFFER) {
    logger.warning("telemetry.buffer.force_flush", { count: events.length });
    await chrome.storage.local.set({ events });
    await flushEvents();
    return;
  }

  await chrome.storage.local.set({ events });
  logger.debug("telemetry.event.buffered", { type: event.type, buffer_size: events.length });
}

/** Flush buffered events to the platform API */
export async function flushEvents(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const result = await chrome.storage.local.get("events");
    const events: BrowserEvent[] = (result.events as BrowserEvent[] | undefined) ?? [];
    if (events.length === 0) return;

    const session = await getSession();
    if (!session?.active) return;

    // Clear buffer before send; re-add on failure
    await chrome.storage.local.set({ events: [] });

    const ok = await sendBatch(session, events);
    if (!ok) {
      const current = await chrome.storage.local.get("events");
      const remaining: BrowserEvent[] = (current.events as BrowserEvent[] | undefined) ?? [];
      await chrome.storage.local.set({ events: [...events, ...remaining] });
    }
  } finally {
    flushing = false;
  }
}

const LOCAL_BRIDGE = "http://127.0.0.1:9877";

/** Try local bridge first (methodproof CLI running locally), fall back to platform API */
async function sendBatch(session: SessionState, events: BrowserEvent[]): Promise<boolean> {
  // Try local bridge (CLI offline mode)
  try {
    const probe = await fetch(`${LOCAL_BRIDGE}/session`, { signal: AbortSignal.timeout(500) });
    if (probe.ok) {
      const data = (await probe.json()) as { active: boolean };
      if (data.active) {
        const resp = await fetch(`${LOCAL_BRIDGE}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events }),
        });
        if (resp.ok) {
          logger.info("telemetry.flush.local", { count: events.length });
          return true;
        }
      }
    }
  } catch {
    // Local bridge not running — fall through to platform API
  }

  const url = `${session.api_base}/sessions/${session.session_id}/browser-events`;

  for (let attempt = 0; attempt <= RETRY_BACKOFFS.length; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.token}`,
        },
        body: JSON.stringify({ events }),
      });

      if (response.ok) {
        const body = (await response.json()) as { accepted?: number; rejected?: number; rejections?: Array<{ event_id: string; reason: string }> };
        if (body.rejected && body.rejected > 0) {
          logger.warning("telemetry.flush.partial_reject", {
            accepted: body.accepted, rejected: body.rejected,
            rejections: body.rejections?.slice(0, 3),
          });
        } else {
          logger.info("telemetry.flush.success", { count: events.length, accepted: body.accepted });
        }
        return true;
      }

      const errorBody = await response.text().catch(() => "(unreadable)");
      logger.warning("telemetry.flush.http_error", {
        status: response.status,
        detail: errorBody.slice(0, 500),
        attempt: attempt + 1,
        max_attempts: RETRY_BACKOFFS.length + 1,
        count: events.length,
      });
    } catch (err: unknown) {
      logger.warning("telemetry.flush.network_error", {
        error: String(err),
        attempt: attempt + 1,
        max_attempts: RETRY_BACKOFFS.length + 1,
        count: events.length,
      });
    }

    if (attempt < RETRY_BACKOFFS.length) {
      const backoff = RETRY_BACKOFFS[attempt];
      logger.info("telemetry.flush.retry", { backoff_ms: backoff, attempt: attempt + 1 });
      await new Promise((r) => setTimeout(r, backoff));
    }
  }

  logger.error("telemetry.flush.exhausted", { count: events.length, retries: RETRY_BACKOFFS.length });
  return false;
}

/** Fetch server time and compute local clock offset */
export async function syncClock(session: SessionState): Promise<number> {
  const url = `${session.api_base}/sessions/${session.session_id}/extension-config`;
  try {
    const before = Date.now();
    const response = await fetch(url, {
      headers: { "Authorization": `Bearer ${session.token}` },
    });
    const after = Date.now();

    if (!response.ok) {
      logger.warning("telemetry.clock_sync.http_error", { status: response.status });
      return 0;
    }

    const data = (await response.json()) as { server_time: string };
    const serverMs = new Date(data.server_time).getTime();
    const rtt = after - before;
    const localMs = before + rtt / 2;
    const offset = serverMs - localMs;

    logger.info("telemetry.clock_sync.complete", { offset_ms: offset, rtt_ms: rtt });
    return offset;
  } catch (err: unknown) {
    logger.warning("telemetry.clock_sync.failed", { error: String(err) });
    return 0;
  }
}
