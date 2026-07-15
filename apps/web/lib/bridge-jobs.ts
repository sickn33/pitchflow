import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

import { CodexGenerationError, generateCampaignWithCodex } from "@pitchflow/codex";
import {
  CreativeAssetSchema,
  PitchFlowError,
  auditManifestEvidence,
  assertSafeArchivePath,
  ingestPublicGitHubRepository,
  sha256,
} from "@pitchflow/core";
import { z } from "zod";

import {
  BRIDGE_JOB_TTL_MS,
  BridgeJobInputSchema,
  BridgeJobResultSchema,
  type BridgeJobInput,
  type BridgeJobResult,
  type BridgeJobStage,
  type BridgeJobStatus,
} from "./bridge-contract";
import { stageCaptureFiles, validateCaptureUploads } from "./captures";
import { detectProviderCapabilities } from "./provider-status";

const MAX_RESULT_ASSETS = 128;
const MAX_RESULT_FILE_BYTES = 256 * 1024 * 1024;
const MAX_RESULT_TOTAL_BYTES = 512 * 1024 * 1024;
const MAX_RETAINED_JOBS = 32;
const MAX_RETAINED_JOBS_PER_SESSION = 8;

const AssetIndexSchema = z.object({
  schemaVersion: z.string(),
  campaignId: z.string(),
  commitSha: z.string().regex(/^[a-f0-9]{40}$/),
  assets: z
    .array(CreativeAssetSchema)
    .min(1)
    .max(MAX_RESULT_ASSETS - 2),
});

const REQUIRED_RESULT_PATHS = [
  "site/index.html",
  "site/styles.css",
  "copy/campaign.json",
  "copy/campaign.md",
  "campaign-manifest.json",
  "repository-snapshot.json",
  "capture-provenance.json",
  "images/og-1200x630.png",
  "images/x-1600x900.png",
  "images/linkedin-1200x627.png",
  "images/instagram-1080x1080.png",
  "videos/launch-landscape-1920x1080.mp4",
  "videos/launch-portrait-1080x1920.mp4",
  "video-render-metadata.json",
  "asset-index.json",
  "pitchflow-campaign.zip",
] as const;

export type BridgeJobError = { code: string; message: string };

export type BridgeJobView = {
  id: string;
  status: BridgeJobStatus;
  stage: BridgeJobStage;
  progress: number;
  message: string;
  createdAt: string;
  updatedAt: string;
  error?: BridgeJobError;
  result?: BridgeJobResult;
};

export type BridgeJobProgress = (stage: BridgeJobStage, progress: number, message: string) => void;

type BridgeRunnerOutput = {
  result: BridgeJobResult;
  outputDirectory: string;
  allowedAssetPaths: Set<string>;
};

export type BridgeJobRunner = (
  input: BridgeJobInput,
  context: {
    signal: AbortSignal;
    progress: BridgeJobProgress;
    jobId: string;
    registerOutputDirectory: (path: string) => void;
  },
) => Promise<BridgeRunnerOutput>;

type StoredJob = BridgeJobView & {
  ownerSessionId: string;
  ownerSessionExpiresAt: number;
  input: BridgeJobInput;
  controller: AbortController;
  outputDirectory: string | null;
  allowedAssetPaths: Set<string>;
  cleanupTimer: NodeJS.Timeout | null;
};

type BridgeJobManagerOptions = {
  now?: () => number;
  random?: (bytes: number) => Buffer;
  runner?: BridgeJobRunner;
  jobTtlMs?: number;
};

function safeJobError(error: unknown): BridgeJobError {
  if (error instanceof PitchFlowError || error instanceof CodexGenerationError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: "BRIDGE_JOB_FAILED",
    message: "The local companion could not complete this generation job.",
  };
}

function repositoryRoot(): string {
  const configured = process.env.PITCHFLOW_REPOSITORY_ROOT;
  if (!configured) {
    throw new PitchFlowError(
      "LOCAL_LAUNCHER_REQUIRED",
      "Run PitchFlow with `pnpm pitchflow connect` before starting a generation job.",
      503,
    );
  }
  return resolve(configured);
}

function parseProgressLine(
  line: string,
): { type: "stage"; stage: string } | { type: "render"; progress: number } | null {
  if (!line.startsWith("{")) return null;
  try {
    const value: unknown = JSON.parse(line);
    if (typeof value !== "object" || value === null || !("type" in value)) return null;
    if (
      value.type === "pitchflow-bundle-stage" &&
      "stage" in value &&
      typeof value.stage === "string"
    ) {
      return { type: "stage", stage: value.stage };
    }
    if (
      value.type === "pitchflow-render-progress" &&
      "event" in value &&
      typeof value.event === "object" &&
      value.event !== null &&
      "progress" in value.event &&
      typeof value.event.progress === "number"
    ) {
      return { type: "render", progress: value.event.progress };
    }
  } catch {
    return null;
  }
  return null;
}

async function runRenderer(input: {
  root: string;
  manifestPath: string;
  snapshotPath: string;
  outputDirectory: string;
  capturePaths: string[];
  captureManifestPath: string;
  signal: AbortSignal;
  progress: BridgeJobProgress;
}): Promise<void> {
  await new Promise<void>((resolveRun, rejectRun) => {
    const child = spawn(
      "pnpm",
      [
        "smoke:render",
        "--",
        "--manifest",
        input.manifestPath,
        "--snapshot",
        input.snapshotPath,
        "--output",
        input.outputDirectory,
        "--progress-json",
        ...input.capturePaths.flatMap((path) => ["--capture", path]),
      ],
      {
        cwd: input.root,
        env: {
          HOME: process.env.HOME ?? "",
          ...(process.env.LANG ? { LANG: process.env.LANG } : {}),
          ...(process.env.LC_ALL ? { LC_ALL: process.env.LC_ALL } : {}),
          PATH: process.env.PATH ?? "",
          ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}),
          NODE_ENV: "production",
          PITCHFLOW_REPOSITORY_ROOT: input.root,
          PITCHFLOW_CAPTURE_MANIFEST_PATH: input.captureManifestPath,
          ...(process.env.PITCHFLOW_CHROME_PATH
            ? { PITCHFLOW_CHROME_PATH: process.env.PITCHFLOW_CHROME_PATH }
            : {}),
        },
        detached: process.platform !== "win32",
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdoutBuffer = "";
    const terminate = (signal: NodeJS.Signals) => {
      if (child.pid && process.platform !== "win32") {
        try {
          process.kill(-child.pid, signal);
          return;
        } catch {
          // Fall through to the direct child when the process group is already gone.
        }
      }
      child.kill(signal);
    };
    const abort = () => terminate("SIGTERM");
    input.signal.addEventListener("abort", abort, { once: true });
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer = `${stdoutBuffer}${chunk.toString("utf8")}`.slice(-32_000);
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) {
        const event = parseProgressLine(line);
        if (event?.type === "render") {
          input.progress(
            "rendering_videos",
            58 + Math.max(0, Math.min(1, event.progress)) * 28,
            "Rendering the landscape and vertical Remotion videos.",
          );
        } else if (event?.type === "stage") {
          if (event.stage === "writing-core" || event.stage === "rendering-images") {
            input.progress(
              "rendering_site_images_copy",
              event.stage === "writing-core" ? 42 : 50,
              "Rendering the launch site, social images, carousel, and copy.",
            );
          } else if (event.stage === "rendering-videos") {
            input.progress(
              "rendering_videos",
              58,
              "Rendering the landscape and vertical Remotion videos.",
            );
          } else if (event.stage === "indexing") {
            input.progress("validating", 90, "Validating generated assets and provenance.");
          } else if (event.stage === "packaging") {
            input.progress("packaging", 96, "Packaging the complete launch ZIP.");
          }
        }
      }
    });
    child.stderr.on("data", () => {
      // Intentionally discard renderer diagnostics at the HTTP/job boundary.
    });
    child.once("error", (error) => {
      input.signal.removeEventListener("abort", abort);
      rejectRun(error);
    });
    child.once("exit", (code, terminationSignal) => {
      input.signal.removeEventListener("abort", abort);
      if (input.signal.aborted) {
        rejectRun(
          new PitchFlowError(
            "BRIDGE_JOB_CANCELLED",
            "The generation job was cancelled and its renderer was stopped.",
            409,
          ),
        );
      } else if (code === 0) resolveRun();
      else {
        rejectRun(
          new PitchFlowError(
            "BRIDGE_RENDER_FAILED",
            `The local renderer stopped with ${code ?? terminationSignal ?? "an error"}.`,
            500,
          ),
        );
      }
    });
  });
}

async function inspectBundle(
  outputDirectory: string,
  snapshot: BridgeJobResult["snapshot"],
  campaign: BridgeJobResult["campaign"],
): Promise<BridgeRunnerOutput> {
  const indexPath = join(outputDirectory, "asset-index.json");
  const index = AssetIndexSchema.parse(JSON.parse(await readFile(indexPath, "utf8")));
  if (index.campaignId !== campaign.id || index.commitSha !== snapshot.commitSha) {
    throw new PitchFlowError(
      "BRIDGE_PACKAGE_OWNERSHIP_INVALID",
      "The generated package does not belong to this campaign and pinned repository commit.",
      422,
    );
  }
  const evidenceAudit = auditManifestEvidence(campaign, snapshot);
  if (!evidenceAudit.valid) {
    throw new PitchFlowError(
      "BRIDGE_PACKAGE_EVIDENCE_INVALID",
      "The generated campaign failed its evidence-link audit.",
      422,
    );
  }
  const indexBytes = await readFile(indexPath);
  const archivePath = join(outputDirectory, "pitchflow-campaign.zip");
  const archiveBytes = await readFile(archivePath);
  const extraAssets = [
    CreativeAssetSchema.parse({
      id: `asset_${sha256("asset-index.json").slice(0, 12)}`,
      kind: "manifest",
      filename: "asset-index.json",
      mediaType: "application/json",
      width: null,
      height: null,
      bytes: indexBytes.byteLength,
      sha256: sha256(indexBytes),
      provenance: "pitchflow-generated",
      intendedChannel: "Asset inventory",
    }),
    CreativeAssetSchema.parse({
      id: `asset_${sha256("pitchflow-campaign.zip").slice(0, 12)}`,
      kind: "archive",
      filename: "pitchflow-campaign.zip",
      mediaType: "application/zip",
      width: null,
      height: null,
      bytes: archiveBytes.byteLength,
      sha256: sha256(archiveBytes),
      provenance: "pitchflow-generated",
      intendedChannel: "Complete campaign archive",
    }),
  ];
  const assets = [...index.assets, ...extraAssets];
  if (
    assets.length > MAX_RESULT_ASSETS ||
    assets.some((asset) => asset.bytes <= 0 || asset.bytes > MAX_RESULT_FILE_BYTES) ||
    assets.reduce((total, asset) => total + asset.bytes, 0) > MAX_RESULT_TOTAL_BYTES
  ) {
    throw new PitchFlowError(
      "BRIDGE_PACKAGE_BOUNDS_INVALID",
      "The generated package exceeded the companion's result limits.",
      413,
    );
  }
  const allowedAssetPaths = new Set(assets.map((asset) => asset.filename));
  for (const required of REQUIRED_RESULT_PATHS) {
    if (!allowedAssetPaths.has(required)) {
      throw new PitchFlowError(
        "BRIDGE_PACKAGE_INCOMPLETE",
        `The generated package is missing required output ${required}.`,
        422,
      );
    }
  }
  return {
    result: BridgeJobResultSchema.parse({
      snapshot,
      campaign,
      assets,
      packageFilename: "pitchflow-campaign.zip",
    }),
    outputDirectory,
    allowedAssetPaths,
  };
}

export const runRealBridgeJob: BridgeJobRunner = async (input, context) => {
  const providers = await detectProviderCapabilities();
  const codex = providers.find((provider) => provider.provider === "codex");
  if (!codex || codex.status !== "connected" || !codex.selectable) {
    throw new PitchFlowError(
      codex?.status === "rate_limited" ? "CODEX_RATE_LIMITED" : "CODEX_AUTH_REQUIRED",
      codex?.message ?? "Codex is unavailable on this machine.",
      codex?.status === "rate_limited" ? 429 : 401,
    );
  }
  const root = repositoryRoot();
  const jobDirectory = join(root, "artifacts", "exports", ".bridge-jobs", context.jobId);
  const inputDirectory = join(jobDirectory, "input");
  const outputDirectory = join(jobDirectory, "output");
  context.registerOutputDirectory(outputDirectory);
  await mkdir(inputDirectory, { recursive: true });
  context.progress("fetching_evidence", 5, "Fetching bounded repository evidence from GitHub.");
  const snapshot = await ingestPublicGitHubRepository(input.repositoryUrl, {
    ...(process.env.GITHUB_TOKEN ? { githubToken: process.env.GITHUB_TOKEN } : {}),
    signal: context.signal,
  });
  context.progress(
    "understanding_product",
    18,
    "Repository evidence is pinned; preparing the product brief.",
  );
  context.progress(
    "creative_direction",
    25,
    "GPT-5.6 Sol is directing the evidence-linked campaign through local Codex.",
  );
  const campaign = await generateCampaignWithCodex(snapshot, input.preferences, {
    workingDirectory: root,
    signal: context.signal,
  });
  if (context.signal.aborted) {
    throw new PitchFlowError("BRIDGE_JOB_CANCELLED", "The generation job was cancelled.", 409);
  }
  const stagedCaptures = await stageCaptureFiles(
    inputDirectory,
    validateCaptureUploads(input.captures),
  );
  const manifestPath = join(inputDirectory, "campaign-manifest.json");
  const snapshotPath = join(inputDirectory, "repository-snapshot.json");
  await Promise.all([
    writeFile(manifestPath, `${JSON.stringify(campaign, null, 2)}\n`, { flag: "wx" }),
    writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: "wx" }),
  ]);
  context.progress(
    "rendering_site_images_copy",
    40,
    "Rendering repository-specific launch assets.",
  );
  await runRenderer({
    root,
    manifestPath,
    snapshotPath,
    outputDirectory,
    capturePaths: stagedCaptures.paths,
    captureManifestPath: stagedCaptures.manifestPath,
    signal: context.signal,
    progress: context.progress,
  });
  context.progress("validating", 92, "Validating package ownership, evidence, and assets.");
  const output = await inspectBundle(outputDirectory, snapshot, campaign);
  context.progress("packaging", 98, "The complete launch package is ready for delivery.");
  return output;
};

export class BridgeJobManager {
  readonly #now: () => number;
  readonly #random: (bytes: number) => Buffer;
  readonly #runner: BridgeJobRunner;
  readonly #jobTtlMs: number;
  readonly #jobs = new Map<string, StoredJob>();

  constructor(options: BridgeJobManagerOptions = {}) {
    this.#now = options.now ?? Date.now;
    this.#random = options.random ?? randomBytes;
    this.#runner = options.runner ?? runRealBridgeJob;
    this.#jobTtlMs = options.jobTtlMs ?? BRIDGE_JOB_TTL_MS;
  }

  #jobId(): string {
    return this.#random(18).toString("base64url");
  }

  async #removeOutput(job: StoredJob): Promise<void> {
    if (job.outputDirectory) {
      const root = repositoryRoot();
      const expectedBase = join(root, "artifacts", "exports", ".bridge-jobs");
      const output = resolve(job.outputDirectory);
      if (output.startsWith(`${resolve(expectedBase)}${sep}`)) {
        await rm(join(output, ".."), { recursive: true, force: true });
      }
      job.outputDirectory = null;
      job.allowedAssetPaths.clear();
    }
  }

  #publicView(job: StoredJob): BridgeJobView {
    return {
      id: job.id,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      message: job.message,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      ...(job.error ? { error: { ...job.error } } : {}),
      ...(job.result ? { result: job.result } : {}),
    };
  }

  #ownedJob(ownerSessionId: string, jobId: string): StoredJob {
    const job = this.#jobs.get(jobId);
    if (!job || job.ownerSessionId !== ownerSessionId) {
      throw new PitchFlowError("BRIDGE_JOB_NOT_FOUND", "The generation job was not found.", 404);
    }
    return job;
  }

  async #cleanupExpired(): Promise<void> {
    const now = this.#now();
    for (const [jobId, job] of this.#jobs) {
      if (job.ownerSessionExpiresAt <= now && !job.controller.signal.aborted) {
        job.controller.abort(new Error("Companion session expired."));
      }
      if (new Date(job.updatedAt).getTime() + this.#jobTtlMs <= now) {
        if (job.cleanupTimer) clearTimeout(job.cleanupTimer);
        await this.#removeOutput(job);
        this.#jobs.delete(jobId);
      }
    }
  }

  async start(
    owner: { id: string; expiresAt: number },
    inputValue: unknown,
  ): Promise<BridgeJobView> {
    await this.#cleanupExpired();
    const input = BridgeJobInputSchema.parse(inputValue);
    if (
      [...this.#jobs.values()].some(
        (job) =>
          job.ownerSessionId === owner.id && (job.status === "queued" || job.status === "running"),
      )
    ) {
      throw new PitchFlowError(
        "BRIDGE_JOB_ALREADY_ACTIVE",
        "This companion session already has an active generation job.",
        409,
      );
    }
    const retainedForOwner = [...this.#jobs.values()].filter(
      (job) => job.ownerSessionId === owner.id,
    );
    if (
      this.#jobs.size >= MAX_RETAINED_JOBS ||
      retainedForOwner.length >= MAX_RETAINED_JOBS_PER_SESSION
    ) {
      throw new PitchFlowError(
        "BRIDGE_JOB_LIMIT",
        "The companion reached its retained job limit. Let an old session expire and retry.",
        429,
      );
    }
    const now = this.#now();
    const job: StoredJob = {
      id: this.#jobId(),
      ownerSessionId: owner.id,
      ownerSessionExpiresAt: owner.expiresAt,
      input,
      status: "queued",
      stage: "queued",
      progress: 0,
      message: "Generation job queued on the local companion.",
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      controller: new AbortController(),
      outputDirectory: null,
      allowedAssetPaths: new Set(),
      cleanupTimer: null,
    };
    this.#jobs.set(job.id, job);
    const sessionDelay = Math.max(0, owner.expiresAt - now);
    job.cleanupTimer = setTimeout(() => {
      if (job.status === "queued" || job.status === "running") {
        job.controller.abort(new Error("Companion session expired."));
      }
      void this.#removeOutput(job);
    }, sessionDelay);
    job.cleanupTimer.unref();
    void this.#run(job);
    return this.#publicView(job);
  }

  async #run(job: StoredJob): Promise<void> {
    job.status = "running";
    job.updatedAt = new Date(this.#now()).toISOString();
    const progress: BridgeJobProgress = (stage, value, message) => {
      if (job.controller.signal.aborted) return;
      job.stage = stage;
      job.progress = Math.max(job.progress, Math.min(99, value));
      job.message = message;
      job.updatedAt = new Date(this.#now()).toISOString();
    };
    try {
      const output = await this.#runner(job.input, {
        signal: job.controller.signal,
        progress,
        jobId: job.id,
        registerOutputDirectory: (path) => {
          const root = repositoryRoot();
          const expectedBase = resolve(join(root, "artifacts", "exports", ".bridge-jobs"));
          const output = resolve(path);
          if (!output.startsWith(`${expectedBase}${sep}`) || !output.endsWith(`${sep}output`)) {
            throw new PitchFlowError(
              "BRIDGE_OUTPUT_BOUNDARY_INVALID",
              "The generation job attempted to register an invalid output directory.",
              500,
            );
          }
          job.outputDirectory = output;
        },
      });
      if (job.controller.signal.aborted) throw job.controller.signal.reason;
      job.result = BridgeJobResultSchema.parse(output.result);
      job.outputDirectory = output.outputDirectory;
      job.allowedAssetPaths = new Set(output.allowedAssetPaths);
      job.status = "completed";
      job.stage = "complete";
      job.progress = 100;
      job.message = "The complete repository-specific launch package is ready.";
      job.updatedAt = new Date(this.#now()).toISOString();
    } catch (error) {
      await this.#removeOutput(job);
      job.updatedAt = new Date(this.#now()).toISOString();
      if (job.controller.signal.aborted) {
        job.status = "cancelled";
        job.message = "Generation cancelled; partial outputs were removed.";
      } else {
        job.status = "failed";
        job.error = safeJobError(error);
        job.message = job.error.message;
      }
    }
  }

  async status(ownerSessionId: string, jobId: string): Promise<BridgeJobView> {
    await this.#cleanupExpired();
    return this.#publicView(this.#ownedJob(ownerSessionId, jobId));
  }

  async cancel(ownerSessionId: string, jobId: string): Promise<BridgeJobView> {
    await this.#cleanupExpired();
    const job = this.#ownedJob(ownerSessionId, jobId);
    if (job.status !== "queued" && job.status !== "running") {
      throw new PitchFlowError(
        "BRIDGE_JOB_NOT_CANCELLABLE",
        "Only a queued or running generation job can be cancelled.",
        409,
      );
    }
    job.controller.abort(new Error("Cancelled by the paired user."));
    return this.#publicView(job);
  }

  async retry(owner: { id: string; expiresAt: number }, jobId: string): Promise<BridgeJobView> {
    await this.#cleanupExpired();
    const job = this.#ownedJob(owner.id, jobId);
    if (job.status !== "failed" && job.status !== "cancelled") {
      throw new PitchFlowError(
        "BRIDGE_JOB_NOT_RETRYABLE",
        "Only a failed or cancelled generation job can be retried.",
        409,
      );
    }
    return this.start(owner, job.input);
  }

  async readAsset(
    ownerSessionId: string,
    jobId: string,
    path: string,
  ): Promise<{ data: Buffer; asset: BridgeJobResult["assets"][number] }> {
    await this.#cleanupExpired();
    const job = this.#ownedJob(ownerSessionId, jobId);
    if (job.status !== "completed" || !job.result || !job.outputDirectory) {
      throw new PitchFlowError(
        "BRIDGE_JOB_NOT_COMPLETE",
        "Generated assets are available only after the job completes.",
        409,
      );
    }
    assertSafeArchivePath(path);
    if (!job.allowedAssetPaths.has(path)) {
      throw new PitchFlowError("BRIDGE_ASSET_NOT_FOUND", "The generated asset was not found.", 404);
    }
    const asset = job.result.assets.find((candidate) => candidate.filename === path);
    if (!asset) {
      throw new PitchFlowError("BRIDGE_ASSET_NOT_FOUND", "The generated asset was not found.", 404);
    }
    const absolute = resolve(job.outputDirectory, path);
    if (!absolute.startsWith(`${resolve(job.outputDirectory)}${sep}`)) {
      throw new PitchFlowError("BRIDGE_ASSET_NOT_FOUND", "The generated asset was not found.", 404);
    }
    const metadata = await lstat(absolute);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size !== asset.bytes) {
      throw new PitchFlowError("BRIDGE_ASSET_NOT_FOUND", "The generated asset was not found.", 404);
    }
    const data = await readFile(absolute);
    if (data.byteLength > MAX_RESULT_FILE_BYTES || sha256(data) !== asset.sha256) {
      throw new PitchFlowError(
        "BRIDGE_ASSET_INTEGRITY_FAILED",
        "The generated asset failed its integrity check.",
        422,
      );
    }
    return { data, asset };
  }
}
