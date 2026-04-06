/** MethodProof extension service worker — session binding and event dispatch */

import type { SessionState, BrowserEvent, ExtensionMessage } from "./types";
import { logger } from "./lib/logger";
import { categorizeDomain } from "./lib/categorize";
import { redactUrl } from "./lib/redact";
import { bufferEvent, flushEvents, syncClock, generateEventId, syncedTimestamp } from "./lib/telemetry";
import { computeFingerprint, encryptEventData } from "./lib/crypto";

const FLUSH_ALARM = "methodproof-flush";
const DISCOVERY_ALARM = "methodproof-discovery";
const BRIDGE_URL = "http://127.0.0.1:9877";
let lastActiveDomain = "";

// --- Session management ---

async function getSession(): Promise<SessionState | null> {
  const result = await chrome.storage.session.get("session");
  return (result.session as SessionState | undefined) ?? null;
}

async function activateSession(sessionId: string, token: string, apiBase: string, e2eKey?: string): Promise<void> {
  const session: SessionState = {
    session_id: sessionId,
    token,
    api_base: apiBase,
    clock_offset_ms: 0,
    active: true,
  };

  if (e2eKey) {
    session.e2e_key = e2eKey;
    session.e2e_fingerprint = await computeFingerprint(e2eKey);
  }

  const offset = await syncClock(session);
  session.clock_offset_ms = offset;

  await chrome.storage.session.set({ session });
  await chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 10 / 60 });
  logger.info("session.activated", { session_id: sessionId, clock_offset_ms: offset, e2e: !!e2eKey });
}

async function deactivateSession(): Promise<void> {
  await flushEvents();
  await chrome.storage.session.remove("session");
  await chrome.alarms.clear(FLUSH_ALARM);
  await chrome.storage.local.remove("events");
  logger.info("session.deactivated");
}

// --- Browser event capture ---

chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  if (!details.url.startsWith("http")) return;
  const session = await getSession();
  if (!session?.active) {
    // No session — try to discover a CLI bridge
    await discoverBridge();
    return;
  }

  const { url, category } = redactUrl(details.url);
  let title = "";
  try {
    const tab = await chrome.tabs.get(details.tabId);
    // Don't capture page titles from sensitive domains (banking, email, health)
    title = category === "sensitive" ? "" : (tab.title ?? "");
  } catch (err: unknown) {
    logger.warning("capture.tab_get.failed", { error: String(err), tab_id: details.tabId });
  }

  await bufferEvent({
    event_id: generateEventId(),
    type: "browser_visit",
    timestamp: syncedTimestamp(session.clock_offset_ms),
    session_id: session.session_id,
    data: { url, domain: new URL(details.url).hostname, title, category },
  });
});

chrome.tabs.onActivated.addListener(async (info) => {
  const session = await getSession();
  if (!session?.active) return;

  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.get(info.tabId);
  } catch (err: unknown) {
    logger.warning("capture.tab_switch.failed", { error: String(err), tab_id: info.tabId });
    return;
  }
  if (!tab.url || !tab.url.startsWith("http")) return;

  const toDomain = new URL(tab.url).hostname;
  const toCategory = categorizeDomain(toDomain);

  await bufferEvent({
    event_id: generateEventId(),
    type: "browser_tab_switch",
    timestamp: syncedTimestamp(session.clock_offset_ms),
    session_id: session.session_id,
    data: { from_domain: lastActiveDomain, to_domain: toDomain, to_category: toCategory },
  });
  lastActiveDomain = toDomain;
});

// --- Auto-discovery: poll local bridge for active sessions ---

async function discoverBridge(): Promise<void> {
  const session = await getSession();

  try {
    const resp = await fetch(`${BRIDGE_URL}/pair/auto`, { signal: AbortSignal.timeout(1000) });
    if (!resp.ok) {
      // Bridge returned error — if we had a session, it ended
      if (session?.active) {
        logger.info("session.bridge_lost");
        await deactivateSession();
      }
      return;
    }
    const data = await resp.json() as { active?: boolean; session_id?: string; token?: string; api_base?: string; e2e_key?: string };
    if (!data.active) {
      if (session?.active) {
        logger.info("session.bridge_inactive");
        await deactivateSession();
      }
      return;
    }
    // Bridge has an active session — connect if we aren't already on this session
    if (session?.active && session.session_id === data.session_id) return;
    if (!data.session_id || !data.token || !data.api_base) return;
    await activateSession(data.session_id, data.token, data.api_base, data.e2e_key);
    logger.info("session.auto_discovered", { session_id: data.session_id });
  } catch {
    // Bridge not reachable — if we had a bridge-paired session, deactivate
    if (session?.active) {
      logger.info("session.bridge_unreachable");
      await deactivateSession();
    }
  }
}

// Fast discovery: poll every 3s until connected, then rely on 30s alarm
let discoveryInterval: ReturnType<typeof setInterval> | null = null;

function startFastDiscovery(): void {
  if (discoveryInterval) return;
  discoverBridge();
  discoveryInterval = setInterval(async () => {
    const session = await getSession();
    if (session?.active) {
      if (discoveryInterval) { clearInterval(discoveryInterval); discoveryInterval = null; }
      return;
    }
    await discoverBridge();
  }, 3000);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(DISCOVERY_ALARM, { periodInMinutes: 0.5 });
  startFastDiscovery();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(DISCOVERY_ALARM, { periodInMinutes: 0.5 });
  startFastDiscovery();
});

// Also start fast discovery when service worker wakes up (e.g., from alarm)
startFastDiscovery();

// --- Alarm handler ---

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === FLUSH_ALARM) {
    await flushEvents();
  } else if (alarm.name === DISCOVERY_ALARM) {
    await discoverBridge();
    // Restart fast polling if not connected
    const session = await getSession();
    if (!session?.active) startFastDiscovery();
  }
});

// --- Message handler ---

function isExtensionMessage(msg: unknown): msg is ExtensionMessage {
  return typeof msg === "object" && msg !== null && "type" in msg;
}

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case "activate":
      await activateSession(message.session_id, message.token, message.api_base, message.e2e_key);
      return { ok: true };
    case "deactivate":
      await deactivateSession();
      return { ok: true };
    case "content_event": {
      const session = await getSession();
      if (!session?.active) return { ok: false, reason: "no_session" };
      let data = message.data;
      if (session.e2e_key && session.e2e_fingerprint) {
        data = await encryptEventData(data, session.e2e_key, session.e2e_fingerprint);
      }
      const event: BrowserEvent = {
        event_id: generateEventId(),
        type: message.event_type,
        timestamp: syncedTimestamp(session.clock_offset_ms),
        session_id: session.session_id,
        data,
      };
      await bufferEvent(event);
      return { ok: true };
    }
    case "flush":
      await flushEvents();
      return { ok: true };
    case "get_session": {
      const session = await getSession();
      const result = await chrome.storage.local.get("events");
      const pending = ((result.events as BrowserEvent[] | undefined) ?? []).length;
      return { ...(session ?? { active: false }), pending_count: pending };
    }
    case "check_bridge":
      discoverBridge();
      return { ok: true };
    default:
      return { ok: false, reason: "unknown_message" };
  }
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isExtensionMessage(message)) return;
  handleMessage(message)
    .then(sendResponse)
    .catch((err: unknown) => {
      logger.error("message.handler.failed", { error: String(err) });
      sendResponse({ ok: false, error: "internal" });
    });
  return true;
});

const ALLOWED_ORIGINS = /^https?:\/\/(localhost(:\d+)?|([a-z0-9-]+\.)?methodproof\.com)/;

chrome.runtime.onMessageExternal.addListener((message: unknown, sender, sendResponse) => {
  if (!isExtensionMessage(message)) return;
  const origin = sender.url ?? "";
  if (!ALLOWED_ORIGINS.test(origin)) {
    logger.warning("message.external.rejected", { origin });
    sendResponse({ ok: false, error: "unauthorized_origin" });
    return true;
  }
  handleMessage(message)
    .then(sendResponse)
    .catch((err: unknown) => {
      logger.error("message.external.handler.failed", { error: String(err) });
      sendResponse({ ok: false, error: "internal" });
    });
  return true;
});
