import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, relative, resolve, sep } from "node:path";

import { assertSafeArchivePath } from "@pitchflow/core";

import {
  BRIDGE_DEFAULT_PORT,
  BRIDGE_PUBLIC_ORIGIN,
  BridgeJobResultSchema,
  BridgeJobStageSchema,
  BridgeJobStatusSchema,
  BridgePairingIdSchema,
  BridgeProjectSchema,
  type BridgeJobResult,
} from "../apps/web/lib/bridge-contract";
import { repeatedArgumentValues, requiredArgument } from "./arguments";

const root = resolve(process.cwd());
const repositoryUrl = requiredArgument("repo");
const outputDirectory = resolve(requiredArgument("output"));
const capturePaths = repeatedArgumentValues("capture").map((path) => resolve(path));
if (!outputDirectory.startsWith(`${root}${sep}`)) {
  throw new Error("Connected-engine evidence must remain inside the PitchFlow repository.");
}
if (capturePaths.length < 2 || capturePaths.length > 4) {
  throw new Error("Connected-engine verification requires 2–4 real product captures.");
}

const origin = process.env.PITCHFLOW_VERIFIER_ORIGIN ?? BRIDGE_PUBLIC_ORIGIN;
const port = process.env.PITCHFLOW_PORT ?? String(BRIDGE_DEFAULT_PORT);
const localOrigin = `http://127.0.0.1:${port}`;
const startedAt = new Date();
const observedStages: string[] = [];

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} returned an invalid response.`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} returned an invalid string.`);
  }
  return value;
}

async function json(response: Response): Promise<unknown> {
  const body: unknown = await response.json();
  if (!response.ok) {
    const envelope = object(body, "Companion error");
    const error = envelope.error ? object(envelope.error, "Companion error") : null;
    throw new Error(
      error && typeof error.message === "string"
        ? error.message
        : `Companion returned HTTP ${response.status}.`,
    );
  }
  return body;
}

async function bridgeRequest(
  path: string,
  init: RequestInit,
  options: { local?: boolean; bearer?: string } = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("x-pitchflow-request-id", randomUUID());
  if (options.local) {
    headers.set("origin", localOrigin);
    headers.set("sec-fetch-site", "same-origin");
  } else {
    headers.set("origin", origin);
  }
  if (options.bearer) headers.set("authorization", `Bearer ${options.bearer}`);
  return fetch(new URL(path, localOrigin), {
    ...init,
    headers,
    cache: "no-store",
    redirect: "error",
  });
}

async function post(
  path: string,
  body: unknown,
  options: { local?: boolean; bearer?: string; headers?: HeadersInit } = {},
): Promise<unknown> {
  return json(
    await bridgeRequest(
      path,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...options.headers },
        body: JSON.stringify(body),
      },
      options,
    ),
  );
}

const captures = await Promise.all(
  capturePaths.map(async (path, order) => {
    const bytes = await readFile(path);
    const extension = path.toLowerCase().endsWith(".jpg") || path.toLowerCase().endsWith(".jpeg");
    return {
      id: `verifier-capture-${order + 1}`,
      order,
      fileName: basename(path),
      label: order === 0 ? "Palette workspace" : `Product settings ${order}`,
      description:
        order === 0
          ? "Creator-owned VibePalette workspace showing a captured palette and export actions."
          : "Creator-owned VibePalette settings showing formats, themes, and product controls.",
      provenance: "creator-owned" as const,
      mediaType: extension ? ("image/jpeg" as const) : ("image/png" as const),
      dataUrl: `data:${extension ? "image/jpeg" : "image/png"};base64,${bytes.toString("base64")}`,
    };
  }),
);

const project = BridgeProjectSchema.parse({
  repositoryUrl,
  preferences: {
    audience: "Developers and designers who need trustworthy palettes from real web pages",
    positioning:
      "Turn the visible tab into an export-ready palette without sending screenshots off-device",
    visualDirection:
      "Editorial product launch grounded in the cream, cocoa, gold, and measured color-grid UI",
    tone: "precise",
    channels: ["x", "linkedin", "product-hunt", "email"],
  },
  captures,
  provider: "codex",
});

const providerEnvelope = object(
  await json(await bridgeRequest("/api/bridge/status", { method: "GET" })),
  "Provider status",
);
const providerStatus = string(providerEnvelope.status, "Provider status");
const providerMessage = string(providerEnvelope.message, "Provider status message");
if (providerEnvelope.provider !== "codex" || providerStatus !== "connected") {
  throw new Error(`Codex provider is not connected: ${providerMessage}`);
}

const pairingEnvelope = object(
  await post("/api/bridge/pair/request", { project }),
  "Pairing request",
);
const pairingId = BridgePairingIdSchema.parse(pairingEnvelope.pairingId);
const pendingEnvelope = object(
  await json(await bridgeRequest("/api/bridge/pair/pending", { method: "GET" }, { local: true })),
  "Pending pairing",
);
const pendingPairings = Array.isArray(pendingEnvelope.pairings) ? pendingEnvelope.pairings : [];
if (
  !pendingPairings.some((candidate) => object(candidate, "Pending pairing").pairingId === pairingId)
) {
  throw new Error("The local companion did not surface the exact verifier pairing request.");
}
const approvalToken = string(pendingEnvelope.approvalToken, "Local approval challenge");
await post(
  "/api/bridge/pair/approve",
  { pairingId },
  { local: true, headers: { "x-pitchflow-local-approval": approvalToken } },
);
const approval = object(await post("/api/bridge/pair/poll", { pairingId }), "Pairing approval");
if (approval.status !== "approved") throw new Error("The pairing was not approved.");
const sessionToken = string(approval.sessionToken, "Pairing session");

const startedEnvelope = object(
  await post("/api/bridge/jobs", project, { bearer: sessionToken }),
  "Job start",
);
const jobId = string(startedEnvelope.jobId, "Job id");

let result: BridgeJobResult | undefined;
const deadline = Date.now() + 30 * 60 * 1_000;
while (Date.now() < deadline) {
  const statusEnvelope = object(
    await post("/api/bridge/jobs/status", { jobId }, { bearer: sessionToken }),
    "Job status",
  );
  const job = object(statusEnvelope.job, "Job status");
  const status = BridgeJobStatusSchema.parse(job.status);
  const stage = BridgeJobStageSchema.parse(job.stage);
  const progress = typeof job.progress === "number" ? job.progress : -1;
  const message = string(job.message, "Job status message");
  if (progress < 0 || progress > 100) throw new Error("Job progress was out of bounds.");
  if (observedStages.at(-1) !== stage) {
    observedStages.push(stage);
    process.stdout.write(`${progress}% ${stage}: ${message}\n`);
  }
  if (status === "completed") {
    if (!job.result) throw new Error("Completed bridge job omitted its owned result.");
    result = BridgeJobResultSchema.parse(job.result);
    break;
  }
  if (status === "failed" || status === "cancelled") {
    const error = job.error ? object(job.error, "Job error") : null;
    throw new Error(error && typeof error.message === "string" ? error.message : message);
  }
  await new Promise((resolveWait) => setTimeout(resolveWait, 1_250));
}
if (!result) throw new Error("Connected-engine verification timed out before completion.");

for (const asset of result.assets) {
  assertSafeArchivePath(asset.filename);
  const response = await bridgeRequest(
    "/api/bridge/assets",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId, path: asset.filename }),
    },
    { bearer: sessionToken },
  );
  if (!response.ok) await json(response);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength !== asset.bytes || digest(bytes) !== asset.sha256) {
    throw new Error(`Downloaded asset failed its ownership receipt: ${asset.filename}`);
  }
  const target = resolve(outputDirectory, asset.filename);
  if (!target.startsWith(`${outputDirectory}${sep}`)) {
    throw new Error("Generated asset escaped the verifier output directory.");
  }
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes, { flag: "wx" });
}

const report = {
  format: "pitchflow-connected-engine-evidence",
  version: 1,
  generatedAt: new Date().toISOString(),
  startedAt: startedAt.toISOString(),
  origin,
  loopbackOnly: true,
  provider: "codex",
  providerStatus,
  repository: result.snapshot.repository.canonicalUrl,
  commitSha: result.snapshot.commitSha,
  campaignId: result.campaign.id,
  productName: result.campaign.productBrief.productName,
  observedStages,
  captures: captures.map((capture) => ({
    fileName: capture.fileName,
    provenance: capture.provenance,
    sha256: digest(Buffer.from(capture.dataUrl.split(",", 2)[1]!, "base64")),
  })),
  assets: result.assets.map((asset) => ({
    filename: asset.filename,
    kind: asset.kind,
    bytes: asset.bytes,
    sha256: asset.sha256,
  })),
  packageFilename: result.packageFilename,
  credentialValuesPrinted: false,
};
await mkdir(outputDirectory, { recursive: true });
await writeFile(
  resolve(outputDirectory, "connected-engine-evidence.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  { flag: "wx" },
);

process.stdout.write(
  `${JSON.stringify(
    {
      status: "ok",
      repository: report.repository,
      commitSha: report.commitSha,
      productName: report.productName,
      assets: report.assets.length,
      package: relative(root, resolve(outputDirectory, result.packageFilename)),
      evidence: relative(root, resolve(outputDirectory, "connected-engine-evidence.json")),
      credentialValuesPrinted: false,
    },
    null,
    2,
  )}\n`,
);
