import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

import { assertSafeArchivePath, redactPotentialSecrets } from "@pitchflow/core";

import { parseDogfoodPackage } from "../apps/web/lib/dogfood";
import { requiredArgument } from "./arguments";

const root = resolve(process.cwd());
const publicDirectory = resolve(requiredArgument("directory"));
const expectedDirectory = resolve(root, "apps/web/public/dogfood/pitchflow/v1");
if (publicDirectory !== expectedDirectory || !publicDirectory.startsWith(`${root}${sep}`)) {
  throw new Error("Public package verification must target apps/web/public/dogfood/pitchflow/v1.");
}

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

async function listFiles(directory: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const filename = prefix ? `${prefix}/${entry.name}` : entry.name;
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(`Public dogfood may not contain links: ${filename}`);
    if (entry.isDirectory()) files.push(...(await listFiles(path, filename)));
    else if (entry.isFile()) files.push(filename);
    else throw new Error(`Public dogfood contains an unsupported entry: ${filename}`);
  }
  return files.sort();
}

const packagePath = join(publicDirectory, "judge-package.json");
const packageData = await readFile(packagePath);
const dogfood = parseDogfoodPackage(JSON.parse(packageData.toString("utf8")));
if (dogfood.campaign.generation.model !== "gpt-5.6-sol") {
  throw new Error("Public dogfood was not generated with the required GPT-5.6 Sol runner.");
}
if (dogfood.campaign.generation.provider !== "codex-sdk") {
  throw new Error("Public dogfood does not record the official Codex SDK generation path.");
}

const requiredHrefs = [
  "/dogfood/pitchflow/v1/site/index.html",
  "/dogfood/pitchflow/v1/images/og-1200x630.png",
  "/dogfood/pitchflow/v1/images/x-1600x900.png",
  "/dogfood/pitchflow/v1/images/linkedin-1200x627.png",
  "/dogfood/pitchflow/v1/images/instagram-1080x1080.png",
  ...Array.from(
    { length: 5 },
    (_, index) =>
      `/dogfood/pitchflow/v1/carousel/slide-${String(index + 1).padStart(2, "0")}-1080x1350.png`,
  ),
  "/dogfood/pitchflow/v1/copy/campaign.md",
  "/dogfood/pitchflow/v1/campaign-manifest.json",
  "/dogfood/pitchflow/v1/repository-snapshot.json",
  "/dogfood/pitchflow/v1/capture-provenance.json",
  "/dogfood/pitchflow/v1/videos/launch-landscape-1920x1080.mp4",
  "/dogfood/pitchflow/v1/videos/launch-portrait-1080x1920.mp4",
  "/dogfood/pitchflow/v1/asset-index.json",
  "/dogfood/pitchflow/v1/pitchflow-campaign.zip",
];
const hrefs = dogfood.assets.map((asset) => asset.href);
if (new Set(hrefs).size !== hrefs.length) {
  throw new Error("Public dogfood package contains duplicate asset hrefs.");
}
for (const href of requiredHrefs) {
  if (!hrefs.includes(href)) throw new Error(`Public judge package is missing ${href}.`);
}

for (const asset of dogfood.assets) {
  const filename = asset.href.replace("/dogfood/pitchflow/v1/", "");
  assertSafeArchivePath(filename);
  const path = join(publicDirectory, filename);
  const pathStat = await lstat(path);
  if (!pathStat.isFile() || pathStat.isSymbolicLink()) {
    throw new Error(`Public dogfood asset is not a regular file: ${filename}`);
  }
  const data = await readFile(path);
  if (data.byteLength !== asset.bytes || sha256(data) !== asset.sha256) {
    throw new Error(`Public dogfood asset does not match its declared bytes/hash: ${filename}`);
  }
  if (/\.(?:css|html|json|md|txt)$/i.test(filename)) {
    const text = data.toString("utf8");
    if (redactPotentialSecrets(text) !== text || /\/Users\//.test(text)) {
      throw new Error(`Public dogfood text contains a potential secret or local path: ${filename}`);
    }
  }
}

const actualFiles = await listFiles(publicDirectory);
const expectedFiles = [
  "judge-package.json",
  ...dogfood.assets.map((asset) => asset.href.replace("/dogfood/pitchflow/v1/", "")),
].sort();
if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
  throw new Error("Public dogfood directory contains undeclared or missing files.");
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      directory: relative(root, publicDirectory),
      repository: dogfood.snapshot.repository.canonicalUrl,
      commitSha: dogfood.snapshot.commitSha,
      campaignId: dogfood.campaign.id,
      generation: dogfood.campaign.generation,
      assets: dogfood.assets.length,
      totalAssetBytes: dogfood.assets.reduce((sum, asset) => sum + asset.bytes, 0),
      judgePackageBytes: packageData.byteLength,
      judgePackageSha256: sha256(packageData),
      credentialValuesPrinted: false,
    },
    null,
    2,
  ),
);
