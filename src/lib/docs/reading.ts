/** Scroll depth and time tracking for documentation pages */

import type { DocsSiteInfo } from "./sites";

type SendFn = (eventType: string, data: Record<string, unknown>) => void;

const IDLE_TIMEOUT_MS = 60_000;
const MIN_VIEW_MS = 5_000;
const SKIM_THRESHOLD_MS = 3_000;

let observer: IntersectionObserver | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let activeTimeMs = 0;
let lastActiveTs = 0;
let idle = false;
let deepestIndex = 0;
let totalSections = 0;
let emitted = false;
let site: DocsSiteInfo | null = null;
let emit: SendFn | null = null;
let teardowns: (() => void)[] = [];

function resetIdle(): void {
  if (idle) {
    idle = false;
    lastActiveTs = Date.now();
  }
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!idle) {
      activeTimeMs += Date.now() - lastActiveTs;
      idle = true;
    }
  }, IDLE_TIMEOUT_MS);
}

function activeTime(): number {
  return activeTimeMs + (idle ? 0 : Date.now() - lastActiveTs);
}

function emitReading(): void {
  if (!site || !emit || emitted) return;
  const time = activeTime();
  if (time < MIN_VIEW_MS) return;
  emitted = true;

  const reached = totalSections > 0 ? deepestIndex + 1 : 0;
  const depthPct = totalSections > 0 ? Math.round((reached / totalSections) * 100) : 0;
  const avgPerSection = reached > 0 ? time / reached : time;

  emit("docs_page_read", {
    domain: site.domain,
    category: site.category,
    scroll_depth_pct: depthPct,
    time_on_page_ms: time,
    sections_reached: reached,
    total_sections: totalSections,
    reading_style: avgPerSection < SKIM_THRESHOLD_MS ? "skim" : "read",
  });
}

function setupObserver(headings: NodeListOf<Element>): void {
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const idx = Array.from(headings).indexOf(entry.target as HTMLElement);
      if (idx > deepestIndex) deepestIndex = idx;
    }
  }, { threshold: 0.1 });
  headings.forEach(h => observer!.observe(h));
}

function setupIdleDetection(): void {
  const onActivity = (): void => resetIdle();
  for (const evt of ["mousemove", "keydown", "click", "touchstart"]) {
    document.addEventListener(evt, onActivity, { passive: true });
    teardowns.push(() => document.removeEventListener(evt, onActivity));
  }
  resetIdle();
}

function onVisibilityChange(): void {
  if (document.visibilityState === "hidden") {
    emitReading();
  } else if (!emitted) {
    lastActiveTs = Date.now();
    idle = false;
    resetIdle();
  }
}

function setupLeaveHandlers(): void {
  document.addEventListener("visibilitychange", onVisibilityChange);
  teardowns.push(() => document.removeEventListener("visibilitychange", onVisibilityChange));
  window.addEventListener("beforeunload", emitReading);
  teardowns.push(() => window.removeEventListener("beforeunload", emitReading));
}

export function startReading(docsSite: DocsSiteInfo, send: SendFn): void {
  site = docsSite;
  emit = send;
  lastActiveTs = Date.now();
  activeTimeMs = 0;
  idle = false;
  emitted = false;
  deepestIndex = 0;

  const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
  totalSections = headings.length;
  if (totalSections > 0) setupObserver(headings);

  setupIdleDetection();
  setupLeaveHandlers();
}

export function stopReading(): void {
  emitReading();
  observer?.disconnect();
  observer = null;
  if (idleTimer) clearTimeout(idleTimer);
  teardowns.forEach(fn => fn());
  teardowns = [];
  site = null;
  emit = null;
}
