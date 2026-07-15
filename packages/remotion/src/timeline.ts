import type { CampaignManifest } from "@pitchflow/core";

import type { LayoutDimensions, SafeZone, VideoLayout } from "./contracts";

export class PitchFlowTimelineError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PitchFlowTimelineError";
  }
}

export function getLayoutDimensions(layout: VideoLayout): LayoutDimensions {
  return layout === "portrait" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
}

export function getSafeZone(layout: VideoLayout): SafeZone {
  return layout === "portrait"
    ? { top: 144, right: 72, bottom: 180, left: 72 }
    : { top: 76, right: 120, bottom: 92, left: 120 };
}

export function validateVideoTimeline(input: CampaignManifest): CampaignManifest {
  if (input.video.fps !== 30) {
    throw new PitchFlowTimelineError("PitchFlow video must use 30fps.");
  }
  if (
    !Number.isInteger(input.video.durationSeconds) ||
    input.video.durationSeconds < 25 ||
    input.video.durationSeconds > 40
  ) {
    throw new PitchFlowTimelineError(
      `PitchFlow video duration must be an integer from 25 to 40 seconds; received ${input.video.durationSeconds}.`,
    );
  }
  if (input.video.scenes.length < 5 || input.video.scenes.length > 8) {
    throw new PitchFlowTimelineError(
      `PitchFlow video must contain 5 to 8 scenes; received ${input.video.scenes.length}.`,
    );
  }
  const manifest = input;
  const expectedFrames = manifest.video.durationSeconds * manifest.video.fps;
  let cursor = 0;

  for (const scene of manifest.video.scenes) {
    if (scene.startFrame !== cursor) {
      throw new PitchFlowTimelineError(
        `Scene ${scene.index} starts at frame ${scene.startFrame}; expected ${cursor}. Scenes must be contiguous.`,
      );
    }
    cursor += scene.durationFrames;
  }

  if (cursor !== expectedFrames) {
    throw new PitchFlowTimelineError(
      `Scene timeline is ${cursor} frames, but video duration requires ${expectedFrames} frames.`,
    );
  }

  return manifest;
}

export function getEvidenceLabel(evidenceIds: string[]): string {
  if (evidenceIds.length === 0) return "Narrative transition";
  return evidenceIds.map((id) => id.replace("ev_", "EV ").toUpperCase()).join(" · ");
}
