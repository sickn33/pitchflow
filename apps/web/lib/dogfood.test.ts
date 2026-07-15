import { describe, expect, it } from "vitest";

import { DOGFOOD_PACKAGE_URL, parseDogfoodPackage } from "./dogfood";

describe("cached dogfood integration", () => {
  it("uses a versioned immutable asset path", () => {
    expect(DOGFOOD_PACKAGE_URL).toBe("/dogfood/pitchflow/v1/judge-package.json");
  });

  it("rejects an absent or placeholder package", () => {
    expect(() => parseDogfoodPackage({})).toThrow(/judge package format/i);
    expect(() =>
      parseDogfoodPackage({ format: "pitchflow-judge-package", version: 1, assets: [] }),
    ).toThrow();
  });
});
