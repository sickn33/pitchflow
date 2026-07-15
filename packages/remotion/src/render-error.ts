export type PitchFlowRenderStage =
  | "validation"
  | "capture"
  | "browser"
  | "bundle"
  | "composition"
  | "render"
  | "output";

export class PitchFlowRenderError extends Error {
  public readonly stage: PitchFlowRenderStage;

  public constructor(stage: PitchFlowRenderStage, message: string, cause?: unknown) {
    super(`[${stage}] ${message}`, { cause });
    this.name = "PitchFlowRenderError";
    this.stage = stage;
  }
}
