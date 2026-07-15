import {
  CodexGenerationError,
  generateCampaignWithCodex,
  inspectCodexAuth,
} from "@pitchflow/codex";
import { CampaignPreferencesSchema, RepoSnapshotSchema, PitchFlowError } from "@pitchflow/core";
import { z } from "zod";

import { errorResponse, readTrustedLocalJson } from "../../../lib/http";
import { assertLocalGenerationEnabled } from "../../../lib/runtime";

export const runtime = "nodejs";
export const maxDuration = 300;

const GenerateRequestSchema = z.object({
  snapshot: RepoSnapshotSchema,
  preferences: CampaignPreferencesSchema,
  previousVersion: z.number().int().positive().max(10_000).optional(),
});

export async function POST(request: Request) {
  try {
    assertLocalGenerationEnabled();
    const auth = await inspectCodexAuth();
    if (!auth.authenticated) {
      throw new PitchFlowError(
        "CODEX_AUTH_REQUIRED",
        "Sign in to Codex locally before generation. PitchFlow never reads or copies your credential values.",
        401,
      );
    }
    const input = GenerateRequestSchema.parse(await readTrustedLocalJson(request, 1_048_576));
    const manifest = await generateCampaignWithCodex(input.snapshot, input.preferences, {
      workingDirectory: process.cwd(),
      version: (input.previousVersion ?? 0) + 1,
    });
    return Response.json({ manifest });
  } catch (error) {
    if (error instanceof CodexGenerationError) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.code === "TIMEOUT" ? 504 : 422 },
      );
    }
    return errorResponse(error);
  }
}
