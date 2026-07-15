import { fileURLToPath } from "node:url";

import { createTestFixtureCaptures, DEFAULT_CAMPAIGN_MANIFEST } from "./fixture";
import { renderCampaignVideo } from "./render";

const layout = process.argv[2] === "portrait" ? "portrait" : "landscape";
const outputPath = fileURLToPath(
  new URL(`../artifacts/smoke/pitchflow-${layout}-smoke.mp4`, import.meta.url),
);

const metadata = await renderCampaignVideo({
  manifest: DEFAULT_CAMPAIGN_MANIFEST,
  layout,
  outputPath,
  scale: 0.25,
  overwrite: true,
  captures: createTestFixtureCaptures(),
  onProgress: ({ stage, progress, renderedFrames, totalFrames }) => {
    if (stage === "complete" || renderedFrames % 150 === 0) {
      process.stdout.write(
        `${stage.padEnd(11)} ${(progress * 100).toFixed(1).padStart(6)}% ${renderedFrames}/${totalFrames}\n`,
      );
    }
  },
});

process.stdout.write(`${JSON.stringify(metadata, null, 2)}\n`);
