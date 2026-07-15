import { fileURLToPath } from "node:url";

import { renderBuildWeekDemo } from "./demo-render";

const outputPath = fileURLToPath(
  new URL("../artifacts/demo/pitchflow-build-week-demo.mp4", import.meta.url),
);
const reportPath = fileURLToPath(
  new URL("../artifacts/demo/pitchflow-build-week-demo-report.json", import.meta.url),
);

const report = await renderBuildWeekDemo({
  outputPath,
  reportPath,
  overwrite: true,
  onProgress: ({ stage, progress, renderedFrames, totalFrames }) => {
    if (stage !== "rendering" || renderedFrames % 150 === 0) {
      process.stdout.write(
        `${stage.padEnd(11)} ${(progress * 100).toFixed(1).padStart(6)}% ${renderedFrames}/${totalFrames}\n`,
      );
    }
  },
});

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
