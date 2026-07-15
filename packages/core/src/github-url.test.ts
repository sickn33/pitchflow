import { describe, expect, it } from "vitest";

import { IntakeError } from "./errors";
import { normalizeGitHubUrl } from "./github-url";

describe("normalizeGitHubUrl", () => {
  it("normalizes a canonical repository URL", () => {
    expect(normalizeGitHubUrl("https://github.com/OpenAI/codex")).toEqual({
      owner: "OpenAI",
      repository: "codex",
      requestedRef: null,
      canonicalUrl: "https://github.com/OpenAI/codex",
    });
  });

  it("removes the optional .git suffix", () => {
    expect(normalizeGitHubUrl("https://github.com/acme/demo.git").repository).toBe("demo");
  });

  it("accepts one safe tree ref", () => {
    expect(normalizeGitHubUrl("https://github.com/acme/demo/tree/v1.2.0").requestedRef).toBe(
      "v1.2.0",
    );
  });

  it.each([
    "http://github.com/acme/demo",
    "https://github.example.com/acme/demo",
    "https://user:pass@github.com/acme/demo",
    "https://github.com:443/acme/demo",
    "https://github.com/acme/demo?ref=main",
    "https://github.com/acme/demo#readme",
    "https://github.com/acme/demo/blob/main/README.md",
  ])("rejects a non-canonical or unsafe URL: %s", (value) => {
    expect(() => normalizeGitHubUrl(value)).toThrow(IntakeError);
  });

  it("rejects refs containing path separators", () => {
    expect(() => normalizeGitHubUrl("https://github.com/acme/demo/tree/feature/unsafe")).toThrow(
      /repository root URL|not supported/i,
    );
  });
});
