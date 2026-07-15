import { describe, expect, it } from "vitest";

import { DEFAULT_CAMPAIGN_MANIFEST } from "./fixture";
import {
  PitchFlowTimelineError,
  getEvidenceLabel,
  getLayoutDimensions,
  getSafeZone,
  validateVideoTimeline,
} from "./timeline";

describe("manifest-driven video timeline", () => {
  it("accepts a contiguous 30fps timeline that exactly fills the duration", () => {
    const manifest = validateVideoTimeline(DEFAULT_CAMPAIGN_MANIFEST);
    const lastScene = manifest.video.scenes.at(-1);

    expect(manifest.video.durationSeconds).toBe(30);
    expect(lastScene).toBeDefined();
    expect(lastScene!.startFrame + lastScene!.durationFrames).toBe(900);
  });

  it("rejects a scene gap with an actionable frame error", () => {
    const manifest = structuredClone(DEFAULT_CAMPAIGN_MANIFEST);
    manifest.video.scenes[2]!.startFrame += 1;

    expect(() => validateVideoTimeline(manifest)).toThrowError(PitchFlowTimelineError);
    expect(() => validateVideoTimeline(manifest)).toThrow("expected 300");
  });

  it("rejects a timeline whose scene duration does not fill the declared video", () => {
    const manifest = structuredClone(DEFAULT_CAMPAIGN_MANIFEST);
    manifest.video.scenes.at(-1)!.durationFrames -= 30;

    expect(() => validateVideoTimeline(manifest)).toThrow("video duration requires 900 frames");
  });
});

describe("layout and evidence contracts", () => {
  it("exposes exact full-resolution landscape and portrait layouts", () => {
    expect(getLayoutDimensions("landscape")).toEqual({ width: 1920, height: 1080 });
    expect(getLayoutDimensions("portrait")).toEqual({ width: 1080, height: 1920 });
  });

  it("keeps captions and labels inside explicit per-layout safe zones", () => {
    expect(getSafeZone("landscape")).toEqual({ top: 76, right: 120, bottom: 92, left: 120 });
    expect(getSafeZone("portrait")).toEqual({ top: 144, right: 72, bottom: 180, left: 72 });
  });

  it("renders stable evidence labels without inventing source facts", () => {
    expect(getEvidenceLabel(["ev_0123456789ab", "ev_123456789abc"])).toBe(
      "EV 0123456789AB · EV 123456789ABC",
    );
    expect(getEvidenceLabel([])).toBe("Narrative transition");
  });
});
