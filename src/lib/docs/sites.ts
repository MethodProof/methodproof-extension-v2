/** Documentation site detection — domain registry + generic pattern matching */

export type DocsCategory = "language" | "framework" | "library" | "api_reference" | "tutorial" | "other";

export interface DocsSiteInfo {
  domain: string;
  category: DocsCategory;
  detected_by: "registry" | "url_pattern" | "meta_generator";
}

/** Extensible registry — add new docs sites here, no logic changes needed */
const DOCS_REGISTRY: Record<string, DocsCategory> = {
  // Language docs
  "docs.python.org": "language",
  "doc.rust-lang.org": "language",
  "go.dev": "language",
  "pkg.go.dev": "language",
  "typescriptlang.org": "language",
  "learn.microsoft.com": "language",
  "cppreference.com": "language",
  "ruby-doc.org": "language",
  "php.net": "language",
  "docs.oracle.com": "language",
  "developer.apple.com": "language",
  // Framework docs
  "react.dev": "framework",
  "vuejs.org": "framework",
  "angular.io": "framework",
  "nextjs.org": "framework",
  "svelte.dev": "framework",
  "docs.djangoproject.com": "framework",
  "flask.palletsprojects.com": "framework",
  "fastapi.tiangolo.com": "framework",
  "expressjs.com": "framework",
  "rubyonrails.org": "framework",
  "docs.spring.io": "framework",
  // API reference
  "developer.mozilla.org": "api_reference",
  "devdocs.io": "api_reference",
  "docs.aws.amazon.com": "api_reference",
  "cloud.google.com": "api_reference",
  // Library docs
  "docs.rs": "library",
  "nodejs.org": "library",
  "hex.pm": "library",
  // Tutorial
  "docs.github.com": "tutorial",
  "kubernetes.io": "tutorial",
  "docs.docker.com": "tutorial",
};

const URL_PATTERNS = ["/docs/", "/doc/", "/api/", "/reference/", "/guide/", "/manual/"];

const META_GENERATORS: Record<string, DocsCategory> = {
  sphinx: "api_reference",
  docusaurus: "framework",
  gitbook: "tutorial",
  readthedocs: "api_reference",
  mkdocs: "api_reference",
  vuepress: "framework",
};

function checkRegistry(hostname: string): DocsSiteInfo | null {
  if (DOCS_REGISTRY[hostname]) {
    return { domain: hostname, category: DOCS_REGISTRY[hostname], detected_by: "registry" };
  }
  const parts = hostname.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join(".");
    if (DOCS_REGISTRY[parent]) {
      return { domain: hostname, category: DOCS_REGISTRY[parent], detected_by: "registry" };
    }
  }
  return null;
}

function checkMetaGenerator(hostname: string): DocsSiteInfo | null {
  const content = document.querySelector('meta[name="generator"]')?.getAttribute("content")?.toLowerCase() ?? "";
  for (const [key, category] of Object.entries(META_GENERATORS)) {
    if (content.includes(key)) {
      return { domain: hostname, category, detected_by: "meta_generator" };
    }
  }
  return null;
}

function checkUrlPattern(hostname: string): DocsSiteInfo | null {
  if (URL_PATTERNS.some(p => location.pathname.toLowerCase().includes(p))) {
    return { domain: hostname, category: "other", detected_by: "url_pattern" };
  }
  return null;
}

/** Detect if the current page is a documentation site */
export function detectDocsSite(): DocsSiteInfo | null {
  const hostname = location.hostname.replace(/^www\./, "");
  return checkRegistry(hostname) ?? checkMetaGenerator(hostname) ?? checkUrlPattern(hostname);
}
