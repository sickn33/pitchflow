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

export type DogfoodImageDimensions = {
  width: number;
  height: number;
};

const dogfoodSocialDimensions = new Map<string, DogfoodImageDimensions & { label: string }>([
  [
    "/dogfood/pitchflow/v1/images/og-1200x630.png",
    { label: "Open Graph image", width: 1200, height: 630 },
  ],
  [
    "/dogfood/pitchflow/v1/images/x-1600x900.png",
    { label: "X launch image", width: 1600, height: 900 },
  ],
  [
    "/dogfood/pitchflow/v1/images/linkedin-1200x627.png",
    { label: "LinkedIn launch image", width: 1200, height: 627 },
  ],
  [
    "/dogfood/pitchflow/v1/images/instagram-1080x1080.png",
    { label: "Instagram launch image", width: 1080, height: 1080 },
  ],
]);

/**
 * Returns dimensions only for the exact, validated public image contract. Unknown
 * paths or mismatched labels deliberately return null so the UI can avoid loading
 * an unreserved image and reintroducing layout shift.
 */
export function getDogfoodImageDimensions(asset: DogfoodAsset): DogfoodImageDimensions | null {
  const social = dogfoodSocialDimensions.get(asset.href);
  if (social) {
    return asset.label === social.label ? { width: social.width, height: social.height } : null;
  }

  const carousel = /^\/dogfood\/pitchflow\/v1\/carousel\/slide-(0[1-5])-1080x1350\.png$/.exec(
    asset.href,
  );
  if (carousel) {
    return asset.label === `Carousel slide ${Number(carousel[1])}`
      ? { width: 1080, height: 1350 }
      : null;
  }

  const capture = /^\/dogfood\/pitchflow\/v1\/images\/product-capture-(0[1-4])\.png$/.exec(
    asset.href,
  );
  if (capture) {
    return asset.label === `Real product UI capture ${Number(capture[1])}`
      ? { width: 1600, height: 1000 }
      : null;
  }

  return null;
}

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
