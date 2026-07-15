import { BUILD_WEEK_DEMO_DURATION_FRAMES, type DemoSection } from "./demo-contracts";

export const DEMO_SECTIONS: DemoSection[] = [
  { id: "promise", label: "The problem and promise", startFrame: 0, durationInFrames: 459 },
  { id: "judge", label: "Judge path first", startFrame: 459, durationInFrames: 630 },
  { id: "local", label: "Working local flow", startFrame: 1089, durationInFrames: 774 },
  { id: "gpt", label: "Material GPT-5.6 integration", startFrame: 1863, durationInFrames: 804 },
  {
    id: "export",
    label: "Edit once, export every channel",
    startFrame: 2667,
    durationInFrames: 744,
  },
  { id: "codex", label: "How Codex built the product", startFrame: 3411, durationInFrames: 831 },
  { id: "close", label: "Close", startFrame: 4242, durationInFrames: 546 },
];

export function validateDemoTimeline(sections: DemoSection[] = DEMO_SECTIONS): DemoSection[] {
  let cursor = 0;
  for (const section of sections) {
    if (section.startFrame !== cursor) {
      throw new Error(
        `Demo section ${section.id} starts at ${section.startFrame}; expected ${cursor}.`,
      );
    }
    if (section.durationInFrames <= 0) {
      throw new Error(`Demo section ${section.id} must have a positive duration.`);
    }
    cursor += section.durationInFrames;
  }
  if (cursor !== BUILD_WEEK_DEMO_DURATION_FRAMES) {
    throw new Error(
      `Demo timeline contains ${cursor} frames; expected ${BUILD_WEEK_DEMO_DURATION_FRAMES}.`,
    );
  }
  return sections;
}
