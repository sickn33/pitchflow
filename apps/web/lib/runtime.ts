import { PitchFlowError } from "@pitchflow/core";

export function isPublicViewer(): boolean {
  return process.env.PITCHFLOW_PUBLIC_VIEWER === "1" || process.env.VERCEL === "1";
}

export function assertLocalGenerationEnabled(): void {
  if (isPublicViewer()) {
    throw new PitchFlowError(
      "PUBLIC_VIEWER_READ_ONLY",
      "The public viewer is intentionally read-only. Run PitchFlow locally to analyze a new repository with your own Codex account.",
      403,
    );
  }
}
