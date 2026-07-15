import { describe, expect, it } from "vitest";

import { createTestFixtureCaptures, DEFAULT_CAMPAIGN_MANIFEST } from "./fixture";
import { renderCampaignVideo } from "./render";
import type { PitchFlowRenderError } from "./render";

describe("renderCampaignVideo preflight", () => {
  it("rejects unsafe scales before browser or filesystem work", async () => {
    await expect(
      renderCampaignVideo({
        manifest: DEFAULT_CAMPAIGN_MANIFEST,
        layout: "landscape",
        outputPath: "/tmp/should-not-render.mp4",
        scale: 0,
        captures: createTestFixtureCaptures(),
      }),
    ).rejects.toMatchObject({
      name: "PitchFlowRenderError",
      stage: "validation",
    } satisfies Partial<PitchFlowRenderError>);
  });

  it("rejects scales that produce fractional H.264 dimensions", async () => {
    await expect(
      renderCampaignVideo({
        manifest: DEFAULT_CAMPAIGN_MANIFEST,
        layout: "portrait",
        outputPath: "/tmp/should-not-render.mp4",
        scale: 0.123,
        captures: createTestFixtureCaptures(),
      }),
    ).rejects.toMatchObject({
      name: "PitchFlowRenderError",
      stage: "validation",
    } satisfies Partial<PitchFlowRenderError>);
  });

  it("reports a missing explicit browser as an actionable browser-stage error", async () => {
    await expect(
      renderCampaignVideo({
        manifest: DEFAULT_CAMPAIGN_MANIFEST,
        layout: "portrait",
        outputPath: "/tmp/should-not-render.mp4",
        browserExecutable: "/tmp/pitchflow-no-browser",
        captures: createTestFixtureCaptures(),
      }),
    ).rejects.toMatchObject({
      name: "PitchFlowRenderError",
      stage: "browser",
    } satisfies Partial<PitchFlowRenderError>);
  });
});
