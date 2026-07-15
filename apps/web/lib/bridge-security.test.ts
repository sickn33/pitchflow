import { describe, expect, it } from "vitest";

import { BridgeSecurityStore } from "./bridge-security";

const PUBLIC_ORIGIN = "https://pitchflow-ten.vercel.app";

function deterministicRandom() {
  let value = 0;
  return (bytes: number) => Buffer.alloc(bytes, ++value);
}

function project() {
  return {
    repositoryUrl: "https://github.com/sickn33/VibePalette",
    preferences: {
      audience: "Developers shipping browser extensions",
      positioning: "A precise palette workflow",
      visualDirection: "Dark product UI with measured color accents",
      tone: "precise" as const,
      channels: ["x", "linkedin"] as const,
    },
    captures: [
      {
        id: "capture-one",
        order: 0,
        fileName: "one.png",
        label: "Primary interface",
        description: "The primary VibePalette product interface.",
        provenance: "creator-owned" as const,
        mediaType: "image/png" as const,
        dataUrl: `data:image/png;base64,${Buffer.alloc(24, 1).toString("base64")}`,
      },
      {
        id: "capture-two",
        order: 1,
        fileName: "two.png",
        label: "Secondary interface",
        description: "The secondary VibePalette product interface.",
        provenance: "creator-owned" as const,
        mediaType: "image/png" as const,
        dataUrl: `data:image/png;base64,${Buffer.alloc(24, 2).toString("base64")}`,
      },
    ],
  };
}

function requestId(seed: string) {
  return Buffer.from(seed.padEnd(16, "x")).toString("base64url");
}

describe("BridgeSecurityStore", () => {
  it("creates high-entropy pairing and session material and delivers the session once", () => {
    const store = new BridgeSecurityStore({ random: deterministicRandom() });
    const pairing = store.requestPairing(PUBLIC_ORIGIN, project());
    expect(Buffer.from(pairing.pairingId, "base64url")).toHaveLength(24);
    expect(store.pendingPairings()).toHaveLength(1);

    store.decidePairing(pairing.pairingId, "approve");
    const first = store.pollPairing(PUBLIC_ORIGIN, pairing.pairingId);
    expect(first.status).toBe("approved");
    if (first.status !== "approved") throw new Error("Expected approval.");
    expect(Buffer.from(first.sessionToken!, "base64url")).toHaveLength(32);
    const second = store.pollPairing(PUBLIC_ORIGIN, pairing.pairingId);
    expect(second).toMatchObject({ status: "approved" });
    if (second.status === "approved") expect(second.sessionToken).toBeUndefined();
  });

  it("binds pairing and session use to the exact initiating origin", () => {
    const store = new BridgeSecurityStore({ random: deterministicRandom() });
    const pairing = store.requestPairing(PUBLIC_ORIGIN, project());
    expect(() => store.pollPairing("https://evil.example", pairing.pairingId)).toThrow(
      /different browser origin/i,
    );
    store.decidePairing(pairing.pairingId, "approve");
    const approval = store.pollPairing(PUBLIC_ORIGIN, pairing.pairingId);
    if (approval.status !== "approved" || !approval.sessionToken) {
      throw new Error("Expected a session token.");
    }
    expect(() =>
      store.authenticate({
        origin: "https://evil.example",
        authorization: `Bearer ${approval.sessionToken}`,
        requestId: requestId("origin"),
      }),
    ).toThrow(/different browser origin/i);
    const changedProject = project();
    changedProject.repositoryUrl = "https://github.com/openai/codex";
    const authenticated = store.authenticate({
      origin: PUBLIC_ORIGIN,
      authorization: `Bearer ${approval.sessionToken}`,
      requestId: requestId("project"),
    });
    expect(() => store.assertProject(authenticated.id, changedProject)).toThrow(/does not match/i);
    expect(store.assertProject(authenticated.id, project()).repositoryUrl).toBe(
      "https://github.com/sickn33/VibePalette",
    );
  });

  it("expires pairings and sessions using bounded lifetimes", () => {
    let now = 1_000;
    const store = new BridgeSecurityStore({
      now: () => now,
      random: deterministicRandom(),
      pairingTtlMs: 100,
      sessionTtlMs: 200,
    });
    const expiredPairing = store.requestPairing(PUBLIC_ORIGIN, project());
    now = 1_101;
    expect(store.pollPairing(PUBLIC_ORIGIN, expiredPairing.pairingId)).toEqual({
      status: "expired",
    });

    const pairing = store.requestPairing(PUBLIC_ORIGIN, project());
    store.decidePairing(pairing.pairingId, "approve");
    const approval = store.pollPairing(PUBLIC_ORIGIN, pairing.pairingId);
    if (approval.status !== "approved" || !approval.sessionToken) {
      throw new Error("Expected a session token.");
    }
    now += 201;
    expect(() =>
      store.authenticate({
        origin: PUBLIC_ORIGIN,
        authorization: `Bearer ${approval.sessionToken}`,
        requestId: requestId("expired"),
      }),
    ).toThrow(/expired/i);
  });

  it("rejects replayed mutations and malformed bearer or request ids", () => {
    const store = new BridgeSecurityStore({ random: deterministicRandom() });
    const pairing = store.requestPairing(PUBLIC_ORIGIN, project());
    store.decidePairing(pairing.pairingId, "approve");
    const approval = store.pollPairing(PUBLIC_ORIGIN, pairing.pairingId);
    if (approval.status !== "approved" || !approval.sessionToken) {
      throw new Error("Expected a session token.");
    }
    const id = requestId("replay");
    const authenticate = () =>
      store.authenticate({
        origin: PUBLIC_ORIGIN,
        authorization: `Bearer ${approval.sessionToken}`,
        requestId: id,
      });
    expect(authenticate()).toMatchObject({ origin: PUBLIC_ORIGIN });
    expect(authenticate).toThrow(/replayed/i);
    expect(() =>
      store.authenticate({
        origin: PUBLIC_ORIGIN,
        authorization: "Bearer visible-secret",
        requestId: requestId("bad-token"),
      }),
    ).toThrow(/approved local companion session/i);
  });

  it("rejects repeated decisions and preserves only bounded project summaries", () => {
    const store = new BridgeSecurityStore({ random: deterministicRandom() });
    const pairing = store.requestPairing(PUBLIC_ORIGIN, project());
    const pending = store.pendingPairings()[0]!;
    expect(pending).toMatchObject({
      origin: PUBLIC_ORIGIN,
      repositoryUrl: "https://github.com/sickn33/VibePalette",
    });
    expect(JSON.stringify(pending)).not.toContain("sessionToken");
    expect(pending.captures).toHaveLength(2);
    expect(pending.captures[0]?.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    store.decidePairing(pairing.pairingId, "reject");
    expect(store.pollPairing(PUBLIC_ORIGIN, pairing.pairingId)).toEqual({ status: "rejected" });
    expect(() => store.decidePairing(pairing.pairingId, "approve")).toThrow(/already decided/i);
  });

  it("caps pending pairings and active sessions per origin", () => {
    const store = new BridgeSecurityStore({
      random: deterministicRandom(),
      maxPendingPairings: 2,
      maxPendingPairingsPerOrigin: 1,
      maxSessions: 1,
      maxSessionsPerOrigin: 1,
    });
    const first = store.requestPairing(PUBLIC_ORIGIN, project());
    expect(() => store.requestPairing(PUBLIC_ORIGIN, project())).toThrow(/too many pending/i);
    store.decidePairing(first.pairingId, "approve");
    const second = store.requestPairing(PUBLIC_ORIGIN, project());
    expect(() => store.decidePairing(second.pairingId, "approve")).toThrow(
      /too many active sessions/i,
    );
  });

  it("issues short-lived one-time local approval challenges", () => {
    let now = 10_000;
    const store = new BridgeSecurityStore({ now: () => now, random: deterministicRandom() });
    const token = store.issueLocalApprovalToken();
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    store.consumeLocalApprovalToken(token);
    expect(() => store.consumeLocalApprovalToken(token)).toThrow(/already used/i);
    const expired = store.issueLocalApprovalToken();
    now += 2 * 60 * 1_000 + 1;
    expect(() => store.consumeLocalApprovalToken(expired)).toThrow(/expired|already used/i);
  });
});
