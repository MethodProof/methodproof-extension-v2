import { describe, it, expect } from "vitest";
import { redactUrl } from "../redact";

describe("redactUrl", () => {
  it("redacts banking URL with sensitive params to domain-only", () => {
    const result = redactUrl("https://bank.com/accounts?session=xyz&token=abc");
    expect(result.url).toBe("https://bank.com");
    expect(result.category).toBe("sensitive");
  });

  it("redacts email domain to domain-only", () => {
    const result = redactUrl("https://mail.google.com/mail/u/0/#inbox");
    expect(result.url).toBe("https://mail.google.com");
    expect(result.category).toBe("sensitive");
  });

  it("strips sensitive query params from normal URLs", () => {
    const result = redactUrl("https://example.com/page?token=secret&q=hello&api_key=123");
    expect(result.url).toBe("https://example.com/page?q=hello");
    expect(result.category).toBe("other");
  });

  it("preserves safe query params", () => {
    const result = redactUrl("https://stackoverflow.com/search?q=typescript+generics");
    expect(result.url).toContain("q=typescript+generics");
    expect(result.category).toBe("qa");
  });

  it("returns raw URL on parse failure", () => {
    const result = redactUrl("not-a-url");
    expect(result.url).toBe("not-a-url");
    expect(result.category).toBe("other");
  });
});
