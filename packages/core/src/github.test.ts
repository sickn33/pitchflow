import { describe, expect, it, vi } from "vitest";

import { ingestPublicGitHubRepository } from "./github";

const commitSha = "a".repeat(40);
const treeSha = "b".repeat(40);

function jsonResponse(value: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json", ...init?.headers },
    ...init,
  });
}

function createGitHubFetch(): typeof fetch {
  return vi.fn(async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (url.pathname === "/repos/acme/demo") {
      return jsonResponse({
        name: "demo",
        full_name: "acme/demo",
        html_url: "https://github.com/acme/demo",
        description: "A bounded demo repository.",
        homepage: "https://example.com",
        default_branch: "main",
        archived: false,
        fork: false,
        license: { spdx_id: "MIT" },
      });
    }
    if (url.pathname === "/repos/acme/demo/commits/main") {
      return jsonResponse({ sha: commitSha, commit: { tree: { sha: treeSha } } });
    }
    if (url.pathname === `/repos/acme/demo/git/trees/${treeSha}`) {
      return jsonResponse({
        truncated: false,
        tree: [
          { path: "README.md", type: "blob", size: 80 },
          { path: "package.json", type: "blob", size: 120 },
          { path: "src", type: "tree" },
          { path: "src/index.ts", type: "blob", size: 300 },
        ],
      });
    }
    if (url.pathname === "/repos/acme/demo/languages") {
      return jsonResponse({ TypeScript: 420 });
    }
    if (url.pathname === "/repos/acme/demo/contents/README.md") {
      const secret = `ghp_${"A".repeat(36)}`;
      return jsonResponse({
        encoding: "base64",
        content: Buffer.from(`# Demo\n\nA real demo.\ntoken=${secret}`).toString("base64"),
        html_url: `https://github.com/acme/demo/blob/${commitSha}/README.md`,
        size: 80,
      });
    }
    if (url.pathname === "/repos/acme/demo/contents/package.json") {
      return jsonResponse({
        encoding: "base64",
        content: Buffer.from('{"name":"demo"}').toString("base64"),
        html_url: `https://github.com/acme/demo/blob/${commitSha}/package.json`,
        size: 120,
      });
    }
    return jsonResponse({ message: "not found" }, { status: 404 });
  }) as typeof fetch;
}

describe("ingestPublicGitHubRepository", () => {
  it("creates a commit-pinned bounded evidence snapshot without executing code", async () => {
    const fetcher = createGitHubFetch();
    const snapshot = await ingestPublicGitHubRepository("https://github.com/acme/demo", {
      fetch: fetcher,
      capturedAt: "2026-07-15T04:00:00.000Z",
    });

    expect(snapshot.commitSha).toBe(commitSha);
    expect(snapshot.limits).toMatchObject({ discoveredFiles: 3, includedFiles: 2 });
    expect(snapshot.evidence.map((item) => item.kind)).toEqual(
      expect.arrayContaining([
        "repository_metadata",
        "languages",
        "source_tree",
        "readme",
        "manifest",
      ]),
    );
    expect(JSON.stringify(snapshot)).not.toContain(`ghp_${"A".repeat(36)}`);
    expect(fetcher).toHaveBeenCalledTimes(6);
  });

  it("classifies a zero-remaining 403 as a rate limit", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse(
        { message: "rate limited" },
        { status: 403, headers: { "x-ratelimit-remaining": "0" } },
      ),
    ) as typeof fetch;

    await expect(
      ingestPublicGitHubRepository("https://github.com/acme/demo", { fetch: fetcher }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
  });

  it("rejects a tree over the configured limit before fetching file content", async () => {
    const fetcher = createGitHubFetch();
    await expect(
      ingestPublicGitHubRepository("https://github.com/acme/demo", {
        fetch: fetcher,
        limits: { maxTreeEntries: 2 },
      }),
    ).rejects.toMatchObject({ code: "OVERSIZED_REPOSITORY", status: 413 });
  });
});
