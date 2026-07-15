import { describe, expect, it } from "vitest";

import {
  assertSafeArchivePath,
  containsBinaryData,
  redactPotentialSecrets,
  safeExcerpt,
} from "./security";

describe("repository content safety", () => {
  it("redacts common credential shapes before evidence is stored", () => {
    const token = `ghp_${"A".repeat(36)}`;
    const databaseUrl = "postgres://demo-user:demo-password@example.invalid/db";
    const jwt = `eyJ${"a".repeat(20)}.${"b".repeat(20)}.${"c".repeat(20)}`;
    const output = redactPotentialSecrets(
      `token=${token}\napi_key=super-secret-value-123\nDATABASE_URL=${databaseUrl}\nJWT=${jwt}`,
    );
    expect(output).not.toContain(token);
    expect(output).not.toContain("super-secret-value-123");
    expect(output).not.toContain(databaseUrl);
    expect(output).not.toContain(jwt);
    expect(output).toContain("[REDACTED_POTENTIAL_SECRET]");
  });

  it("normalizes and bounds evidence excerpts", () => {
    expect(safeExcerpt("  hello   world\n\n\nnext  ", 20)).toBe("hello world\n\nnext");
    expect(safeExcerpt("x".repeat(30), 10)).toBe("xxxxxxxxx…");
  });

  it("detects NUL and control-heavy or invalid UTF-8-like binary text", () => {
    expect(containsBinaryData("hello\0world")).toBe(true);
    expect(containsBinaryData(`header${"\u0001".repeat(8)}tail`)).toBe(true);
    expect(containsBinaryData(`header${"�".repeat(8)}tail`)).toBe(true);
    expect(containsBinaryData("hello world")).toBe(false);
    expect(containsBinaryData("one\ttwo\nthree")).toBe(false);
  });
});

describe("archive path safety", () => {
  it.each(["../secret", "assets/../../secret", "/absolute", "\\absolute", "bad\0path"])(
    "rejects %s",
    (path) => expect(() => assertSafeArchivePath(path)).toThrow(/Unsafe archive path/),
  );

  it("accepts a nested relative export path", () => {
    expect(() => assertSafeArchivePath("social/card-01.png")).not.toThrow();
  });
});
