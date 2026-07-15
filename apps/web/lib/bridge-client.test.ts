import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BRIDGE_ORIGIN,
  PitchFlowBridgeClient,
  isAllowedPublicTransferOrigin,
  isCompanionTransferMessage,
  type BridgeProjectState,
} from "./bridge-client";

const project: BridgeProjectState = {
  repositoryUrl: "https://github.com/openai/openai-node",
  preferences: {
    audience: "TypeScript developers",
    positioning: "A typed API client",
    visualDirection: "Editorial product clarity",
    tone: "precise",
    channels: ["x", "linkedin"],
  },
  captures: [0, 1].map((order) => ({
    id: `capture_${order}`,
    order,
    fileName: `screen-${order + 1}.png`,
    label: `Product screen ${order + 1}`,
    description: `A real product workspace screen number ${order + 1}.`,
    provenance: "creator-owned" as const,
    mediaType: "image/png" as const,
    dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
  })),
  provider: "codex",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function requestBody(init: RequestInit | undefined): string {
  return typeof init?.body === "string" ? init.body : "";
}

afterEach(() => vi.restoreAllMocks());

describe("PitchFlowBridgeClient", () => {
  it("probes only the fixed loopback origin without browser credentials", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      json({
        status: "connected",
        provider: "codex",
        message: "Codex is authenticated locally through ChatGPT.",
        engine: {
          status: "connected",
          provider: "codex",
          message: "Codex is authenticated locally through ChatGPT.",
        },
        providers: [
          {
            provider: "codex",
            status: "connected",
            message: "Codex is authenticated locally through ChatGPT.",
            selectable: true,
          },
        ],
      }),
    );
    const client = new PitchFlowBridgeClient(fetcher);

    await expect(client.getStatus()).resolves.toMatchObject({ status: "connected" });

    const [url, init] = fetcher.mock.calls[0]!;
    expect(requestUrl(url)).toBe(`${BRIDGE_ORIGIN}/api/bridge/status`);
    expect(init).toMatchObject({ credentials: "omit", mode: "cors", cache: "no-store" });
    expect(new Headers(init?.headers).get("authorization")).toBeNull();
    expect(new Headers(init?.headers).get("x-pitchflow-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keeps the one-time session token out of URLs and request bodies", async () => {
    const token = "s".repeat(43);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ status: "approved", sessionToken: token }))
      .mockResolvedValueOnce(json({ jobId: "j".repeat(24) }));
    const client = new PitchFlowBridgeClient(fetcher);

    await client.pollPairing("pair_123");
    await client.startJob(project);

    const [pairUrl, pairInit] = fetcher.mock.calls[0]!;
    const [jobUrl, jobInit] = fetcher.mock.calls[1]!;
    expect(requestUrl(pairUrl)).not.toContain(token);
    expect(requestBody(pairInit)).not.toContain(token);
    expect(requestUrl(jobUrl)).not.toContain(token);
    expect(requestBody(jobInit)).not.toContain(token);
    expect(new Headers(jobInit?.headers).get("authorization")).toBe(`Bearer ${token}`);
    expect(new Headers(pairInit?.headers).get("x-pitchflow-request-id")).not.toBe(
      new Headers(jobInit?.headers).get("x-pitchflow-request-id"),
    );
  });

  it("clears the private session after an authentication rejection", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ status: "approved", sessionToken: "t".repeat(43) }))
      .mockResolvedValueOnce(json({ error: { message: "expired" } }, 401));
    const client = new PitchFlowBridgeClient(fetcher);
    await client.pollPairing("pair_expiring");
    await expect(client.startJob(project)).rejects.toThrow("expired");
    await expect(client.startJob(project)).rejects.toThrow(/pair with/i);
  });

  it("downloads protected result bytes by POSTing an owned job path", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ status: "approved", sessionToken: "t".repeat(43) }))
      .mockResolvedValueOnce(new Response(new Blob(["asset"]), { status: 200 }));
    const client = new PitchFlowBridgeClient(fetcher);
    await client.pollPairing("pair_asset");
    const blob = await client.getAsset("job_123", "videos/launch-landscape.mp4");

    expect(blob.size).toBe(5);
    const [url, init] = fetcher.mock.calls[1]!;
    expect(requestUrl(url)).toBe(`${BRIDGE_ORIGIN}/api/bridge/assets`);
    expect(JSON.parse(requestBody(init))).toEqual({
      jobId: "job_123",
      path: "videos/launch-landscape.mp4",
    });
    expect(new Headers(init?.headers).get("authorization")).toMatch(/^Bearer /);
  });

  it("keeps the local approval nonce private and sends it only as a local decision header", async () => {
    const approvalToken = "a".repeat(43);
    const pairingId = "p".repeat(32);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({
          approvalToken,
          pairings: [
            {
              pairingId,
              origin: "https://pitchflow-ten.vercel.app",
              repositoryUrl: project.repositoryUrl,
              audience: project.preferences.audience,
              channels: project.preferences.channels,
              captures: project.captures.map((capture) => ({
                fileName: capture.fileName,
                mediaType: capture.mediaType,
                encodedBytes: 1_024,
                contentSha256: "a".repeat(64),
              })),
              createdAt: "2026-07-15T10:00:00.000Z",
              expiresAt: "2026-07-15T10:05:00.000Z",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(json({ ok: true }));
    const client = new PitchFlowBridgeClient(fetcher);

    await expect(client.getPendingPairing()).resolves.toMatchObject({ pairingId });
    await client.decidePairing(pairingId, "approve");

    const [url, init] = fetcher.mock.calls[1]!;
    expect(requestUrl(url)).not.toContain(approvalToken);
    expect(requestBody(init)).not.toContain(approvalToken);
    expect(new Headers(init?.headers).get("x-pitchflow-local-approval")).toBe(approvalToken);
    await expect(client.decidePairing(pairingId, "approve")).rejects.toThrow(/refresh/i);
  });
});

describe("explicit local workspace transfer", () => {
  it("accepts only exact product origins", () => {
    expect(isAllowedPublicTransferOrigin("https://pitchflow-ten.vercel.app")).toBe(true);
    expect(isAllowedPublicTransferOrigin("https://pitchflow-ten.vercel.app.evil.example")).toBe(
      false,
    );
    expect(isAllowedPublicTransferOrigin("http://127.0.0.1:3211")).toBe(true);
  });

  it("requires the versioned project transfer envelope", () => {
    const nonce = "n".repeat(32);
    expect(
      isCompanionTransferMessage({
        type: "pitchflow:project-transfer",
        version: 1,
        nonce,
        project,
      }),
    ).toBe(true);
    expect(
      isCompanionTransferMessage({
        type: "pitchflow:project-transfer",
        version: 1,
        project,
      }),
    ).toBe(false);
    expect(
      isCompanionTransferMessage({
        type: "pitchflow:project-transfer",
        version: 1,
        nonce: "short",
        project,
      }),
    ).toBe(false);
  });
});
