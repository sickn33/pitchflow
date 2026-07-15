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

export type DogfoodGalleryAssets = {
  landscapeVideo: DogfoodAsset | null;
  portraitVideo: DogfoodAsset | null;
  socialGraphics: DogfoodAsset[];
  carousel: DogfoodAsset[];
  productCaptures: DogfoodAsset[];
  microsite: DogfoodAsset | null;
  archive: DogfoodAsset | null;
};

const naturalPathOrder = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function assetSearchText(asset: DogfoodAsset): string {
  return `${asset.href} ${asset.label}`.toLowerCase();
}

function firstMatching(
  assets: DogfoodAsset[],
  predicate: (asset: DogfoodAsset) => boolean,
): DogfoodAsset | null {
  return assets.find(predicate) ?? null;
}

/**
 * Maps the immutable package index into the media groups shown in the public viewer.
 * The viewer never invents preview content: every returned item is an original asset.
 */
export function selectDogfoodGalleryAssets(assets: DogfoodAsset[]): DogfoodGalleryAssets {
  const ordered = [...assets].sort((left, right) =>
    naturalPathOrder.compare(left.href, right.href),
  );
  const videos = ordered.filter((asset) => asset.mediaType.startsWith("video/"));
  const images = ordered.filter((asset) => asset.mediaType.startsWith("image/"));
  const isCarousel = (asset: DogfoodAsset) => /(?:^|\/)carousel\//.test(asset.href.toLowerCase());
  const isCapture = (asset: DogfoodAsset) =>
    /(?:^|\/)(?:captures?|product-ui|screenshots?)\//.test(asset.href.toLowerCase()) ||
    /\b(?:capture|product ui|screenshot)\b/.test(asset.label.toLowerCase());

  return {
    landscapeVideo: firstMatching(videos, (asset) =>
      /\b(?:landscape|horizontal|16x9|1920x1080)\b/.test(assetSearchText(asset)),
    ),
    portraitVideo: firstMatching(videos, (asset) =>
      /\b(?:portrait|vertical|9x16|1080x1920)\b/.test(assetSearchText(asset)),
    ),
    socialGraphics: images.filter((asset) => !isCarousel(asset) && !isCapture(asset)),
    carousel: images.filter(isCarousel),
    productCaptures: images.filter(isCapture),
    microsite:
      firstMatching(
        ordered,
        (asset) =>
          asset.mediaType === "text/html" &&
          /(?:^|\/)site\/index\.html(?:$|[?#])/.test(asset.href.toLowerCase()),
      ) ??
      firstMatching(
        ordered,
        (asset) =>
          asset.mediaType === "text/html" &&
          /\b(?:microsite|launch site)\b/.test(asset.label.toLowerCase()),
      ),
    archive: firstMatching(
      ordered,
      (asset) =>
        asset.mediaType === "application/zip" || /\.zip(?:$|[?#])/.test(asset.href.toLowerCase()),
    ),
  };
}

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
      label.trim().length === 0 ||
      typeof href !== "string" ||
      typeof mediaType !== "string" ||
      mediaType.trim().length === 0 ||
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
