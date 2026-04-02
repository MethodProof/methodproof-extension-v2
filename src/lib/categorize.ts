/** Domain categorization for browser telemetry */

export type DomainCategory =
  | "search" | "docs" | "code_host" | "qa" | "ai_chat" | "music"
  | "cheating" | "package" | "reference" | "sensitive" | "other";

const CATEGORIES: Record<string, DomainCategory> = {
  // Search
  "google.com": "search", "bing.com": "search", "duckduckgo.com": "search",
  "yahoo.com": "search", "baidu.com": "search",
  // Docs
  "developer.mozilla.org": "docs", "docs.python.org": "docs",
  "devdocs.io": "docs", "learn.microsoft.com": "docs",
  "docs.rs": "docs", "pkg.go.dev": "docs",
  "reactjs.org": "docs", "vuejs.org": "docs", "angular.io": "docs",
  "typescriptlang.org": "docs", "nodejs.org": "docs",
  "docs.oracle.com": "docs", "docs.djangoproject.com": "docs",
  // Code hosting
  "github.com": "code_host", "gitlab.com": "code_host",
  "bitbucket.org": "code_host", "codeberg.org": "code_host",
  // Q&A
  "stackoverflow.com": "qa", "stackexchange.com": "qa",
  "superuser.com": "qa", "serverfault.com": "qa",
  // AI chat
  "chat.openai.com": "ai_chat", "chatgpt.com": "ai_chat",
  "claude.ai": "ai_chat", "perplexity.ai": "ai_chat",
  "gemini.google.com": "ai_chat", "copilot.microsoft.com": "ai_chat",
  // Cheating (flagged, not blocked)
  "chegg.com": "cheating", "coursehero.com": "cheating",
  "brainly.com": "cheating", "studocu.com": "cheating",
  "bartleby.com": "cheating",
  // Package registries
  "npmjs.com": "package", "pypi.org": "package",
  "crates.io": "package", "rubygems.org": "package",
  // Reference
  "wikipedia.org": "reference", "w3schools.com": "reference",
  "geeksforgeeks.org": "reference", "tutorialspoint.com": "reference",
  // Music
  "open.spotify.com": "music", "music.apple.com": "music",
  "music.youtube.com": "music", "soundcloud.com": "music",
  "listen.tidal.com": "music",
  // Sensitive (banking, email, health)
  "bank.com": "sensitive",
  "chase.com": "sensitive", "bankofamerica.com": "sensitive",
  "wellsfargo.com": "sensitive", "citi.com": "sensitive",
  "mail.google.com": "sensitive", "outlook.live.com": "sensitive",
  "outlook.office.com": "sensitive",
  "mychart.com": "sensitive", "webmd.com": "sensitive",
  "mayoclinic.org": "sensitive",
};

/** Classify a domain into a telemetry category */
export function categorizeDomain(hostname: string): DomainCategory {
  const domain = hostname.toLowerCase().replace(/^www\./, "");
  if (CATEGORIES[domain]) return CATEGORIES[domain];
  // Check parent domains (e.g. "docs.github.com" → "github.com")
  const parts = domain.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join(".");
    if (CATEGORIES[parent]) return CATEGORIES[parent];
  }
  return "other";
}
