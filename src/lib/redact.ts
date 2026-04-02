/** URL redaction for privacy-sensitive telemetry */

import { categorizeDomain, type DomainCategory } from "./categorize";
import { logger } from "./logger";

const SENSITIVE_PARAM = /^(auth|token|key|password|secret|session|jwt|api_key|access_token|auth_token|sessionid|session_id|private_key|client_secret|refresh_token|code|state|nonce)$/i;

/** Strip sensitive query params; redact sensitive domains to domain-only */
export function redactUrl(rawUrl: string): { url: string; category: DomainCategory } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch (err: unknown) {
    logger.warning("redact.url.parse_failed", { raw_url: rawUrl, error: String(err) });
    return { url: rawUrl, category: "other" };
  }

  const category = categorizeDomain(parsed.hostname);

  // Sensitive domains: return origin only (no path, no query)
  if (category === "sensitive") {
    return { url: `${parsed.protocol}//${parsed.hostname}`, category };
  }

  // Strip sensitive query params
  for (const key of [...parsed.searchParams.keys()]) {
    if (SENSITIVE_PARAM.test(key)) {
      parsed.searchParams.delete(key);
    }
  }

  return { url: parsed.toString(), category };
}
