import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  BUILD_WEEK_DEMO_DURATION_FRAMES,
  BUILD_WEEK_DEMO_DURATION_SECONDS,
  BUILD_WEEK_DEMO_FPS,
  BUILD_WEEK_DEMO_HEIGHT,
  BUILD_WEEK_DEMO_WIDTH,
  DEMO_ASSET_KEYS,
  DEMO_SOURCE_PATHS,
} from "./demo-contracts";
import { DEMO_SECTIONS, validateDemoTimeline } from "./demo-timeline";

describe("Build Week demo contract", () => {
  it("fills the exact narration duration with seven contiguous sections", () => {
    const sections = validateDemoTimeline();
    const last = sections.at(-1)!;

    expect(sections).toHaveLength(7);
    expect(last.startFrame + last.durationInFrames).toBe(BUILD_WEEK_DEMO_DURATION_FRAMES);
    expect(BUILD_WEEK_DEMO_DURATION_FRAMES / BUILD_WEEK_DEMO_FPS).toBe(
      BUILD_WEEK_DEMO_DURATION_SECONDS,
    );
    expect(BUILD_WEEK_DEMO_DURATION_SECONDS).toBeLessThan(180);
  });

  it("uses the required 1080p delivery geometry", () => {
    expect({ width: BUILD_WEEK_DEMO_WIDTH, height: BUILD_WEEK_DEMO_HEIGHT }).toEqual({
      width: 1920,
      height: 1080,
    });
    expect(BUILD_WEEK_DEMO_FPS).toBe(30);
  });

  it("allowlists only creator-owned local source paths", () => {
    expect(Object.keys(DEMO_SOURCE_PATHS).sort()).toEqual([...DEMO_ASSET_KEYS].sort());
    for (const path of Object.values(DEMO_SOURCE_PATHS)) {
      expect(path).not.toMatch(/^https?:/);
      expect(path).toMatch(
        /^(apps\/web\/public\/dogfood\/pitchflow\/v1|submission\/(demo|media))\//,
      );
    }
  });

  it("never reconstructs product UI or loads a remote visual source", async () => {
    const source = await readFile(new URL("./DemoComposition.tsx", import.meta.url), "utf8");

    expect(source).not.toContain("https://");
    expect(source).not.toContain("http://");
    expect(source).toContain("staticFile(");
    expect(source).toContain("OffthreadVideo");
  });

  it("keeps the authored section labels in the required order", () => {
    expect(DEMO_SECTIONS.map((section) => section.id)).toEqual([
      "promise",
      "judge",
      "local",
      "gpt",
      "export",
      "codex",
      "close",
    ]);
  });
});
