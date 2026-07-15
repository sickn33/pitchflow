import { inspectCodexAuth } from "@pitchflow/codex";

import { isPublicViewer } from "../../../lib/runtime";

export const runtime = "nodejs";

export async function GET() {
  const publicViewer = isPublicViewer();
  if (publicViewer) {
    return Response.json({ mode: "public-viewer", generationEnabled: false, codex: null });
  }
  const codex = await inspectCodexAuth();
  return Response.json({ mode: "local", generationEnabled: codex.authenticated, codex });
}
