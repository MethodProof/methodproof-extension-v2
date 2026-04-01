/** MethodProof extension service worker — session binding and event dispatch */

import type { SessionState, BrowserEvent, ExtensionMessage } from "./types";
import { logger } from "./lib/logger";
import { categorizeDomain } from "./lib/categorize";
import { redactUrl } from "./lib/redact";
import { bufferEvent, flushEvents, syncClock, generateEventId, syncedTimestamp } from "./lib/telemetry";

const FLUSH_ALARM = "methodproof-flush";
let lastActiveDomain = "";

// --- Session management ---

async function getSession(): Promise<SessionState | null> {
  const result = await chrome.storage.session.get("session");
  return (result.session as SessionState | undefined) ?? null;
}

async function activateSession(sessionId: string, token: string, apiBase: string): Promise<void> {
  const session: SessionState = {
    session_id: sessionId,
    token,
    api_base: apiBase,
    clock_offset_ms: 0,
    active: true,
  };

  const offset = await syncClock(session);
  session.clock_offset_ms = offset;

  await chrome.storage.session.set({ session });
  // Chrome clamps alarm period to minimum 30s; 10s is the design target
  await chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 10 / 60 });
  logger.info("session.activated", { session_id: sessionId, clock_offset_ms: offset });
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
  if (!session?.active) return;

  const { url, category } = redactUrl(details.url);
  let title = "";
  try {
    const tab = await chrome.tabs.get(details.tabId);
    title = tab.title ?? "";
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

// --- Alarm handler ---

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === FLUSH_ALARM) {
    await flushEvents();
  }
});

// --- Message handler ---

function isExtensionMessage(msg: unknown): msg is ExtensionMessage {
  return typeof msg === "object" && msg !== null && "type" in msg;
}

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case "activate":
      await activateSession(message.session_id, message.token, message.api_base);
      return { ok: true };
    case "deactivate":
      await deactivateSession();
      return { ok: true };
    case "content_event": {
      const session = await getSession();
      if (!session?.active) return { ok: false, reason: "no_session" };
      const event: BrowserEvent = {
        event_id: generateEventId(),
        type: message.event_type,
        timestamp: syncedTimestamp(session.clock_offset_ms),
        session_id: session.session_id,
        data: message.data,
      };
      await bufferEvent(event);
      return { ok: true };
    }
    case "get_session": {
      const session = await getSession();
      return session ?? { active: false };
    }
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

chrome.runtime.onMessageExternal.addListener((message: unknown, _sender, sendResponse) => {
  if (!isExtensionMessage(message)) return;
  handleMessage(message)
    .then(sendResponse)
    .catch((err: unknown) => {
      logger.error("message.external.handler.failed", { error: String(err) });
      sendResponse({ ok: false, error: "internal" });
    });
  return true;
});
