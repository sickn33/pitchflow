import { ingestPublicGitHubRepository } from "@pitchflow/core";
import { z } from "zod";

import { errorResponse, readTrustedLocalJson } from "../../../lib/http";
import { assertLocalGenerationEnabled } from "../../../lib/runtime";

export const runtime = "nodejs";

const AnalyzeRequestSchema = z.object({
  repositoryUrl: z.string().trim().min(1).max(500),
});

export async function POST(request: Request) {
  try {
    assertLocalGenerationEnabled();
    const input = AnalyzeRequestSchema.parse(await readTrustedLocalJson(request, 4_096));
    const githubToken = process.env.GITHUB_TOKEN;
    const snapshot = await ingestPublicGitHubRepository(
      input.repositoryUrl,
      githubToken ? { githubToken } : {},
    );
    return Response.json({ snapshot });
  } catch (error) {
    return errorResponse(error);
  }
}
