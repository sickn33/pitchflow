export { PitchFlowComposition } from "./PitchFlowComposition";
export { PitchFlowRoot } from "./Root";
export { createCaptureInputsFromPaths, prepareCaptures } from "./captures";
export {
  PITCHFLOW_COMPOSITION_ID,
  VIDEO_LAYOUTS,
  type CaptureInput,
  type CaptureReceipt,
  type CaptureSource,
  type LayoutDimensions,
  type PitchFlowCompositionProps,
  type PitchFlowRenderMetadata,
  type PitchFlowRenderProgress,
  type PreparedCapture,
  type RenderCampaignVideoOptions,
  type SafeZone,
  type VideoLayout,
} from "./contracts";
export { DEFAULT_CAMPAIGN_MANIFEST } from "./fixture";
export { PitchFlowRenderError, renderCampaignVideo, type PitchFlowRenderStage } from "./render";
export {
  PitchFlowTimelineError,
  getEvidenceLabel,
  getLayoutDimensions,
  getSafeZone,
  validateVideoTimeline,
} from "./timeline";

export const PITCHFLOW_VIDEO_FPS = 30 as const;
