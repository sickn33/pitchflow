import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

import {
  CampaignManifestSchema,
  CreativeAssetSchema,
  RepoSnapshotSchema,
  assertSafeArchivePath,
} from "@pitchflow/core";

import { parseDogfoodPackage, type DogfoodAsset } from "../apps/web/lib/dogfood";
import { requiredArgument } from "./arguments";

const root = resolve(process.cwd());
const bundleDirectory = resolve(requiredArgument("bundle"));
const outputDirectory = resolve(requiredArgument("output"));
const expectedPublicRoot = resolve(root, "apps/web/public/dogfood/pitchflow/v1");

if (!bundleDirectory.startsWith(`${root}${sep}`)) {
  throw new Error("Dogfood source bundle must remain inside the PitchFlow repository.");
}
if (outputDirectory !== expectedPublicRoot) {
  throw new Error("Dogfood promotion output must be apps/web/public/dogfood/pitchflow/v1.");
}

try {
  if ((await readdir(outputDirectory)).length > 0) {
    throw new Error("Refusing to replace a non-empty immutable public dogfood directory.");
  }
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
}

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function labelFor(filename: string): string {
  const explicit = new Map<string, string>([
    ["site/index.html", "Campaign microsite"],
    ["site/styles.css", "Microsite stylesheet"],
    ["copy/campaign.md", "Channel copy pack"],
    ["copy/campaign.json", "Structured channel copy"],
    ["campaign-manifest.json", "Campaign manifest"],
    ["repository-snapshot.json", "Pinned repository evidence"],
    ["capture-provenance.json", "Product capture provenance"],
    ["images/og-1200x630.png", "Open Graph image"],
    ["images/x-1600x900.png", "X launch image"],
    ["images/linkedin-1200x627.png", "LinkedIn launch image"],
    ["images/instagram-1080x1080.png", "Instagram launch image"],
    ["videos/launch-landscape-1920x1080.mp4", "Landscape campaign master"],
    ["videos/launch-portrait-1080x1920.mp4", "Portrait campaign master"],
    ["video-render-metadata.json", "Video render receipt"],
    ["asset-index.json", "Checksummed asset index"],
    ["pitchflow-campaign.zip", "Complete campaign ZIP"],
  ]);
  const known = explicit.get(filename);
  if (known) return known;
  const carousel = filename.match(/carousel\/slide-(\d{2})-/);
  if (carousel) return `Carousel slide ${Number(carousel[1])}`;
  const capture = filename.match(/images\/product-capture-(\d{2})\./);
  if (capture) return `Real product UI capture ${Number(capture[1])}`;
  return filename;
}

function mediaTypeFor(filename: string): string {
  if (filename.endsWith(".html")) return "text/html";
  if (filename.endsWith(".css")) return "text/css";
  if (filename.endsWith(".md")) return "text/markdown";
  if (filename.endsWith(".json")) return "application/json";
  if (filename.endsWith(".png")) return "image/png";
  if (filename.endsWith(".mp4")) return "video/mp4";
  if (filename.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
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
  throw new Error("Dogfood source asset index is invalid.");
}
const indexedAssets = indexValue.assets.map((asset) => CreativeAssetSchema.parse(asset));
const filenames = [
  ...indexedAssets.map((asset) => asset.filename),
  "asset-index.json",
  "pitchflow-campaign.zip",
];
if (new Set(filenames).size !== filenames.length) {
  throw new Error("Dogfood source asset index contains duplicate filenames.");
}

const publicAssets: DogfoodAsset[] = [];
for (const filename of filenames) {
  assertSafeArchivePath(filename);
  const sourcePath = join(bundleDirectory, filename);
  const sourceStat = await lstat(sourcePath);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) {
    throw new Error(`Dogfood source asset must be a regular file: ${filename}`);
  }
  const sourceData = await readFile(sourcePath);
  const indexed = indexedAssets.find((asset) => asset.filename === filename);
  if (
    indexed &&
    (indexed.bytes !== sourceData.byteLength || indexed.sha256 !== sha256(sourceData))
  ) {
    throw new Error(`Dogfood source asset no longer matches its index: ${filename}`);
  }
  const destinationPath = join(outputDirectory, filename);
  await mkdir(dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
  const copiedData = await readFile(destinationPath);
  if (!sourceData.equals(copiedData)) {
    throw new Error(`Dogfood public asset copy changed bytes: ${filename}`);
  }
  publicAssets.push({
    label: labelFor(filename),
    href: `/dogfood/pitchflow/v1/${filename}`,
    mediaType: indexed?.mediaType ?? mediaTypeFor(filename),
    bytes: copiedData.byteLength,
    sha256: sha256(copiedData),
  });
}

const snapshot = RepoSnapshotSchema.parse(
  JSON.parse(await readFile(join(bundleDirectory, "repository-snapshot.json"), "utf8")),
);
const campaign = CampaignManifestSchema.parse(
  JSON.parse(await readFile(join(bundleDirectory, "campaign-manifest.json"), "utf8")),
);
const judgePackage = parseDogfoodPackage({
  format: "pitchflow-judge-package",
  version: 1,
  snapshot,
  campaign,
  assets: publicAssets,
});
const packagePath = join(outputDirectory, "judge-package.json");
await writeFile(packagePath, `${JSON.stringify(judgePackage, null, 2)}\n`, { flag: "wx" });

console.log(
  JSON.stringify(
    {
      status: "ok",
      repository: snapshot.repository.canonicalUrl,
      commitSha: snapshot.commitSha,
      campaignId: campaign.id,
      output: relative(root, outputDirectory),
      assets: publicAssets.length,
      totalAssetBytes: publicAssets.reduce((sum, asset) => sum + asset.bytes, 0),
      judgePackageSha256: sha256(await readFile(packagePath)),
      credentialValuesPrinted: false,
    },
    null,
    2,
  ),
);
