import { describe, expect, it } from "vitest";

import { readTrustedLocalJson } from "./http";

function request(body: string, headers: Record<string, string> = {}): Request {
  return new Request("http://127.0.0.1:3210/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

describe("local mutation request boundary", () => {
  it("accepts bounded same-origin JSON", async () => {
    await expect(
      readTrustedLocalJson(request('{"safe":true}', { origin: "http://127.0.0.1:3210" }), 100),
    ).resolves.toEqual({ safe: true });
  });

  it("accepts the equivalent loopback alias that Next.js uses for a 127.0.0.1 listener", async () => {
    await expect(
      readTrustedLocalJson(request('{"safe":true}', { origin: "http://localhost:3210" }), 100),
    ).resolves.toEqual({ safe: true });
  });

  it("rejects cross-origin, non-JSON, non-loopback, and oversized requests", async () => {
    await expect(
      readTrustedLocalJson(request("{}", { origin: "https://attacker.example" }), 100),
    ).rejects.toMatchObject({ code: "LOCAL_REQUEST_ORIGIN_REJECTED" });
    await expect(
      readTrustedLocalJson(request("{}", { origin: "http://localhost:3211" }), 100),
    ).rejects.toMatchObject({ code: "LOCAL_REQUEST_ORIGIN_REJECTED" });
    await expect(
      readTrustedLocalJson(request("{}", { origin: "https://localhost:3210" }), 100),
    ).rejects.toMatchObject({ code: "LOCAL_REQUEST_ORIGIN_REJECTED" });
    await expect(
      readTrustedLocalJson(request("{}", { "content-type": "text/plain" }), 100),
    ).rejects.toMatchObject({ code: "LOCAL_REQUEST_CONTENT_TYPE_REJECTED" });
    await expect(
      readTrustedLocalJson(
        new Request("http://pitchflow.example/api/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        }),
        100,
      ),
    ).rejects.toMatchObject({ code: "LOCAL_REQUEST_HOST_REJECTED" });
    await expect(readTrustedLocalJson(request('{"too":"large"}'), 4)).rejects.toMatchObject({
      code: "LOCAL_REQUEST_TOO_LARGE",
    });
  });
});
