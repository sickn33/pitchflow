import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  CampaignManifestSchema,
  PitchFlowError,
  RepoSnapshotSchema,
  auditManifestEvidence,
} from "@pitchflow/core";
import { z } from "zod";

import { errorResponse, readTrustedLocalJson } from "../../../lib/http";
import { assertLocalGenerationEnabled } from "../../../lib/runtime";
import { CaptureUploadListSchema, MAX_EXPORT_REQUEST_BYTES } from "../../../lib/capture-contract";
import {
  captureCliArguments,
  stageCaptureFiles,
  validateCaptureUploads,
} from "../../../lib/captures";

export const runtime = "nodejs";
export const maxDuration = 600;

const ExportRequestSchema = z.object({
  snapshot: RepoSnapshotSchema,
  campaign: CampaignManifestSchema,
  captures: CaptureUploadListSchema,
});

function repositoryRoot(): string {
  const configuredRoot = process.env.PITCHFLOW_REPOSITORY_ROOT;
  if (!configuredRoot) {
    throw new PitchFlowError(
      "LOCAL_LAUNCHER_REQUIRED",
      "Launch PitchFlow with the repository one-command runner before exporting.",
      503,
    );
  }
  return resolve(configuredRoot);
}

async function runRenderer(
  root: string,
  manifestPath: string,
  snapshotPath: string,
  outputDirectory: string,
  capturePaths: string[],
  captureManifestPath: string,
  signal: AbortSignal,
): Promise<void> {
  await new Promise<void>((resolveRun, rejectRun) => {
    const child = spawn(
      "pnpm",
      [
        "smoke:render",
        "--",
        "--manifest",
        manifestPath,
        "--snapshot",
        snapshotPath,
        "--output",
        outputDirectory,
        ...captureCliArguments(capturePaths),
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          PITCHFLOW_REPOSITORY_ROOT: root,
          PITCHFLOW_CAPTURE_MANIFEST_PATH: captureManifestPath,
        },
        shell: false,
        stdio: ["ignore", "ignore", "pipe"],
      },
    );
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString("utf8")}`.slice(-16_000);
    });
    const abort = () => child.kill("SIGTERM");
    signal.addEventListener("abort", abort, { once: true });
    child.once("error", rejectRun);
    child.once("exit", (code, terminationSignal) => {
      signal.removeEventListener("abort", abort);
      if (code === 0) resolveRun();
      else {
        rejectRun(
          new Error(
            `PitchFlow renderer exited with ${code ?? terminationSignal ?? "unknown"}: ${stderr.trim()}`,
          ),
        );
      }
    });
  });
}

export async function POST(request: Request) {
  let jobDirectory: string | null = null;
  let outputDirectory: string | null = null;
  try {
    assertLocalGenerationEnabled();
    const input = ExportRequestSchema.parse(
      await readTrustedLocalJson(request, MAX_EXPORT_REQUEST_BYTES),
    );
    if (input.campaign.claims.some((claim) => claim.approvalRequired)) {
      throw new PitchFlowError(
        "CAMPAIGN_APPROVAL_REQUIRED",
        "Review every supported inference before exporting the campaign.",
        409,
      );
    }
    const evidenceAudit = auditManifestEvidence(input.campaign, input.snapshot);
    if (!evidenceAudit.valid) {
      throw new PitchFlowError(
        "CAMPAIGN_EVIDENCE_INVALID",
        `Campaign evidence audit failed: ${evidenceAudit.errors[0]}`,
        422,
      );
    }
    const root = repositoryRoot();
    const jobId = randomUUID();
    jobDirectory = join(root, "artifacts", "exports", ".jobs", jobId);
    outputDirectory = join(root, "artifacts", "exports", `${input.campaign.id}-${jobId}`);
    await mkdir(jobDirectory, { recursive: true });
    const stagedCaptures = await stageCaptureFiles(
      jobDirectory,
      validateCaptureUploads(input.captures),
    );
    const manifestPath = join(jobDirectory, "campaign-manifest.json");
    const snapshotPath = join(jobDirectory, "repository-snapshot.json");
    await Promise.all([
      writeFile(manifestPath, `${JSON.stringify(input.campaign, null, 2)}\n`, "utf8"),
      writeFile(snapshotPath, `${JSON.stringify(input.snapshot, null, 2)}\n`, "utf8"),
    ]);
    await runRenderer(
      root,
      manifestPath,
      snapshotPath,
      outputDirectory,
      stagedCaptures.paths,
      stagedCaptures.manifestPath,
      request.signal,
    );
    const archive = await readFile(join(outputDirectory, "pitchflow-campaign.zip"));
    return new Response(archive, {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "content-disposition": `attachment; filename="pitchflow-${input.campaign.id}.zip"`,
        "content-length": String(archive.byteLength),
        "content-type": "application/zip",
        "x-pitchflow-campaign": input.campaign.id,
      },
    });
  } catch (error) {
    return errorResponse(error);
  } finally {
    await Promise.all([
      ...(jobDirectory ? [rm(jobDirectory, { recursive: true, force: true })] : []),
      ...(outputDirectory ? [rm(outputDirectory, { recursive: true, force: true })] : []),
    ]);
  }
}
