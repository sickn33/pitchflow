import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { DEFAULT_CAMPAIGN_MANIFEST } from "./fixture";
import { getCaptureMotionPlan, selectSceneCaptures } from "./PitchFlowComposition";
import type { PreparedCapture } from "./contracts";

describe("audience-only composition copy", () => {
  it("never references the internal visual-direction field", async () => {
    const source = await readFile(new URL("./PitchFlowComposition.tsx", import.meta.url), "utf8");

    expect(source).not.toContain("visualDirection");
    expect(source).toContain("scene.audienceCaption");
    expect(source).not.toContain("{scene.visual.toUpperCase()}");
    expect(source).toContain("manifest.productBrief.productName");
    expect(source).not.toContain("capture.sha256.slice");
    expect(source).not.toContain('textOverflow: "ellipsis"');
  });

  it("assigns distinct, deterministic feature focus to every substantive scene", () => {
    const visuals = ["opening", "repository", "evidence", "workspace", "exports"] as const;
    const landscape = visuals.map((visual) => getCaptureMotionPlan(visual, "landscape"));

    expect(new Set(landscape.map((plan) => `${plan.focusX}:${plan.focusY}`))).toHaveLength(
      visuals.length,
    );
    expect(new Set(landscape.map((plan) => plan.featureLabel))).toHaveLength(visuals.length);
    expect(landscape.every((plan) => plan.endScale > plan.startScale)).toBe(true);
  });

  it("uses a tighter social-native motion plan for portrait video", () => {
    const landscape = getCaptureMotionPlan("workspace", "landscape");
    const portrait = getCaptureMotionPlan("workspace", "portrait");

    expect(portrait.startScale).toBeGreaterThan(landscape.startScale);
    expect(portrait.endScale).toBeGreaterThan(landscape.endScale);
    expect(portrait.highlightWidth).toBeGreaterThan(landscape.highlightWidth);
  });

  it("keeps direct scene captures and carries unique real captures into the closing CTA", () => {
    const scenes = DEFAULT_CAMPAIGN_MANIFEST.video.scenes;
    const capture = (id: string, sceneIndex: number, sha256: string): PreparedCapture => ({
      id,
      sceneIndex,
      order: 0,
      alt: `${id} product UI`,
      publicPath: `captures/${id}.png`,
      sha256,
      bytes: 100,
      mediaType: "image/png",
      width: 1600,
      height: 900,
    });
    const captures = [
      capture("first", 1, "a".repeat(64)),
      capture("second", 2, "b".repeat(64)),
      capture("second-reused", 5, "b".repeat(64)),
      capture("third", 5, "c".repeat(64)),
    ];

    expect(selectSceneCaptures(captures, scenes[0]!)).toEqual([captures[0]]);
    expect(selectSceneCaptures(captures, scenes.at(-1)!)).toEqual([captures[2], captures[3]]);
  });
});
