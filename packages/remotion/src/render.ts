import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { CampaignManifestSchema } from "@pitchflow/core";

import { createCaptureInputsFromPaths, prepareCaptures } from "./captures";
import {
  PITCHFLOW_COMPOSITION_ID,
  type PitchFlowCompositionProps,
  type PitchFlowRenderMetadata,
  type PitchFlowRenderProgress,
  type RenderCampaignVideoOptions,
} from "./contracts";
import { getLayoutDimensions, validateVideoTimeline } from "./timeline";
import { PitchFlowRenderError } from "./render-error";
export { PitchFlowRenderError, type PitchFlowRenderStage } from "./render-error";

const MAC_BROWSER_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Microsoft Edge Canary.app/Contents/MacOS/Microsoft Edge Canary",
];
const LINUX_BROWSER_CANDIDATES = [
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

async function resolveBrowserExecutable(explicitPath?: string): Promise<string> {
  const environmentPath = process.env.PITCHFLOW_CHROME_PATH;
  const candidates = explicitPath
    ? [resolve(explicitPath)]
    : [
        ...(environmentPath ? [resolve(environmentPath)] : []),
        ...MAC_BROWSER_CANDIDATES,
        ...LINUX_BROWSER_CANDIDATES,
      ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue through known local browsers. PitchFlow never downloads one implicitly.
    }
  }
  throw new PitchFlowRenderError(
    "browser",
    explicitPath
      ? `Browser executable was not found at ${resolve(explicitPath)}.`
      : "No local Chromium browser was found. Install Chrome/Edge/Chromium, set PITCHFLOW_CHROME_PATH, or pass browserExecutable; automatic downloads are disabled.",
  );
}

function emit(
  callback: RenderCampaignVideoOptions["onProgress"],
  event: PitchFlowRenderProgress,
): void {
  callback?.(event);
}

function assertScale(scale: number): void {
  if (!Number.isFinite(scale) || scale < 0.1 || scale > 1) {
    throw new PitchFlowRenderError(
      "validation",
      "scale must be a finite number between 0.1 and 1.",
    );
  }
}

function getScaledDimensions(
  layout: RenderCampaignVideoOptions["layout"],
  scale: number,
): { width: number; height: number } {
  const dimensions = getLayoutDimensions(layout);
  const width = dimensions.width * scale;
  const height = dimensions.height * scale;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width % 2 !== 0 ||
    height % 2 !== 0
  ) {
    throw new PitchFlowRenderError(
      "validation",
      `scale ${scale} produces ${String(width)}×${String(height)}; H.264 output dimensions must be even integers.`,
    );
  }
  return { width, height };
}

export async function renderCampaignVideo(
  options: RenderCampaignVideoOptions,
): Promise<PitchFlowRenderMetadata> {
  const scale = options.scale ?? 1;
  assertScale(scale);
  const scaledDimensions = getScaledDimensions(options.layout, scale);
  let manifest;
  try {
    manifest = validateVideoTimeline(CampaignManifestSchema.parse(options.manifest));
  } catch (error) {
    throw new PitchFlowRenderError(
      "validation",
      "Campaign manifest failed schema or video timeline validation.",
      error,
    );
  }
  const totalFrames = manifest.video.durationSeconds * manifest.video.fps;
  const outputPath = resolve(options.outputPath);
  const entryPoint = fileURLToPath(new URL("./entry.tsx", import.meta.url));
  const workDirectory = await mkdtemp(join(tmpdir(), "pitchflow-remotion-"));
  const bundleDirectory = join(workDirectory, "bundle");
  const publicDirectory = join(workDirectory, "public");

  try {
    if (options.captures && options.capturePaths) {
      throw new PitchFlowRenderError(
        "capture",
        "Pass either detailed captures or capturePaths, not both.",
      );
    }
    const captureInputs = options.captures
      ? options.captures
      : createCaptureInputsFromPaths(options.capturePaths ?? [], manifest);
    const prepared = await prepareCaptures(captureInputs, publicDirectory, manifest);
    const browserExecutable = await resolveBrowserExecutable(options.browserExecutable);
    await mkdir(dirname(outputPath), { recursive: true });
    emit(options.onProgress, {
      stage: "bundling",
      progress: 0,
      renderedFrames: 0,
      encodedFrames: 0,
      totalFrames,
    });
    let serveUrl: string;
    try {
      serveUrl = await bundle({
        entryPoint,
        outDir: bundleDirectory,
        enableCaching: false,
        publicDir: publicDirectory,
        onProgress: (progress) => {
          emit(options.onProgress, {
            stage: "bundling",
            progress: progress / 100,
            renderedFrames: 0,
            encodedFrames: 0,
            totalFrames,
          });
        },
      });
    } catch (error) {
      throw new PitchFlowRenderError(
        "bundle",
        "Remotion could not bundle the PitchFlow composition.",
        error,
      );
    }

    const inputProps: PitchFlowCompositionProps = {
      manifest,
      layout: options.layout,
      captures: prepared.captures,
    };
    emit(options.onProgress, {
      stage: "discovering",
      progress: 0,
      renderedFrames: 0,
      encodedFrames: 0,
      totalFrames,
    });

    let composition;
    try {
      composition = await selectComposition({
        serveUrl,
        id: PITCHFLOW_COMPOSITION_ID,
        inputProps,
        browserExecutable,
        logLevel: "warn",
      });
    } catch (error) {
      throw new PitchFlowRenderError(
        "composition",
        `Composition ${PITCHFLOW_COMPOSITION_ID} was not discoverable or rejected the manifest.`,
        error,
      );
    }

    emit(options.onProgress, {
      stage: "discovering",
      progress: 1,
      renderedFrames: 0,
      encodedFrames: 0,
      totalFrames,
    });

    try {
      await renderMedia({
        serveUrl,
        composition,
        inputProps,
        outputLocation: outputPath,
        browserExecutable,
        codec: "h264",
        pixelFormat: "yuv420p",
        colorSpace: "bt709",
        videoBitrate: scale === 1 ? (options.layout === "portrait" ? "12M" : "10M") : "2M",
        x264Preset: "slow",
        scale,
        concurrency: 1,
        hardwareAcceleration: "disable",
        muted: true,
        enforceAudioTrack: false,
        overwrite: options.overwrite ?? false,
        logLevel: "warn",
        metadata: {
          title: `${manifest.productBrief.productName} — PitchFlow campaign`,
          comment: `manifest=${manifest.id}; commit=${manifest.source.commitSha}`,
        },
        onProgress: (progress) => {
          emit(options.onProgress, {
            stage: "rendering",
            progress: progress.progress,
            renderedFrames: progress.renderedFrames,
            encodedFrames: progress.encodedFrames,
            totalFrames,
          });
        },
      });
    } catch (error) {
      throw new PitchFlowRenderError(
        "render",
        `H.264 render failed for ${options.layout} output at ${outputPath}.`,
        error,
      );
    }

    let output;
    let bytes;
    try {
      [output, bytes] = await Promise.all([readFile(outputPath), stat(outputPath)]);
    } catch (error) {
      throw new PitchFlowRenderError(
        "output",
        `Rendered file could not be verified at ${outputPath}.`,
        error,
      );
    }

    const metadata: PitchFlowRenderMetadata = {
      compositionId: PITCHFLOW_COMPOSITION_ID,
      manifestId: manifest.id,
      outputPath,
      codec: "h264",
      mediaType: "video/mp4",
      width: scaledDimensions.width,
      height: scaledDimensions.height,
      fps: 30,
      durationInFrames: totalFrames,
      durationSeconds: manifest.video.durationSeconds,
      bytes: bytes.size,
      sha256: createHash("sha256").update(output).digest("hex"),
      videoBitrate: scale === 1 ? (options.layout === "portrait" ? "12M" : "10M") : "2M",
      captures: prepared.receipts,
    };

    emit(options.onProgress, {
      stage: "complete",
      progress: 1,
      renderedFrames: totalFrames,
      encodedFrames: totalFrames,
      totalFrames,
    });
    return metadata;
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
}
