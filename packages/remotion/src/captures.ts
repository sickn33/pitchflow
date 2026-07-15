import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

import type { CampaignManifest } from "@pitchflow/core";

import type { CaptureInput, CaptureReceipt, PreparedCapture } from "./contracts";
import { PitchFlowRenderError } from "./render-error";

const MAX_CAPTURE_BYTES = 12 * 1024 * 1024;
const MAX_CAPTURE_COUNT = 32;
const CAPTURE_ID = /^[a-z0-9][a-z0-9_-]{2,79}$/;
const DATA_URL = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=\s]+)$/;

type SupportedMediaType = PreparedCapture["mediaType"];

function sniffMediaType(bytes: Buffer): SupportedMediaType | null {
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  return null;
}

function extensionFor(mediaType: SupportedMediaType): string {
  if (mediaType === "image/jpeg") return "jpg";
  return "png";
}

function dimensionsFor(
  bytes: Buffer,
  mediaType: SupportedMediaType,
): {
  width: number;
  height: number;
} | null {
  if (mediaType === "image/png") {
    if (bytes.length < 24) return null;
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1]!;
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const segmentLength = bytes.readUInt16BE(offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > bytes.length) return null;
    if (
      [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
        marker,
      )
    ) {
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

async function loadCapture(input: CaptureInput): Promise<{
  bytes: Buffer;
  declaredMediaType: SupportedMediaType | null;
}> {
  if (input.source.kind === "data-url") {
    const match = DATA_URL.exec(input.source.dataUrl);
    if (!match) {
      throw new PitchFlowRenderError(
        "capture",
        `Capture ${input.id} must be a base64 PNG or JPEG data URL.`,
      );
    }
    return {
      bytes: Buffer.from(match[2]!.replaceAll(/\s/g, ""), "base64"),
      declaredMediaType: match[1] as SupportedMediaType,
    };
  }

  const sourcePath = resolve(input.source.path);
  let sourceStat;
  try {
    sourceStat = await stat(sourcePath);
  } catch (error) {
    throw new PitchFlowRenderError(
      "capture",
      `Capture ${input.id} was not found at ${sourcePath}.`,
      error,
    );
  }
  if (!sourceStat.isFile()) {
    throw new PitchFlowRenderError("capture", `Capture ${input.id} is not a regular file.`);
  }
  if (sourceStat.size > MAX_CAPTURE_BYTES) {
    throw new PitchFlowRenderError(
      "capture",
      `Capture ${input.id} is ${sourceStat.size} bytes; maximum is ${MAX_CAPTURE_BYTES}.`,
    );
  }
  const extension = extname(sourcePath).toLowerCase();
  const declaredMediaType =
    extension === ".png"
      ? "image/png"
      : extension === ".jpg" || extension === ".jpeg"
        ? "image/jpeg"
        : null;
  return { bytes: await readFile(sourcePath), declaredMediaType };
}

export async function prepareCaptures(
  inputs: CaptureInput[],
  publicDirectory: string,
  manifest: CampaignManifest,
): Promise<{ captures: PreparedCapture[]; receipts: CaptureReceipt[] }> {
  if (inputs.length > MAX_CAPTURE_COUNT) {
    throw new PitchFlowRenderError(
      "capture",
      `A render accepts at most ${MAX_CAPTURE_COUNT} captures; received ${inputs.length}.`,
    );
  }

  const ids = new Set<string>();
  const sceneOrders = new Set<string>();
  const sceneIndexes = new Set(manifest.video.scenes.map((scene) => scene.index));
  const captureDirectory = join(publicDirectory, "captures");
  await mkdir(captureDirectory, { recursive: true });

  const prepared: Array<{ capture: PreparedCapture; receipt: CaptureReceipt }> = [];
  for (const input of inputs) {
    if (!CAPTURE_ID.test(input.id)) {
      throw new PitchFlowRenderError(
        "capture",
        `Capture id ${input.id} must use 3–80 lowercase letters, numbers, underscores, or hyphens.`,
      );
    }
    if (ids.has(input.id)) {
      throw new PitchFlowRenderError("capture", `Capture id ${input.id} is duplicated.`);
    }
    ids.add(input.id);
    if (!Number.isInteger(input.order) || input.order < 0 || input.order > 9) {
      throw new PitchFlowRenderError(
        "capture",
        `Capture ${input.id} order must be an integer from 0 to 9.`,
      );
    }
    const sceneOrder = `${input.sceneIndex}:${input.order}`;
    if (sceneOrders.has(sceneOrder)) {
      throw new PitchFlowRenderError(
        "capture",
        `Scene ${input.sceneIndex} has duplicate capture order ${input.order}.`,
      );
    }
    sceneOrders.add(sceneOrder);
    if (!sceneIndexes.has(input.sceneIndex)) {
      throw new PitchFlowRenderError(
        "capture",
        `Capture ${input.id} references missing scene ${input.sceneIndex}.`,
      );
    }
    const alt = input.alt.trim();
    if (alt.length < 3 || alt.length > 180) {
      throw new PitchFlowRenderError(
        "capture",
        `Capture ${input.id} alt text must contain 3–180 characters.`,
      );
    }

    const loaded = await loadCapture(input);
    if (loaded.bytes.length === 0 || loaded.bytes.length > MAX_CAPTURE_BYTES) {
      throw new PitchFlowRenderError(
        "capture",
        `Capture ${input.id} must contain 1–${MAX_CAPTURE_BYTES} bytes.`,
      );
    }
    const mediaType = sniffMediaType(loaded.bytes);
    if (!mediaType || mediaType !== loaded.declaredMediaType) {
      throw new PitchFlowRenderError(
        "capture",
        `Capture ${input.id} content does not match its declared PNG or JPEG type.`,
      );
    }
    const dimensions = dimensionsFor(loaded.bytes, mediaType);
    if (
      !dimensions ||
      dimensions.width < 1 ||
      dimensions.height < 1 ||
      dimensions.width > 7680 ||
      dimensions.height > 7680
    ) {
      throw new PitchFlowRenderError(
        "capture",
        `Capture ${input.id} must have valid dimensions no larger than 7680×7680.`,
      );
    }
    const sha256 = createHash("sha256").update(loaded.bytes).digest("hex");
    const filename = `${String(input.sceneIndex).padStart(2, "0")}-${String(input.order).padStart(2, "0")}-${input.id}-${sha256.slice(0, 16)}.${extensionFor(mediaType)}`;
    await writeFile(join(captureDirectory, filename), loaded.bytes, { flag: "wx" }).catch(
      (error: unknown) => {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "EEXIST") throw error;
      },
    );
    const capture: PreparedCapture = {
      id: input.id,
      sceneIndex: input.sceneIndex,
      order: input.order,
      alt,
      publicPath: `captures/${filename}`,
      sha256,
      bytes: loaded.bytes.length,
      mediaType,
      width: dimensions.width,
      height: dimensions.height,
    };
    prepared.push({
      capture,
      receipt: {
        id: capture.id,
        sceneIndex: capture.sceneIndex,
        order: capture.order,
        alt: capture.alt,
        sha256,
        bytes: capture.bytes,
        mediaType,
        width: capture.width,
        height: capture.height,
        sourceKind: input.source.kind,
      },
    });
  }

  const scenesRequiringCapture = manifest.video.scenes.filter(
    (scene) => scene.visual !== "closing",
  );
  for (const scene of scenesRequiringCapture) {
    if (!prepared.some(({ capture }) => capture.sceneIndex === scene.index)) {
      throw new PitchFlowRenderError(
        "capture",
        `Scene ${scene.index} (${scene.visual}) requires at least one documented real capture.`,
      );
    }
  }

  prepared.sort((left, right) =>
    left.capture.sceneIndex === right.capture.sceneIndex
      ? left.capture.order === right.capture.order
        ? left.capture.id.localeCompare(right.capture.id)
        : left.capture.order - right.capture.order
      : left.capture.sceneIndex - right.capture.sceneIndex,
  );
  return {
    captures: prepared.map(({ capture }) => capture),
    receipts: prepared.map(({ receipt }) => receipt),
  };
}

export function createCaptureInputsFromPaths(
  capturePaths: string[],
  manifest: CampaignManifest,
): CaptureInput[] {
  if (capturePaths.length < 2 || capturePaths.length > 4) {
    throw new PitchFlowRenderError(
      "capture",
      `capturePaths must contain 2–4 local PNG or JPEG files; received ${capturePaths.length}.`,
    );
  }
  return manifest.video.scenes
    .filter((scene) => scene.visual !== "closing")
    .flatMap((scene) =>
      capturePaths.map((path, order) => ({
        id: `local_capture_${String(order + 1).padStart(2, "0")}_scene_${String(scene.index).padStart(2, "0")}`,
        sceneIndex: scene.index,
        order,
        alt: `Documented local product capture ${order + 1}`,
        source: { kind: "file" as const, path },
      })),
    );
}
