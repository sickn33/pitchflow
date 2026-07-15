import type { CampaignManifest } from "@pitchflow/core";

export const PITCHFLOW_COMPOSITION_ID = "PitchFlow" as const;

export const VIDEO_LAYOUTS = ["landscape", "portrait"] as const;
export type VideoLayout = (typeof VIDEO_LAYOUTS)[number];

export type PitchFlowCompositionProps = {
  manifest: CampaignManifest;
  layout: VideoLayout;
  captures: PreparedCapture[];
};

export type CaptureSource = { kind: "file"; path: string } | { kind: "data-url"; dataUrl: string };

export type CaptureInput = {
  id: string;
  sceneIndex: number;
  order: number;
  alt: string;
  source: CaptureSource;
};

export type PreparedCapture = {
  id: string;
  sceneIndex: number;
  order: number;
  alt: string;
  publicPath: string;
  sha256: string;
  bytes: number;
  mediaType: "image/png" | "image/jpeg";
  width: number;
  height: number;
};

export type CaptureReceipt = Omit<PreparedCapture, "publicPath"> & {
  sourceKind: CaptureSource["kind"];
};

export type LayoutDimensions = {
  width: number;
  height: number;
};

export type SafeZone = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type RenderStage = "bundling" | "discovering" | "rendering" | "complete";

export type PitchFlowRenderProgress = {
  stage: RenderStage;
  progress: number;
  renderedFrames: number;
  encodedFrames: number;
  totalFrames: number;
};

export type PitchFlowRenderMetadata = {
  compositionId: typeof PITCHFLOW_COMPOSITION_ID;
  manifestId: string;
  outputPath: string;
  codec: "h264";
  mediaType: "video/mp4";
  width: number;
  height: number;
  fps: 30;
  durationInFrames: number;
  durationSeconds: number;
  bytes: number;
  sha256: string;
  videoBitrate: string;
  captures: CaptureReceipt[];
};

export type RenderCampaignVideoOptions = {
  manifest: CampaignManifest;
  outputPath: string;
  layout: VideoLayout;
  browserExecutable?: string;
  scale?: number;
  overwrite?: boolean;
  captures?: CaptureInput[];
  capturePaths?: string[];
  onProgress?: (event: PitchFlowRenderProgress) => void;
};
