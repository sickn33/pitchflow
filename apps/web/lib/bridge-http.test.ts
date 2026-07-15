import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { bridgeOrigins, bridgePreflight, bridgeRequestContext } from "./bridge-http";

const ORIGINAL_ENV = { ...process.env };

function request(
  origin: string | null,
  headers: Record<string, string> = {},
  url = "http://127.0.0.1:3210/api/bridge/status",
) {
  return new Request(url, {
    method: headers["access-control-request-method"] ? "OPTIONS" : "GET",
    headers: {
      host: "127.0.0.1:3210",
      ...(origin ? { origin } : {}),
      ...headers,
    },
  });
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.VERCEL;
  process.env.PITCHFLOW_PUBLIC_VIEWER = "0";
  process.env.PITCHFLOW_PORT = "3210";
  process.env.PITCHFLOW_ALLOWED_ORIGINS = "https://pitchflow-ten.vercel.app";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("bridge HTTP boundary", () => {
  it("accepts only the exact configured public origin and loopback host", () => {
    expect(bridgeRequestContext(request("https://pitchflow-ten.vercel.app"))).toMatchObject({
      isLocal: false,
    });
    expect(() => bridgeRequestContext(request("https://evil.example"))).toThrow(/unapproved/i);
    expect(() =>
      bridgeRequestContext(
        new Request("http://127.0.0.1:3210/api/bridge/status", {
          headers: {
            host: "localhost:3210",
            origin: "https://pitchflow-ten.vercel.app",
          },
        }),
      ),
    ).toThrow(/exact 127\.0\.0\.1/i);
  });

  it("accepts Next's internal localhost URL normalization only with the exact host header", () => {
    expect(
      bridgeRequestContext(
        request("https://pitchflow-ten.vercel.app", {}, "http://localhost:3210/api/bridge/status"),
      ),
    ).toMatchObject({ isLocal: false, localOrigin: "http://127.0.0.1:3210" });
    expect(() =>
      bridgeRequestContext(
        new Request("http://localhost:3210/api/bridge/status", {
          headers: {
            host: "localhost:3210",
            origin: "https://pitchflow-ten.vercel.app",
          },
        }),
      ),
    ).toThrow(/exact 127\.0\.0\.1/i);
  });

  it("accepts an origin-less local GET only with same-origin fetch metadata", () => {
    expect(bridgeRequestContext(request(null, { "sec-fetch-site": "same-origin" }))).toMatchObject({
      isLocal: true,
    });
    expect(() => bridgeRequestContext(request(null))).toThrow(/unapproved/i);
  });

  it("fails closed in the Vercel/public runtime", () => {
    process.env.VERCEL = "1";
    expect(() => bridgeRequestContext(request("https://pitchflow-ten.vercel.app"))).toThrow(
      /only on the user's loopback runtime/i,
    );
  });

  it("rejects wildcard, credentialed, path, query, and comma-separated origins", () => {
    for (const value of [
      "*",
      ["https", "://", "user", ":", "pass", "@example.com"].join(""),
      "https://example.com/path",
      "https://example.com?preview=1",
      "https://one.example,https://two.example",
      "http://public.example",
    ]) {
      expect(() => bridgeOrigins({ PITCHFLOW_ALLOWED_ORIGINS: value })).toThrow(/exact|origin/i);
    }
  });

  it("answers a private-network preflight without wildcard CORS", () => {
    const response = bridgePreflight(
      request("https://pitchflow-ten.vercel.app", {
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type, authorization, x-pitchflow-request-id",
        "access-control-request-private-network": "true",
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://pitchflow-ten.vercel.app",
    );
    expect(response.headers.get("access-control-allow-origin")).not.toBe("*");
    expect(response.headers.get("access-control-allow-private-network")).toBe("true");
  });

  it("rejects unsupported preflight headers", () => {
    expect(() =>
      bridgePreflight(
        request("https://pitchflow-ten.vercel.app", {
          "access-control-request-method": "POST",
          "access-control-request-headers": "content-type, x-unsupported-header",
        }),
      ),
    ).toThrow(/unsupported headers/i);
  });

  it("rejects Origin null and suffix-confusion origins", () => {
    expect(() => bridgeRequestContext(request("null"))).toThrow(/unapproved/i);
    expect(() =>
      bridgeRequestContext(request("https://pitchflow-ten.vercel.app.evil.example")),
    ).toThrow(/unapproved/i);
  });
});
