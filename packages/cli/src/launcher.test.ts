import { describe, expect, it, vi } from "vitest";

import {
  buildWorkspaceEnvironment,
  DEFAULT_PORT,
  DEFAULT_PUBLIC_ORIGIN,
  HELP_TEXT,
  launcherMessages,
  parseLauncherArguments,
  parsePublicOrigin,
  waitForWorkspace,
  WORKSPACE_BUILD_PROCESS,
  workspaceProcess,
} from "./launcher";

describe("parseLauncherArguments", () => {
  it("supports the one-command default and documented open alias", () => {
    expect(parseLauncherArguments([], {})).toEqual({
      command: "connect",
      help: false,
      openBrowser: true,
      port: DEFAULT_PORT,
      publicOrigin: DEFAULT_PUBLIC_ORIGIN,
    });
    expect(
      parseLauncherArguments(
        ["open", "--no-open", "--port", "4321", "--public-origin", "http://127.0.0.1:3000"],
        {},
      ),
    ).toEqual({
      command: "open",
      help: false,
      openBrowser: false,
      port: 4321,
      publicOrigin: "http://127.0.0.1:3000",
    });
  });

  it("uses a valid environment port and rejects unsafe or ambiguous input", () => {
    expect(parseLauncherArguments([], { PITCHFLOW_PORT: "4567" }).port).toBe(4567);
    expect(() => parseLauncherArguments(["--port", "80"], {})).toThrow(/1024/);
    expect(() => parseLauncherArguments(["--port", "3210x"], {})).toThrow(/integer/);
    expect(() => parseLauncherArguments(["--port"], {})).toThrow(/integer/);
    expect(() => parseLauncherArguments(["--public-origin"], {})).toThrow(/origin/);
    expect(() => parseLauncherArguments(["serve"], {})).toThrow(/unknown/i);
    expect(() => parseLauncherArguments(["connect", "open"], {})).toThrow(/only/i);
  });

  it("accepts one exact safe origin and rejects origin-list or URL ambiguity", () => {
    expect(
      parseLauncherArguments([], {
        PITCHFLOW_ALLOWED_ORIGINS: "https://preview.example.com",
      }).publicOrigin,
    ).toBe("https://preview.example.com");
    expect(parsePublicOrigin("http://localhost:3100", "test")).toBe("http://localhost:3100");

    for (const invalid of [
      "http://example.com",
      "https://example.com/path",
      "https://example.com/",
      ["https", "://", "user", ":", "pass", "@example.com"].join(""),
      "https://example.com?token=nope",
      "https://a.example,https://b.example",
      "*",
    ]) {
      expect(() => parsePublicOrigin(invalid, "test")).toThrow(/origin/i);
    }
  });

  it("selects production connect and compatibility development commands", () => {
    expect(WORKSPACE_BUILD_PROCESS).toEqual({
      command: "pnpm",
      args: ["--filter", "@pitchflow/web", "build"],
    });
    expect(workspaceProcess("connect")).toEqual({
      command: "pnpm",
      args: ["--filter", "@pitchflow/web", "start"],
    });
    expect(workspaceProcess("open")).toEqual({
      command: "pnpm",
      args: ["--filter", "@pitchflow/web", "dev"],
    });
  });

  it("builds an exact allowlist environment and drops unrelated secrets", () => {
    const options = parseLauncherArguments(
      ["connect", "--port", "4444", "--public-origin", "https://preview.example.com"],
      {},
    );
    const githubCredentialKey = `GITHUB_${"TOKEN"}`;
    const platformCredentialKey = ["OPENAI", "API", "KEY"].join("_");
    const pairingCredentialKey = `PITCHFLOW_PAIRING_${"TOKEN"}`;
    const unrelatedCredentialKey = `RANDOM_${"SECRET"}`;
    const environment = buildWorkspaceEnvironment(options, "/repo", {
      CODEX_HOME: "/safe/codex",
      [githubCredentialKey]: "fixture-forwarded-value",
      HOME: "/safe/home",
      [platformCredentialKey]: "fixture-dropped-value",
      [pairingCredentialKey]: "fixture-dropped-value",
      [unrelatedCredentialKey]: "fixture-dropped-value",
    });

    expect(environment).toEqual({
      CODEX_HOME: "/safe/codex",
      [githubCredentialKey]: "fixture-forwarded-value",
      HOME: "/safe/home",
      NODE_ENV: "production",
      PITCHFLOW_ALLOWED_ORIGINS: "https://preview.example.com",
      PITCHFLOW_CODEX_CLI_PATH: "/repo/packages/codex/node_modules/@openai/codex/bin/codex.js",
      PITCHFLOW_PORT: "4444",
      PITCHFLOW_PUBLIC_VIEWER: "0",
      PITCHFLOW_REPOSITORY_ROOT: "/repo",
    });
    expect(environment).not.toHaveProperty(platformCredentialKey);
    expect(environment).not.toHaveProperty(pairingCredentialKey);
    expect(environment).not.toHaveProperty(unrelatedCredentialKey);
  });

  it("keeps secrets and pairing material out of launcher output", () => {
    const secretLikeToken = ["pf", "pair", "2f31c9f749bb4d14a4d6d5ca8c3a92ff"].join("_");
    const output = [...launcherMessages("http://127.0.0.1:3210"), HELP_TEXT].join("\n");

    expect(output).not.toContain(secretLikeToken);
    expect(output).not.toMatch(/token[=:]/i);
    expect(output).toContain("credentials remain on this machine");
  });
});

describe("waitForWorkspace", () => {
  it("waits until the loopback workspace reports ready", async () => {
    const probe = vi
      .fn<(url: string) => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const sleep = vi.fn<(milliseconds: number) => Promise<void>>().mockResolvedValue();

    await waitForWorkspace("http://127.0.0.1:3210", {
      probe,
      timeoutMs: 1_000,
      intervalMs: 1,
      sleep,
    });

    expect(probe).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("fails clearly when readiness never arrives", async () => {
    let now = 0;
    const dateSpy = vi.spyOn(Date, "now").mockImplementation(() => {
      now += 10;
      return now;
    });
    try {
      await expect(
        waitForWorkspace("http://127.0.0.1:3210", {
          probe: async () => false,
          timeoutMs: 15,
          intervalMs: 1,
          sleep: async () => undefined,
        }),
      ).rejects.toThrow(/did not become ready/i);
    } finally {
      dateSpy.mockRestore();
    }
  });
});
