import { describe, expect, it } from "vitest";

import { LOCAL_SITE_ORIGIN, PUBLIC_SITE_ORIGIN, resolveMetadataBase } from "./site-url";

describe("metadata base", () => {
  it("pins every production build to the HTTPS public viewer", () => {
    const productionInputs = [
      {},
      { NEXT_PUBLIC_SITE_URL: "http://localhost:3210" },
      { NEXT_PUBLIC_SITE_URL: "http://attacker.invalid" },
    ];

    for (const input of productionInputs) {
      const metadataBase = resolveMetadataBase({ NODE_ENV: "production", ...input });
      expect(metadataBase.origin).toBe(PUBLIC_SITE_ORIGIN);
      expect(metadataBase.protocol).toBe("https:");
      expect(metadataBase.hostname).not.toBe("localhost");
    }
  });

  it("keeps the deterministic loopback default outside production", () => {
    expect(resolveMetadataBase({ NODE_ENV: "development" }).origin).toBe(LOCAL_SITE_ORIGIN);
  });

  it("honors an explicit development origin without affecting production", () => {
    expect(
      resolveMetadataBase({
        NODE_ENV: "development",
        NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:4321",
      }).origin,
    ).toBe("http://127.0.0.1:4321");
  });

  it("rejects non-web development origins", () => {
    expect(() =>
      resolveMetadataBase({ NODE_ENV: "development", NEXT_PUBLIC_SITE_URL: "file:///tmp" }),
    ).toThrow(/HTTP or HTTPS/);
  });
});
