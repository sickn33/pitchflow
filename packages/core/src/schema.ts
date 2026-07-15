import { z } from "zod";

export const PITCHFLOW_SCHEMA_VERSION = "1.1.0" as const;
export const PITCHFLOW_PROMPT_VERSION = "creative-director-2026-07-15.2" as const;

const identifier = z
  .string()
  .min(3)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9_-]*$/);
const sha = z.string().regex(/^[a-f0-9]{40}$/);
const isoDate = z.iso.datetime();
const evidenceId = z.string().regex(/^ev_[a-f0-9]{12}$/);
const safeText = (maximum: number) => z.string().trim().min(1).max(maximum);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const GitHubRepoRefSchema = z.object({
  owner: z.string().min(1).max(39),
  repository: z.string().min(1).max(100),
  requestedRef: z.string().min(1).max(100).nullable(),
  canonicalUrl: z.url().startsWith("https://github.com/"),
});

export type GitHubRepoRef = z.infer<typeof GitHubRepoRefSchema>;

export const EvidenceKindSchema = z.enum([
  "repository_metadata",
  "readme",
  "manifest",
  "documentation",
  "source_tree",
  "languages",
  "license",
]);

export const EvidenceItemSchema = z.object({
  id: evidenceId,
  kind: EvidenceKindSchema,
  label: safeText(160),
  path: z.string().max(260).nullable(),
  excerpt: safeText(1600),
  normalizedFact: z.string().max(800).nullable(),
  sourceUrl: z.url().startsWith("https://github.com/"),
  commitSha: sha,
  contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
});

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export const RepoFileSchema = z.object({
  path: z.string().min(1).max(260),
  size: z.number().int().nonnegative(),
  kind: z.enum(["file", "directory", "submodule"]),
});

export type RepoFile = z.infer<typeof RepoFileSchema>;

export const RepoSnapshotSchema = z.object({
  schemaVersion: z.literal(PITCHFLOW_SCHEMA_VERSION),
  id: identifier,
  repository: z.object({
    owner: z.string().min(1).max(39),
    name: z.string().min(1).max(100),
    canonicalUrl: z.url().startsWith("https://github.com/"),
    description: z.string().max(500).nullable(),
    homepage: z.url().nullable(),
    defaultBranch: z.string().min(1).max(255),
    licenseSpdx: z.string().max(80).nullable(),
    isArchived: z.boolean(),
    isFork: z.boolean(),
  }),
  requestedRef: z.string().max(100).nullable(),
  resolvedRef: z.string().min(1).max(255),
  commitSha: sha,
  capturedAt: isoDate,
  languages: z.record(z.string(), z.number().int().nonnegative()),
  tree: z.array(RepoFileSchema).max(5000),
  evidence: z.array(EvidenceItemSchema).min(3).max(40),
  limits: z.object({
    discoveredFiles: z.number().int().nonnegative(),
    includedFiles: z.number().int().nonnegative(),
    includedBytes: z.number().int().nonnegative(),
    truncatedTree: z.boolean(),
  }),
});

export type RepoSnapshot = z.infer<typeof RepoSnapshotSchema>;

export const ClaimClassificationSchema = z.enum(["fact", "supported_inference", "user_supplied"]);

export const FeatureClaimSchema = z
  .object({
    id: identifier,
    text: safeText(240),
    classification: ClaimClassificationSchema,
    confidence: z.number().min(0).max(1),
    evidenceIds: z.array(evidenceId).min(1).max(5),
    evidencePath: z.string().max(260).nullable(),
    evidenceExcerpt: safeText(1600),
    approvalRequired: z.boolean(),
    rationale: safeText(500),
  })
  .superRefine((claim, context) => {
    if (claim.classification === "supported_inference" && !claim.approvalRequired) {
      context.addIssue({
        code: "custom",
        message: "Supported inferences must require explicit approval.",
        path: ["approvalRequired"],
      });
    }
    if (claim.classification === "fact" && claim.confidence < 0.75) {
      context.addIssue({
        code: "custom",
        message: "Facts require confidence of at least 0.75.",
        path: ["confidence"],
      });
    }
  });

export type FeatureClaim = z.infer<typeof FeatureClaimSchema>;

export const ProductBriefSchema = z.object({
  productName: safeText(80),
  oneLiner: safeText(180),
  problem: safeText(500),
  audience: z.array(safeText(100)).min(1).max(4),
  positioning: safeText(500),
  tone: z.enum(["precise", "bold", "warm", "technical", "playful"]),
  differentiators: z.array(safeText(180)).min(2).max(5),
  evidenceIds: z.array(evidenceId).min(1).max(8),
});

export type ProductBrief = z.infer<typeof ProductBriefSchema>;

export const CampaignPreferencesSchema = z.object({
  audience: safeText(240),
  positioning: safeText(500),
  visualDirection: safeText(500),
  tone: z.enum(["precise", "bold", "warm", "technical", "playful"]),
  channels: z
    .array(z.enum(["x", "linkedin", "product-hunt", "email"]))
    .min(1)
    .max(4),
});

export type CampaignPreferences = z.infer<typeof CampaignPreferencesSchema>;

export const DesignTokensSchema = z.object({
  accent: hexColor,
  accentAlt: hexColor,
  background: hexColor,
  surface: hexColor,
  text: hexColor,
  muted: hexColor,
  radius: z.number().int().min(0).max(32),
  displayFont: z.enum(["system-sans", "system-serif"]),
});

export const CampaignSectionSchema = z.object({
  id: identifier,
  eyebrow: safeText(80).nullable(),
  heading: safeText(160),
  body: safeText(700),
  evidenceIds: z.array(evidenceId).min(1).max(5),
});

export const ChannelCopySchema = z.object({
  x: safeText(1200),
  linkedIn: safeText(3000),
  productHunt: z.object({
    name: safeText(60),
    tagline: safeText(60),
    description: safeText(1200),
    firstComment: safeText(1600),
  }),
  email: z.object({
    subject: safeText(120),
    body: safeText(1600),
  }),
  headlineVariants: z.array(safeText(120)).min(3).max(6),
  ctaVariants: z.array(safeText(60)).min(3).max(6),
  evidenceIds: z.array(evidenceId).min(1).max(8),
});

export const SocialCardSchema = z.object({
  headline: safeText(140),
  evidenceIds: z.array(evidenceId).min(1).max(4),
});

export const CarouselSlideSchema = z.object({
  index: z.number().int().min(1).max(5),
  eyebrow: safeText(60),
  headline: safeText(120),
  body: safeText(280),
  evidenceIds: z.array(evidenceId).min(1).max(4),
});

export type CarouselSlide = z.infer<typeof CarouselSlideSchema>;

export const VideoSceneSchema = z.object({
  index: z.number().int().min(1).max(8),
  startFrame: z.number().int().nonnegative(),
  durationFrames: z.number().int().min(30).max(360),
  title: safeText(120),
  audienceCaption: safeText(180),
  visualDirection: safeText(500),
  evidenceIds: z.array(evidenceId).min(1).max(4),
  visual: z.enum(["opening", "repository", "evidence", "workspace", "exports", "closing"]),
});

export const GenerationMetadataSchema = z.object({
  provider: z.enum(["codex-sdk", "deterministic-fixture"]),
  model: safeText(80),
  promptVersion: z.literal(PITCHFLOW_PROMPT_VERSION),
  generatedAt: isoDate,
  threadId: z.string().max(120).nullable(),
  repairAttempts: z.number().int().min(0).max(2),
  usage: z
    .object({
      inputTokens: z.number().int().nonnegative(),
      cachedInputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      reasoningOutputTokens: z.number().int().nonnegative(),
    })
    .nullable(),
});

export const CampaignManifestSchema = z.object({
  schemaVersion: z.literal(PITCHFLOW_SCHEMA_VERSION),
  id: identifier,
  version: z.number().int().positive(),
  source: z.object({
    snapshotId: identifier,
    repositoryUrl: z.url().startsWith("https://github.com/"),
    commitSha: sha,
  }),
  generation: GenerationMetadataSchema,
  productBrief: ProductBriefSchema,
  claims: z.array(FeatureClaimSchema).min(3).max(8),
  design: DesignTokensSchema,
  sections: z.array(CampaignSectionSchema).min(5).max(8),
  socialCards: z.array(SocialCardSchema).length(3),
  carousel: z.array(CarouselSlideSchema).length(5),
  copy: ChannelCopySchema,
  video: z.object({
    fps: z.literal(30),
    durationSeconds: z.number().int().min(25).max(40),
    scenes: z.array(VideoSceneSchema).min(5).max(8),
  }),
});

export type CampaignManifest = z.infer<typeof CampaignManifestSchema>;

export const CampaignDraftClaimSchema = z.object({
  id: identifier,
  text: safeText(240),
  classification: z.enum(["fact", "supported_inference"]),
  confidence: z.number().min(0).max(1),
  evidenceIds: z.array(evidenceId).min(1).max(5),
  rationale: safeText(500),
});

export const CampaignDraftSchema = z.object({
  productBrief: ProductBriefSchema,
  claims: z.array(CampaignDraftClaimSchema).min(3).max(8),
  design: DesignTokensSchema,
  sections: z.array(CampaignSectionSchema).min(5).max(8),
  socialCards: z.array(SocialCardSchema).length(3),
  carousel: z
    .array(
      CarouselSlideSchema.omit({ index: true }).extend({
        index: z.number().int().min(1).max(5),
      }),
    )
    .length(5),
  copy: ChannelCopySchema,
  videoScenes: z
    .array(
      z.object({
        title: safeText(120),
        audienceCaption: safeText(180),
        visualDirection: safeText(500),
        evidenceIds: z.array(evidenceId).min(1).max(4),
        visual: z.enum(["opening", "repository", "evidence", "workspace", "exports", "closing"]),
      }),
    )
    .min(5)
    .max(8),
});

export type CampaignDraft = z.infer<typeof CampaignDraftSchema>;

export const AssetProvenanceSchema = z.enum([
  "repository-derived",
  "pitchflow-generated",
  "user-supplied",
  "licensed-third-party",
]);

export const CreativeAssetSchema = z.object({
  id: identifier,
  kind: z.enum(["microsite", "image", "carousel", "video", "copy", "manifest", "archive"]),
  filename: z.string().min(1).max(180),
  mediaType: z.string().min(1).max(100),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  provenance: AssetProvenanceSchema,
  intendedChannel: z.string().min(1).max(100),
});

export type CreativeAsset = z.infer<typeof CreativeAssetSchema>;

export const RenderJobSchema = z.object({
  id: identifier,
  manifestId: identifier,
  status: z.enum(["queued", "rendering", "complete", "failed"]),
  createdAt: isoDate,
  completedAt: isoDate.nullable(),
  outputAssets: z.array(CreativeAssetSchema),
  error: z.string().max(1000).nullable(),
});

export type RenderJob = z.infer<typeof RenderJobSchema>;
