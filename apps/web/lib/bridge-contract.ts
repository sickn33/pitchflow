import {
  CampaignManifestSchema,
  CampaignPreferencesSchema,
  CreativeAssetSchema,
  RepoSnapshotSchema,
} from "@pitchflow/core";
import { z } from "zod";

import { CaptureUploadListSchema } from "./capture-contract";

export const BRIDGE_PUBLIC_ORIGIN = "https://pitchflow-ten.vercel.app";
export const BRIDGE_DEFAULT_PORT = 3210;
export const BRIDGE_PAIRING_TTL_MS = 5 * 60 * 1_000;
export const BRIDGE_SESSION_TTL_MS = 30 * 60 * 1_000;
export const BRIDGE_JOB_TTL_MS = 60 * 60 * 1_000;

export const BridgeProviderStatusSchema = z.enum([
  "connected",
  "missing",
  "authentication_required",
  "rate_limited",
  "failed",
]);

export const BridgeProviderCapabilitySchema = z.object({
  provider: z.enum(["codex", "claude-code"]),
  status: BridgeProviderStatusSchema,
  message: z.string().trim().min(1).max(240),
  selectable: z.boolean(),
});

export const BridgeProjectSchema = z.object({
  repositoryUrl: z.string().trim().min(1).max(500),
  preferences: CampaignPreferencesSchema,
  captures: CaptureUploadListSchema,
  provider: z.literal("codex").default("codex"),
});

export const BridgePairingIdSchema = z
  .string()
  .min(32)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

export const BridgeJobIdSchema = z
  .string()
  .min(22)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

export const BridgeRequestIdSchema = z
  .string()
  .min(22)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

export const BridgePairRequestSchema = z.object({
  project: BridgeProjectSchema,
});

export const BridgePairPollSchema = z.object({
  pairingId: BridgePairingIdSchema,
});

export const BridgePairDecisionSchema = z.object({
  pairingId: BridgePairingIdSchema,
});

export const BridgeJobInputSchema = z.object({
  repositoryUrl: z.string().trim().min(1).max(500),
  preferences: CampaignPreferencesSchema,
  captures: CaptureUploadListSchema,
  provider: z.literal("codex").default("codex"),
});

export const BridgeJobActionSchema = z.object({
  jobId: BridgeJobIdSchema,
  action: z.enum(["cancel", "retry"]),
});

export const BridgeJobStatusRequestSchema = z.object({
  jobId: BridgeJobIdSchema,
});

export const BridgeAssetRequestSchema = z.object({
  jobId: BridgeJobIdSchema,
  path: z.string().trim().min(1).max(240),
});

export const BridgeJobStageSchema = z.enum([
  "queued",
  "fetching_evidence",
  "understanding_product",
  "creative_direction",
  "rendering_site_images_copy",
  "rendering_videos",
  "validating",
  "packaging",
  "complete",
]);

export const BridgeJobStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const BridgeJobResultSchema = z.object({
  snapshot: RepoSnapshotSchema,
  campaign: CampaignManifestSchema,
  assets: z.array(CreativeAssetSchema).min(1).max(1_000),
  packageFilename: z.literal("pitchflow-campaign.zip"),
});

export type BridgeProviderStatus = z.infer<typeof BridgeProviderStatusSchema>;
export type BridgeProviderCapability = z.infer<typeof BridgeProviderCapabilitySchema>;
export type BridgeProject = z.infer<typeof BridgeProjectSchema>;
export type BridgeJobInput = z.infer<typeof BridgeJobInputSchema>;
export type BridgeJobStage = z.infer<typeof BridgeJobStageSchema>;
export type BridgeJobStatus = z.infer<typeof BridgeJobStatusSchema>;
export type BridgeJobResult = z.infer<typeof BridgeJobResultSchema>;
