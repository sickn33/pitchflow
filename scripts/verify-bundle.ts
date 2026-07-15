import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import {
  CampaignManifestSchema,
  CreativeAssetSchema,
  RepoSnapshotSchema,
  assertSafeArchivePath,
  auditManifestEvidence,
  redactPotentialSecrets,
} from "@pitchflow/core";
import JSZip from "jszip";
import sharp from "sharp";

import { argumentValue, requiredArgument } from "./arguments";

const execFileAsync = promisify(execFile);
const root = resolve(process.cwd());
const bundleDirectory = resolve(requiredArgument("bundle"));
const production = process.argv.includes("--production");
if (!bundleDirectory.startsWith(`${root}${sep}`)) {
  throw new Error("Bundle verification must remain inside the PitchFlow repository.");
}

type ProbeStream = {
  codec_type?: string;
  codec_name?: string;
  profile?: string;
  pix_fmt?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  duration?: string;
  bit_rate?: string;
  color_space?: string;
};

type CaptureProvenanceRecord = {
  filename: string;
  label: string;
  description: string;
  declaration: "creator-owned" | "authorized-use";
  provenance: "user-supplied";
  mediaType: "image/png" | "image/jpeg";
  width: number;
  height: number;
  bytes: number;
  sha256: string;
  sceneIndexes: number[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCaptureProvenance(value: unknown): CaptureProvenanceRecord[] {
  if (
    !isRecord(value) ||
    value.schemaVersion !== "1.0.0" ||
    !Array.isArray(value.captures) ||
    value.captures.length < 2 ||
    value.captures.length > 4
  ) {
    throw new Error("Capture provenance must describe 2–4 product captures.");
  }
  return value.captures.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`Capture provenance entry ${index + 1} is invalid.`);
    const expectedFilename = `images/product-capture-${String(index + 1).padStart(2, "0")}`;
    const extension =
      typeof entry.filename === "string" ? entry.filename.match(/\.(png|jpe?g)$/i)?.[1] : null;
    if (
      typeof entry.filename !== "string" ||
      !entry.filename.startsWith(expectedFilename) ||
      !extension ||
      typeof entry.label !== "string" ||
      entry.label.trim().length < 3 ||
      entry.label.trim().length > 100 ||
      typeof entry.description !== "string" ||
      entry.description.trim().length < 12 ||
      entry.description.trim().length > 180 ||
      (entry.declaration !== "creator-owned" && entry.declaration !== "authorized-use") ||
      entry.provenance !== "user-supplied" ||
      (entry.mediaType !== "image/png" && entry.mediaType !== "image/jpeg") ||
      !Number.isInteger(entry.width) ||
      !Number.isInteger(entry.height) ||
      !Number.isInteger(entry.bytes) ||
      typeof entry.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(entry.sha256) ||
      !Array.isArray(entry.sceneIndexes) ||
      entry.sceneIndexes.length === 0 ||
      new Set(entry.sceneIndexes).size !== entry.sceneIndexes.length ||
      entry.sceneIndexes.some((sceneIndex) => !Number.isInteger(sceneIndex))
    ) {
      throw new Error(`Capture provenance entry ${index + 1} is malformed or out of order.`);
    }
    return entry as CaptureProvenanceRecord;
  });
}

function hash(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

const indexValue: unknown = JSON.parse(
  await readFile(join(bundleDirectory, "asset-index.json"), "utf8"),
);
if (
  typeof indexValue !== "object" ||
  indexValue === null ||
  !("assets" in indexValue) ||
  !Array.isArray(indexValue.assets)
) {
  throw new Error("Asset index is missing its assets array.");
}
const assets = indexValue.assets.map((value) => CreativeAssetSchema.parse(value));
const filenames = new Set(assets.map((asset) => asset.filename));
if (filenames.size !== assets.length) throw new Error("Asset index contains duplicate filenames.");

const requiredFiles = [
  "site/index.html",
  "site/styles.css",
  "images/og-1200x630.png",
  "images/x-1600x900.png",
  "images/linkedin-1200x627.png",
  "images/instagram-1080x1080.png",
  ...Array.from(
    { length: 5 },
    (_, index) => `carousel/slide-${String(index + 1).padStart(2, "0")}-1080x1350.png`,
  ),
  "copy/campaign.json",
  "copy/campaign.md",
  "campaign-manifest.json",
  "repository-snapshot.json",
  "capture-provenance.json",
];
if (production) {
  requiredFiles.push(
    "videos/launch-landscape-1920x1080.mp4",
    "videos/launch-portrait-1080x1920.mp4",
    "video-render-metadata.json",
  );
}
for (const filename of requiredFiles) {
  if (!filenames.has(filename)) throw new Error(`Required bundle asset is missing: ${filename}`);
}

const verifiedAssets: Array<Record<string, unknown>> = [];
for (const asset of assets) {
  assertSafeArchivePath(asset.filename);
  const data = await readFile(join(bundleDirectory, asset.filename));
  if (data.byteLength !== asset.bytes || hash(data) !== asset.sha256) {
    throw new Error(`Asset bytes or SHA-256 do not match: ${asset.filename}`);
  }
  if (asset.mediaType === "image/png" || asset.mediaType === "image/jpeg") {
    const metadata = await sharp(data, { failOn: "error" }).metadata();
    if (metadata.width !== asset.width || metadata.height !== asset.height) {
      throw new Error(`Asset dimensions do not match: ${asset.filename}`);
    }
  }
  verifiedAssets.push({
    filename: asset.filename,
    bytes: asset.bytes,
    sha256: asset.sha256,
    width: asset.width,
    height: asset.height,
  });
}

const exactDimensions = new Map<string, [number, number]>([
  ["images/og-1200x630.png", [1200, 630]],
  ["images/x-1600x900.png", [1600, 900]],
  ["images/linkedin-1200x627.png", [1200, 627]],
  ["images/instagram-1080x1080.png", [1080, 1080]],
  ...Array.from(
    { length: 5 },
    (_, index) =>
      [`carousel/slide-${String(index + 1).padStart(2, "0")}-1080x1350.png`, [1080, 1350]] as [
        string,
        [number, number],
      ],
  ),
]);
for (const [filename, [width, height]] of exactDimensions) {
  const asset = assets.find((candidate) => candidate.filename === filename);
  if (asset?.width !== width || asset.height !== height) {
    throw new Error(`${filename} must be exactly ${width}x${height}.`);
  }
}

const manifest = CampaignManifestSchema.parse(
  JSON.parse(await readFile(join(bundleDirectory, "campaign-manifest.json"), "utf8")),
);
const snapshot = RepoSnapshotSchema.parse(
  JSON.parse(await readFile(join(bundleDirectory, "repository-snapshot.json"), "utf8")),
);
const evidenceAudit = auditManifestEvidence(manifest, snapshot);
if (!evidenceAudit.valid)
  throw new Error(`Bundle evidence audit failed: ${evidenceAudit.errors[0]}`);
const forbiddenAudienceDirection =
  /^(?:open on|cut to|animate|reveal|return to|fan out|pan across|move through|show the)/i;
if (manifest.video.scenes.some((scene) => forbiddenAudienceDirection.test(scene.audienceCaption))) {
  throw new Error("A public audience caption contains internal production direction.");
}

const provenanceValue: unknown = JSON.parse(
  await readFile(join(bundleDirectory, "capture-provenance.json"), "utf8"),
);
const captureProvenance = parseCaptureProvenance(provenanceValue);
const provenanceText = JSON.stringify(provenanceValue);
if (production && /test-fixture|pitchflow-generated/.test(provenanceText)) {
  throw new Error("Production bundles may not use test-fixture or generated product captures.");
}
if (/data:image|\/Users\//.test(provenanceText)) {
  throw new Error("Capture provenance leaked a data URL or absolute user path.");
}
const indexedCaptureAssets = assets.filter((asset) =>
  /^images\/product-capture-\d{2}\.(?:png|jpe?g)$/i.test(asset.filename),
);
if (indexedCaptureAssets.length !== captureProvenance.length) {
  throw new Error("Capture provenance does not cover every indexed product capture exactly once.");
}
for (const record of captureProvenance) {
  assertSafeArchivePath(record.filename);
  const asset = assets.find((candidate) => candidate.filename === record.filename);
  if (
    !asset ||
    asset.provenance !== record.provenance ||
    asset.mediaType !== record.mediaType ||
    asset.width !== record.width ||
    asset.height !== record.height ||
    asset.bytes !== record.bytes ||
    asset.sha256 !== record.sha256
  ) {
    throw new Error(`Capture provenance does not match the asset index: ${record.filename}`);
  }
  const captureBytes = await readFile(join(bundleDirectory, record.filename));
  if (captureBytes.byteLength !== record.bytes || hash(captureBytes) !== record.sha256) {
    throw new Error(`Capture provenance does not match the staged bytes: ${record.filename}`);
  }
}
const renderableSceneIndexes = manifest.video.scenes
  .filter((scene) => scene.visual !== "closing")
  .map((scene) => scene.index);
for (const record of captureProvenance) {
  if (record.sceneIndexes.some((sceneIndex) => !renderableSceneIndexes.includes(sceneIndex))) {
    throw new Error(`Capture provenance targets a missing or closing scene: ${record.filename}`);
  }
}
for (const sceneIndex of renderableSceneIndexes) {
  if (!captureProvenance.some((record) => record.sceneIndexes.includes(sceneIndex))) {
    throw new Error(`Capture provenance leaves production scene ${sceneIndex} without real UI.`);
  }
}

const html = await readFile(join(bundleDirectory, "site/index.html"), "utf8");
if (!html.includes("Real product UI") || !html.includes("product-capture-01")) {
  throw new Error("Static microsite does not visibly include the real product capture section.");
}

const mediaReports: Array<Record<string, unknown>> = [];
for (const [filename, expected] of [
  ["videos/launch-landscape-1920x1080.mp4", { width: 1920, height: 1080 }],
  ["videos/launch-portrait-1080x1920.mp4", { width: 1080, height: 1920 }],
] as const) {
  if (!filenames.has(filename)) continue;
  const path = join(bundleDirectory, filename);
  const { stdout } = await execFileAsync(
    process.env.FFPROBE_PATH ?? "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_type,codec_name,profile,pix_fmt,width,height,r_frame_rate,duration,bit_rate,color_space",
      "-of",
      "json",
      path,
    ],
    { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 },
  );
  const probe = JSON.parse(stdout) as { streams?: ProbeStream[] };
  const video = probe.streams?.find((stream) => stream.codec_type === "video");
  const audio = probe.streams?.find((stream) => stream.codec_type === "audio");
  const duration = Number(video?.duration);
  const bitrate = Number(video?.bit_rate);
  if (
    !video ||
    video.codec_name !== "h264" ||
    video.profile !== "High" ||
    video.pix_fmt !== "yuv420p" ||
    video.color_space !== "bt709" ||
    video.width !== expected.width ||
    video.height !== expected.height ||
    video.r_frame_rate !== "30/1" ||
    !Number.isFinite(duration) ||
    duration < 25 ||
    duration > 40 ||
    (production && (!Number.isFinite(bitrate) || bitrate < 8_000_000))
  ) {
    throw new Error(`Production video probe failed: ${filename}`);
  }
  await execFileAsync(
    process.env.FFMPEG_PATH ?? "ffmpeg",
    ["-v", "error", "-i", path, "-f", "null", "-"],
    { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 },
  );
  mediaReports.push({ filename, ...video, audioStream: Boolean(audio), fullDecode: true });
}

if (production) {
  const renderMetadata = await readFile(
    join(bundleDirectory, "video-render-metadata.json"),
    "utf8",
  );
  if (/\/Users\/|data:image/.test(renderMetadata)) {
    throw new Error("Video render metadata leaked an absolute user path or data URL.");
  }
}

const zipPath = join(bundleDirectory, "pitchflow-campaign.zip");
const zipData = await readFile(zipPath);
const zip = await JSZip.loadAsync(zipData, { checkCRC32: true });
for (const [filename, entry] of Object.entries(zip.files)) {
  assertSafeArchivePath(filename);
  if (entry.dir) continue;
  const data = await entry.async("nodebuffer");
  const source = await readFile(join(bundleDirectory, filename));
  if (!data.equals(source)) throw new Error(`ZIP entry does not match source asset: ${filename}`);
  if (/\.(?:css|html|json|md|txt)$/i.test(filename)) {
    const text = data.toString("utf8");
    if (redactPotentialSecrets(text) !== text) {
      throw new Error(`Potential secret detected inside ZIP text entry: ${filename}`);
    }
  }
}
for (const filename of [...filenames, "asset-index.json"]) {
  if (!zip.file(filename)) throw new Error(`ZIP is missing indexed asset: ${filename}`);
}

const report = {
  status: "ok",
  bundle: relative(root, bundleDirectory),
  production,
  campaignId: manifest.id,
  repository: snapshot.repository.canonicalUrl,
  commitSha: snapshot.commitSha,
  evidenceAudit,
  verifiedAssets,
  mediaReports,
  archive: {
    filename: "pitchflow-campaign.zip",
    bytes: zipData.byteLength,
    sha256: hash(zipData),
    entries: Object.keys(zip.files).length,
  },
  silentSocialMaster: true,
};
const reportArgument = argumentValue("report");
if (reportArgument) {
  const reportPath = resolve(reportArgument);
  if (!reportPath.startsWith(`${root}${sep}`)) {
    throw new Error("Bundle verification report must remain inside the repository.");
  }
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
console.log(JSON.stringify(report, null, 2));
