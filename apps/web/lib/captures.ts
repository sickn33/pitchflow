import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import { PitchFlowError } from "@pitchflow/core";

import {
  CAPTURE_PROVENANCE_LABELS,
  CaptureUploadListSchema,
  MAX_CAPTURE_BYTES,
  MAX_CAPTURE_DIMENSION,
  MAX_CAPTURE_PIXELS,
  MAX_CAPTURE_TOTAL_BYTES,
  MIN_CAPTURE_HEIGHT,
  MIN_CAPTURE_WIDTH,
  type CaptureProvenance,
  type CaptureUpload,
} from "./capture-contract";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
type SupportedMediaType = CaptureUpload["mediaType"];

export type ValidatedCapture = Omit<CaptureUpload, "dataUrl"> & {
  bytes: Buffer;
  width: number;
  height: number;
  sha256: string;
};

export type StagedCaptureRecord = Omit<ValidatedCapture, "bytes" | "provenance"> & {
  path: string;
  bytes: number;
  provenance: CaptureProvenance;
  provenanceLabel: (typeof CAPTURE_PROVENANCE_LABELS)[CaptureProvenance];
};

export type StagedCaptureManifest = {
  format: "pitchflow-local-captures";
  version: 1;
  captures: StagedCaptureRecord[];
};

export function captureCliArguments(paths: string[]): string[] {
  if (paths.length < 2 || paths.length > 4 || paths.some((path) => !isAbsolute(path))) {
    throw new Error("Renderer capture arguments require 2–4 absolute staged paths.");
  }
  return paths.flatMap((path) => ["--capture", path]);
}

function decodeCanonicalDataUrl(dataUrl: string, mediaType: SupportedMediaType): Buffer {
  const prefix = `data:${mediaType};base64,`;
  if (!dataUrl.startsWith(prefix)) {
    throw new PitchFlowError(
      "CAPTURE_MEDIA_TYPE_MISMATCH",
      "A capture data URL did not match its declared PNG or JPEG type.",
      422,
    );
  }
  const encoded = dataUrl.slice(prefix.length);
  if (encoded.length === 0 || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new PitchFlowError(
      "CAPTURE_BASE64_INVALID",
      "A capture did not contain canonical base64 image data.",
      422,
    );
  }
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  const estimatedBytes = (encoded.length / 4) * 3 - padding;
  if (estimatedBytes > MAX_CAPTURE_BYTES) {
    throw new PitchFlowError(
      "CAPTURE_TOO_LARGE",
      `Each capture must be at most ${MAX_CAPTURE_BYTES} bytes.`,
      413,
    );
  }
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length === 0 || bytes.toString("base64") !== encoded) {
    throw new PitchFlowError(
      "CAPTURE_BASE64_INVALID",
      "A capture did not contain canonical base64 image data.",
      422,
    );
  }
  return bytes;
}

function pngDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (
    bytes.length < 45 ||
    !bytes.subarray(0, 8).equals(PNG_SIGNATURE) ||
    bytes.readUInt32BE(8) !== 13 ||
    bytes.subarray(12, 16).toString("ascii") !== "IHDR"
  ) {
    return null;
  }
  const iend = bytes.subarray(bytes.length - 12);
  if (iend.readUInt32BE(0) !== 0 || iend.subarray(4, 8).toString("ascii") !== "IEND") {
    return null;
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function jpegDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (
    bytes.length < 24 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes[bytes.length - 2] !== 0xff ||
    bytes[bytes.length - 1] !== 0xd9
  ) {
    return null;
  }
  let offset = 2;
  while (offset + 8 < bytes.length - 2) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1]!;
    if (marker === 0x00 || marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda || offset + 4 > bytes.length) return null;
    const segmentLength = bytes.readUInt16BE(offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > bytes.length) return null;
    if (
      [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
        marker,
      )
    ) {
      if (segmentLength < 8) return null;
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function inspectDimensions(bytes: Buffer, mediaType: SupportedMediaType) {
  const dimensions = mediaType === "image/png" ? pngDimensions(bytes) : jpegDimensions(bytes);
  if (
    !dimensions ||
    dimensions.width < MIN_CAPTURE_WIDTH ||
    dimensions.height < MIN_CAPTURE_HEIGHT ||
    dimensions.width > MAX_CAPTURE_DIMENSION ||
    dimensions.height > MAX_CAPTURE_DIMENSION ||
    dimensions.width * dimensions.height > MAX_CAPTURE_PIXELS
  ) {
    throw new PitchFlowError(
      "CAPTURE_DIMENSIONS_INVALID",
      `Captures must be valid images from ${MIN_CAPTURE_WIDTH}×${MIN_CAPTURE_HEIGHT} up to ${MAX_CAPTURE_DIMENSION}×${MAX_CAPTURE_DIMENSION}, within the safe pixel limit.`,
      422,
    );
  }
  return dimensions;
}

function assertSignature(bytes: Buffer, mediaType: SupportedMediaType): void {
  const detected = bytes.subarray(0, 8).equals(PNG_SIGNATURE)
    ? "image/png"
    : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      ? "image/jpeg"
      : null;
  if (detected !== mediaType) {
    throw new PitchFlowError(
      "CAPTURE_BINARY_INVALID",
      "A capture's binary signature did not match its declared PNG or JPEG type.",
      422,
    );
  }
}

export function validateCaptureUploads(input: unknown): ValidatedCapture[] {
  const uploads = CaptureUploadListSchema.parse(input).sort(
    (left, right) => left.order - right.order,
  );
  let totalBytes = 0;
  return uploads.map((upload) => {
    const bytes = decodeCanonicalDataUrl(upload.dataUrl, upload.mediaType);
    totalBytes += bytes.length;
    if (totalBytes > MAX_CAPTURE_TOTAL_BYTES) {
      throw new PitchFlowError(
        "CAPTURE_TOTAL_TOO_LARGE",
        `Capture attachments must total at most ${MAX_CAPTURE_TOTAL_BYTES} bytes.`,
        413,
      );
    }
    assertSignature(bytes, upload.mediaType);
    const dimensions = inspectDimensions(bytes, upload.mediaType);
    return {
      id: upload.id,
      order: upload.order,
      fileName: upload.fileName,
      label: upload.label,
      description: upload.description,
      provenance: upload.provenance,
      mediaType: upload.mediaType,
      bytes,
      width: dimensions.width,
      height: dimensions.height,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  });
}

export async function stageCaptureFiles(
  jobDirectory: string,
  captures: ValidatedCapture[],
): Promise<{ paths: string[]; manifestPath: string; manifest: StagedCaptureManifest }> {
  const absoluteJobDirectory = resolve(jobDirectory);
  const captureDirectory = join(absoluteJobDirectory, "captures");
  await mkdir(captureDirectory, { recursive: true });
  const records: StagedCaptureRecord[] = [];
  for (const capture of captures) {
    const extension = capture.mediaType === "image/png" ? "png" : "jpg";
    const path = join(
      captureDirectory,
      `${String(capture.order + 1).padStart(2, "0")}-${capture.id}-${capture.sha256.slice(0, 12)}.${extension}`,
    );
    await writeFile(path, capture.bytes, { flag: "wx" });
    records.push({
      id: capture.id,
      order: capture.order,
      fileName: capture.fileName,
      label: capture.label,
      description: capture.description,
      provenance: capture.provenance,
      provenanceLabel: CAPTURE_PROVENANCE_LABELS[capture.provenance],
      mediaType: capture.mediaType,
      path,
      bytes: capture.bytes.length,
      width: capture.width,
      height: capture.height,
      sha256: capture.sha256,
    });
  }
  const manifest: StagedCaptureManifest = {
    format: "pitchflow-local-captures",
    version: 1,
    captures: records,
  };
  const manifestPath = join(absoluteJobDirectory, "capture-inputs.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  return { paths: records.map((record) => record.path), manifestPath, manifest };
}
