import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

import { stageDemoAssets } from "./demo-assets";
import {
  BUILD_WEEK_DEMO_COMPOSITION_ID,
  BUILD_WEEK_DEMO_DURATION_FRAMES,
  BUILD_WEEK_DEMO_DURATION_SECONDS,
  BUILD_WEEK_DEMO_FPS,
  BUILD_WEEK_DEMO_HEIGHT,
  BUILD_WEEK_DEMO_WIDTH,
  type DemoRenderProgress,
  type DemoRenderReport,
  type RenderBuildWeekDemoOptions,
} from "./demo-contracts";
import { PitchFlowRenderError } from "./render-error";

const LOCAL_BROWSERS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Microsoft Edge Canary.app/Contents/MacOS/Microsoft Edge Canary",
];

async function localBrowser(explicit?: string): Promise<string> {
  const candidates = explicit ? [resolve(explicit)] : LOCAL_BROWSERS;
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Deliberately local-only. The demo renderer never downloads a browser.
    }
  }
  throw new PitchFlowRenderError(
    "browser",
    "A local Chrome or Edge executable is required for the Build Week demo render.",
  );
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolvePromise, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolvePromise);
  });
  return hash.digest("hex");
}

function emit(callback: RenderBuildWeekDemoOptions["onProgress"], event: DemoRenderProgress): void {
  callback?.(event);
}

export async function renderBuildWeekDemo(
  options: RenderBuildWeekDemoOptions,
): Promise<DemoRenderReport> {
  const repositoryRoot = resolve(
    options.repositoryRoot ?? fileURLToPath(new URL("../../../", import.meta.url)),
  );
  const outputPath = resolve(options.outputPath);
  const reportPath = resolve(options.reportPath);
  const workDirectory = await mkdtemp(join(tmpdir(), "pitchflow-build-week-demo-"));
  const publicDirectory = join(workDirectory, "public");
  const bundleDirectory = join(workDirectory, "bundle");
  const entryPoint = fileURLToPath(new URL("./demo-entry.tsx", import.meta.url));

  try {
    emit(options.onProgress, {
      stage: "staging",
      progress: 0,
      renderedFrames: 0,
      totalFrames: BUILD_WEEK_DEMO_DURATION_FRAMES,
    });
    const staged = await stageDemoAssets(repositoryRoot, publicDirectory);
    emit(options.onProgress, {
      stage: "staging",
      progress: 1,
      renderedFrames: 0,
      totalFrames: BUILD_WEEK_DEMO_DURATION_FRAMES,
    });
    const browserExecutable = await localBrowser(options.browserExecutable);
    await Promise.all([
      mkdir(dirname(outputPath), { recursive: true }),
      mkdir(dirname(reportPath), { recursive: true }),
    ]);

    const serveUrl = await bundle({
      entryPoint,
      outDir: bundleDirectory,
      publicDir: publicDirectory,
      enableCaching: false,
      onProgress: (progress) =>
        emit(options.onProgress, {
          stage: "bundling",
          progress: progress / 100,
          renderedFrames: 0,
          totalFrames: BUILD_WEEK_DEMO_DURATION_FRAMES,
        }),
    });

    emit(options.onProgress, {
      stage: "discovering",
      progress: 0,
      renderedFrames: 0,
      totalFrames: BUILD_WEEK_DEMO_DURATION_FRAMES,
    });
    const composition = await selectComposition({
      serveUrl,
      id: BUILD_WEEK_DEMO_COMPOSITION_ID,
      inputProps: staged.props,
      browserExecutable,
      logLevel: "warn",
    });
    emit(options.onProgress, {
      stage: "discovering",
      progress: 1,
      renderedFrames: 0,
      totalFrames: BUILD_WEEK_DEMO_DURATION_FRAMES,
    });

    await renderMedia({
      serveUrl,
      composition,
      inputProps: staged.props,
      outputLocation: outputPath,
      browserExecutable,
      codec: "h264",
      pixelFormat: "yuv420p",
      colorSpace: "bt709",
      videoBitrate: "12M",
      audioCodec: "aac",
      audioBitrate: "192k",
      x264Preset: "medium",
      concurrency: 4,
      hardwareAcceleration: "disable",
      overwrite: options.overwrite ?? false,
      logLevel: "warn",
      metadata: {
        title: "PitchFlow — OpenAI Build Week demo",
        comment: "Creator-owned PitchFlow product captures; no music or third-party footage",
      },
      onProgress: (progress) =>
        emit(options.onProgress, {
          stage: "rendering",
          progress: progress.progress,
          renderedFrames: progress.renderedFrames,
          totalFrames: BUILD_WEEK_DEMO_DURATION_FRAMES,
        }),
    });

    const [outputStat, sha256] = await Promise.all([stat(outputPath), hashFile(outputPath)]);
    const report: DemoRenderReport = {
      format: "pitchflow-build-week-demo-render",
      version: 1,
      compositionId: BUILD_WEEK_DEMO_COMPOSITION_ID,
      outputPath: basename(outputPath),
      reportPath: basename(reportPath),
      width: BUILD_WEEK_DEMO_WIDTH,
      height: BUILD_WEEK_DEMO_HEIGHT,
      fps: BUILD_WEEK_DEMO_FPS,
      durationFrames: BUILD_WEEK_DEMO_DURATION_FRAMES,
      durationSeconds: BUILD_WEEK_DEMO_DURATION_SECONDS,
      videoCodec: "h264",
      audioCodec: "aac",
      videoBitrate: "12M",
      audioBitrate: "192k",
      bytes: outputStat.size,
      sha256,
      inputs: staged.inputs,
    };
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    emit(options.onProgress, {
      stage: "complete",
      progress: 1,
      renderedFrames: BUILD_WEEK_DEMO_DURATION_FRAMES,
      totalFrames: BUILD_WEEK_DEMO_DURATION_FRAMES,
    });
    return report;
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
}
