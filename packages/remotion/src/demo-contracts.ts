export const BUILD_WEEK_DEMO_COMPOSITION_ID = "PitchFlowBuildWeekDemo" as const;
export const BUILD_WEEK_DEMO_FPS = 30 as const;
export const BUILD_WEEK_DEMO_WIDTH = 1920 as const;
export const BUILD_WEEK_DEMO_HEIGHT = 1080 as const;
export const BUILD_WEEK_DEMO_DURATION_SECONDS = 159.6 as const;
export const BUILD_WEEK_DEMO_DURATION_FRAMES = 4788 as const;

export const DEMO_ASSET_KEYS = [
  "narration",
  "cover",
  "evidence",
  "handoff",
  "capture01",
  "capture02",
  "capture03",
  "capture04",
  "socialX",
  "carousel01",
  "landscapeVideo",
  "portraitVideo",
] as const;

export type DemoAssetKey = (typeof DEMO_ASSET_KEYS)[number];

export const DEMO_SOURCE_PATHS: Record<DemoAssetKey, string> = {
  narration: "submission/demo/narration.m4a",
  cover: "submission/media/pitchflow-cover-1800x1200.png",
  evidence: "submission/media/pitchflow-evidence-1800x1200.png",
  handoff: "submission/media/pitchflow-handoff-1800x1200.png",
  capture01: "apps/web/public/dogfood/pitchflow/v1/images/product-capture-01.png",
  capture02: "apps/web/public/dogfood/pitchflow/v1/images/product-capture-02.png",
  capture03: "apps/web/public/dogfood/pitchflow/v1/images/product-capture-03.png",
  capture04: "apps/web/public/dogfood/pitchflow/v1/images/product-capture-04.png",
  socialX: "apps/web/public/dogfood/pitchflow/v1/images/x-1600x900.png",
  carousel01: "apps/web/public/dogfood/pitchflow/v1/carousel/slide-01-1080x1350.png",
  landscapeVideo: "apps/web/public/dogfood/pitchflow/v1/videos/launch-landscape-1920x1080.mp4",
  portraitVideo: "apps/web/public/dogfood/pitchflow/v1/videos/launch-portrait-1080x1920.mp4",
};

export type StagedDemoAsset = {
  publicPath: string;
  sha256: string;
  bytes: number;
};

export type BuildWeekDemoProps = {
  assets: Record<DemoAssetKey, StagedDemoAsset>;
};

export type DemoSection = {
  id: string;
  label: string;
  startFrame: number;
  durationInFrames: number;
};

export type DemoRenderProgress = {
  stage: "staging" | "bundling" | "discovering" | "rendering" | "complete";
  progress: number;
  renderedFrames: number;
  totalFrames: number;
};

export type DemoRenderReport = {
  format: "pitchflow-build-week-demo-render";
  version: 1;
  compositionId: typeof BUILD_WEEK_DEMO_COMPOSITION_ID;
  outputPath: string;
  reportPath: string;
  width: typeof BUILD_WEEK_DEMO_WIDTH;
  height: typeof BUILD_WEEK_DEMO_HEIGHT;
  fps: typeof BUILD_WEEK_DEMO_FPS;
  durationFrames: typeof BUILD_WEEK_DEMO_DURATION_FRAMES;
  durationSeconds: typeof BUILD_WEEK_DEMO_DURATION_SECONDS;
  videoCodec: "h264";
  audioCodec: "aac";
  videoBitrate: "12M";
  audioBitrate: "192k";
  bytes: number;
  sha256: string;
  inputs: Record<DemoAssetKey, { relativePath: string; bytes: number; sha256: string }>;
};

export type RenderBuildWeekDemoOptions = {
  outputPath: string;
  reportPath: string;
  repositoryRoot?: string;
  browserExecutable?: string;
  overwrite?: boolean;
  onProgress?: (event: DemoRenderProgress) => void;
};
