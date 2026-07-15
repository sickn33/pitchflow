import { describe, expect, it } from "vitest";

import { codexCapability, detectProviderCapabilities } from "./provider-status";

describe("provider capability detection", () => {
  it("enables only locally authenticated ChatGPT-backed Codex", () => {
    expect(
      codexCapability({
        authenticated: true,
        method: "chatgpt",
        cliVersion: "0.144.4",
        credentialValuesRead: false,
      }),
    ).toMatchObject({ provider: "codex", status: "connected", selectable: true });
  });

  it("refuses Codex API-key mode to avoid implicit Platform spend", () => {
    expect(
      codexCapability({
        authenticated: true,
        method: "api-key",
        cliVersion: "0.144.4",
        credentialValuesRead: false,
      }),
    ).toMatchObject({ status: "authentication_required", selectable: false });
  });

  it("distinguishes missing and authentication-required Codex", () => {
    expect(
      codexCapability({
        authenticated: false,
        method: "unknown",
        cliVersion: null,
        credentialValuesRead: false,
      }).status,
    ).toBe("missing");
    expect(
      codexCapability({
        authenticated: false,
        method: "unknown",
        cliVersion: "0.144.4",
        credentialValuesRead: false,
      }).status,
    ).toBe("authentication_required");
  });

  it("returns a failed status without exposing detector errors", async () => {
    const providers = await detectProviderCapabilities({
      inspectCodex: async () => {
        throw new Error("secret-provider-diagnostic");
      },
      detectClaude: async () => {
        throw new Error("secret-claude-diagnostic");
      },
    });
    expect(providers.map((provider) => provider.status)).toEqual(["failed", "failed"]);
    expect(JSON.stringify(providers)).not.toContain("secret-");
  });
});
