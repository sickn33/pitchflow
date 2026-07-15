import {
  CampaignManifestSchema,
  RepoSnapshotSchema,
  auditManifestEvidence,
  type CampaignManifest,
  type RepoSnapshot,
} from "@pitchflow/core";

export const DOGFOOD_PACKAGE_URL = "/dogfood/pitchflow/v1/judge-package.json" as const;

export type DogfoodAsset = {
  label: string;
  href: string;
  mediaType: string;
  bytes: number;
  sha256: string;
};

export type DogfoodPackage = {
  format: "pitchflow-judge-package";
  version: 1;
  snapshot: RepoSnapshot;
  campaign: CampaignManifest;
  assets: DogfoodAsset[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAssets(value: unknown): DogfoodAsset[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("The cached campaign has no downloadable assets yet.");
  }

  return value.map((asset, index) => {
    if (!isObject(asset)) throw new Error(`Cached asset ${index + 1} is invalid.`);
    const { label, href, mediaType, bytes, sha256 } = asset;
    if (
      typeof label !== "string" ||
      typeof href !== "string" ||
      typeof mediaType !== "string" ||
      typeof bytes !== "number" ||
      !Number.isSafeInteger(bytes) ||
      bytes < 0 ||
      typeof sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(sha256)
    ) {
      throw new Error(`Cached asset ${index + 1} does not match the judge package contract.`);
    }
    if (!href.startsWith("/dogfood/pitchflow/v1/") || href.includes("..")) {
      throw new Error(`Cached asset ${index + 1} must use the immutable dogfood asset path.`);
    }
    return { label, href, mediaType, bytes, sha256 };
  });
}

export function parseDogfoodPackage(value: unknown): DogfoodPackage {
  if (!isObject(value) || value.format !== "pitchflow-judge-package" || value.version !== 1) {
    throw new Error("The cached campaign does not match PitchFlow's judge package format.");
  }

  const snapshot = RepoSnapshotSchema.parse(value.snapshot);
  const campaign = CampaignManifestSchema.parse(value.campaign);
  const assets = parseAssets(value.assets);

  if (
    campaign.source.snapshotId !== snapshot.id ||
    campaign.source.commitSha !== snapshot.commitSha ||
    campaign.source.repositoryUrl !== snapshot.repository.canonicalUrl
  ) {
    throw new Error(
      "The cached campaign and repository evidence do not share the same pinned source.",
    );
  }

  const evidenceAudit = auditManifestEvidence(campaign, snapshot);
  if (!evidenceAudit.valid) {
    throw new Error(`The cached campaign failed its evidence audit: ${evidenceAudit.errors[0]}`);
  }

  return { format: "pitchflow-judge-package", version: 1, snapshot, campaign, assets };
}
