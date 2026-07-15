import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("audience-only composition copy", () => {
  it("never references the internal visual-direction field", async () => {
    const source = await readFile(new URL("./PitchFlowComposition.tsx", import.meta.url), "utf8");

    expect(source).not.toContain("visualDirection");
    expect(source).toContain("scene.audienceCaption");
  });
});
