import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

import { CampaignManifestSchema, RepoSnapshotSchema } from "@pitchflow/core";
import { renderCampaignBundle } from "@pitchflow/export";

import { repeatedArgumentValues, requiredArgument } from "./arguments";

const manifestPath = resolve(requiredArgument("manifest"));
const snapshotPath = resolve(requiredArgument("snapshot"));
const outputDirectory = resolve(requiredArgument("output"));
const capturePaths = repeatedArgumentValues("capture").map((path) => resolve(path));
const progressJson = process.argv.includes("--progress-json");
const root = resolve(process.cwd());
for (const path of [manifestPath, snapshotPath, outputDirectory, ...capturePaths]) {
  if (!path.startsWith(`${root}${sep}`)) {
    throw new Error("Render smoke paths must remain inside the PitchFlow repository.");
  }
}
if (capturePaths.length < 2 || capturePaths.length > 4) {
  throw new Error("Render smoke requires 2–4 repeated --capture paths.");
}

type CaptureDeclaration = {
  path: string;
  label: string;
  description: string;
  provenance: "creator-owned" | "authorized-use";
  sceneIndexes?: number[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readCaptureDeclarations(): Promise<CaptureDeclaration[] | null> {
  const configuredPath = process.env.PITCHFLOW_CAPTURE_MANIFEST_PATH;
  if (!configuredPath) return null;
  const captureManifestPath = resolve(configuredPath);
  if (!captureManifestPath.startsWith(`${root}${sep}`)) {
    throw new Error("Capture provenance manifest must remain inside the PitchFlow repository.");
  }
  const value: unknown = JSON.parse(await readFile(captureManifestPath, "utf8"));
  const entries = isRecord(value) ? value.captures : null;
  if (!Array.isArray(entries) || entries.length !== capturePaths.length) {
    throw new Error("Capture provenance manifest does not match the staged capture list.");
  }

  return entries.map((entry: unknown, index) => {
    const path = isRecord(entry) ? entry.path : null;
    const label = isRecord(entry) ? entry.label : null;
    const description = isRecord(entry) ? entry.description : null;
    const provenance = isRecord(entry) ? entry.provenance : null;
    const sceneIndexes = isRecord(entry) ? (entry.sceneIndexes ?? null) : null;
    if (
      typeof path !== "string" ||
      resolve(path) !== capturePaths[index] ||
      typeof label !== "string" ||
      label.trim().length < 3 ||
      label.trim().length > 80 ||
      typeof description !== "string" ||
      description.trim().length < 12 ||
      description.trim().length > 180 ||
      (provenance !== "creator-owned" && provenance !== "authorized-use") ||
      (sceneIndexes !== null &&
        (!Array.isArray(sceneIndexes) ||
          sceneIndexes.length === 0 ||
          sceneIndexes.some((sceneIndex) => !Number.isInteger(sceneIndex))))
    ) {
      throw new Error(`Capture provenance record ${index + 1} is invalid or out of order.`);
    }
    return {
      path,
      label: label.trim(),
      description: description.trim(),
      provenance,
      ...(sceneIndexes === null ? {} : { sceneIndexes: sceneIndexes as number[] }),
    };
  });
}

const manifest = CampaignManifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));
const snapshot = RepoSnapshotSchema.parse(JSON.parse(await readFile(snapshotPath, "utf8")));
const declarations = await readCaptureDeclarations();
const bundle = await renderCampaignBundle(manifest, snapshot, outputDirectory, {
  productCaptures: capturePaths.map((sourcePath, index) => {
    const declaration = declarations?.[index];
    return {
      sourcePath,
      alt: declaration?.description ?? `Real product interface capture ${index + 1}`,
      caption: declaration?.label ?? `Product workflow · view ${index + 1}`,
      provenance: "user-supplied" as const,
      declaration: declaration?.provenance ?? "creator-owned",
      ...(declaration?.sceneIndexes ? { sceneIndexes: declaration.sceneIndexes } : {}),
    };
  }),
  renderVideos: {
    onProgress: (layout, event) => {
      if (progressJson) {
        console.log(JSON.stringify({ type: "pitchflow-render-progress", layout, event }));
      }
    },
  },
  onStage: (stage) => {
    if (progressJson) console.log(JSON.stringify({ type: "pitchflow-bundle-stage", stage }));
  },
});
console.log(
  JSON.stringify(
    {
      status: "ok",
      campaignId: manifest.id,
      outputDirectory: bundle.outputDirectory,
      assets: bundle.assets.map((asset) => ({
        filename: asset.filename,
        bytes: asset.bytes,
        sha256: asset.sha256,
        width: asset.width,
        height: asset.height,
      })),
      archivePath: bundle.archivePath,
    },
    null,
    2,
  ),
);
