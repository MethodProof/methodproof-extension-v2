/** Search efficiency metrics for documentation sites */

import type { DocsSiteInfo } from "./sites";

type SendFn = (eventType: string, data: Record<string, unknown>) => void;

const REFINEMENT_WINDOW_MS = 30_000;

const SEARCH_SELECTORS = [
  'input[type="search"]', 'input[name="q"]', 'input[name="query"]',
  'input[name="search"]', '.DocSearch-Input', '#searchbox input',
  '[role="search"] input', '.search-input', '#search input',
];

const URL_SEARCH_PARAMS = ["q", "query", "search", "s"];

let site: DocsSiteInfo | null = null;
let emit: SendFn | null = null;
let lastSearchTime = 0;
let refinements = 0;
let resultClicks = 0;
let firstClickMs = 0;
let searchStartTime = 0;
let searchEmitted = false;
let pendingSearch: { queryLength: number; wordCount: number } | null = null;
let teardowns: (() => void)[] = [];

function recordSearch(queryLength: number, wordCount: number): void {
  const now = Date.now();
  if (lastSearchTime > 0 && now - lastSearchTime < REFINEMENT_WINDOW_MS) {
    refinements++;
  } else {
    refinements = 0;
  }
  lastSearchTime = now;
  searchStartTime = now;
  resultClicks = 0;
  firstClickMs = 0;
  searchEmitted = false;
  pendingSearch = { queryLength, wordCount };
}

function emitSearch(): void {
  if (!site || !emit || !pendingSearch || searchEmitted) return;
  searchEmitted = true;
  emit("docs_search", {
    domain: site.domain,
    query_length: pendingSearch.queryLength,
    word_count: pendingSearch.wordCount,
    results_clicked: resultClicks,
    time_to_first_click_ms: firstClickMs || null,
    refinement_count: refinements,
  });
}

function isNavElement(el: Element | null): boolean {
  while (el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "nav" || tag === "header" || tag === "footer") return true;
    el = el.parentElement;
  }
  return false;
}

function onLinkClick(e: Event): void {
  const anchor = (e.target as Element)?.closest("a");
  if (!anchor || !pendingSearch || isNavElement(anchor)) return;
  resultClicks++;
  if (resultClicks === 1) firstClickMs = Date.now() - searchStartTime;
}

function findSearchInput(): HTMLInputElement | null {
  for (const sel of SEARCH_SELECTORS) {
    const el = document.querySelector(sel);
    if (el instanceof HTMLInputElement) return el;
  }
  return null;
}

function parseQuery(raw: string): { length: number; wordCount: number } {
  return { length: raw.length, wordCount: raw.split(/\s+/).filter(Boolean).length };
}

function detectUrlSearch(): void {
  const params = new URLSearchParams(location.search);
  for (const key of URL_SEARCH_PARAMS) {
    const val = params.get(key);
    if (val) {
      const q = parseQuery(val);
      recordSearch(q.length, q.wordCount);
      return;
    }
  }
}

function setupInputTracking(): void {
  const input = findSearchInput();
  if (!input) return;
  const handler = (e: Event): void => {
    if ((e as KeyboardEvent).key !== "Enter") return;
    if (!input.value) return;
    const q = parseQuery(input.value);
    recordSearch(q.length, q.wordCount);
  };
  input.addEventListener("keydown", handler);
  teardowns.push(() => input.removeEventListener("keydown", handler));
}

function onVisibility(): void {
  if (document.visibilityState === "hidden") emitSearch();
}

export function startSearchTracking(docsSite: DocsSiteInfo, send: SendFn): void {
  site = docsSite;
  emit = send;
  detectUrlSearch();
  setupInputTracking();
  document.addEventListener("click", onLinkClick, { passive: true });
  teardowns.push(() => document.removeEventListener("click", onLinkClick));
  document.addEventListener("visibilitychange", onVisibility);
  teardowns.push(() => document.removeEventListener("visibilitychange", onVisibility));
  window.addEventListener("beforeunload", emitSearch);
  teardowns.push(() => window.removeEventListener("beforeunload", emitSearch));
}

export function stopSearchTracking(): void {
  emitSearch();
  teardowns.forEach(fn => fn());
  teardowns = [];
  site = null;
  emit = null;
  pendingSearch = null;
}
