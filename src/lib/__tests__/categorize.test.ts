import { describe, it, expect } from "vitest";
import { categorizeDomain } from "../categorize";

describe("categorizeDomain", () => {
  it("classifies search engines", () => {
    expect(categorizeDomain("google.com")).toBe("search");
    expect(categorizeDomain("www.bing.com")).toBe("search");
    expect(categorizeDomain("duckduckgo.com")).toBe("search");
  });

  it("classifies code hosting", () => {
    expect(categorizeDomain("github.com")).toBe("code_host");
    expect(categorizeDomain("gitlab.com")).toBe("code_host");
  });

  it("classifies AI chat platforms", () => {
    expect(categorizeDomain("chat.openai.com")).toBe("ai_chat");
    expect(categorizeDomain("claude.ai")).toBe("ai_chat");
    expect(categorizeDomain("perplexity.ai")).toBe("ai_chat");
  });

  it("classifies cheating domains without blocking", () => {
    expect(categorizeDomain("chegg.com")).toBe("cheating");
    expect(categorizeDomain("coursehero.com")).toBe("cheating");
    expect(categorizeDomain("brainly.com")).toBe("cheating");
  });

  it("classifies sensitive domains", () => {
    expect(categorizeDomain("chase.com")).toBe("sensitive");
    expect(categorizeDomain("mail.google.com")).toBe("sensitive");
    expect(categorizeDomain("mychart.com")).toBe("sensitive");
  });

  it("resolves subdomains via parent domain lookup", () => {
    expect(categorizeDomain("docs.github.com")).toBe("code_host");
    expect(categorizeDomain("en.wikipedia.org")).toBe("reference");
  });

  it("returns other for unknown domains", () => {
    expect(categorizeDomain("random-site.xyz")).toBe("other");
  });
});
