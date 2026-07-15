import {
  BRIDGE_DEFAULT_PORT,
  BRIDGE_PUBLIC_ORIGIN,
  BridgeJobResultSchema,
  BridgeJobIdSchema,
  BridgeJobStageSchema,
  BridgeJobStatusSchema,
  BridgePairingIdSchema,
  BridgeProjectSchema,
  BridgeProviderCapabilitySchema,
  BridgeProviderStatusSchema,
  type BridgeJobResult,
  type BridgeJobStage,
  type BridgeProject,
  type BridgeProviderStatus,
} from "./bridge-contract";
import { z } from "zod";

export const BRIDGE_ORIGIN = `http://127.0.0.1:${BRIDGE_DEFAULT_PORT}` as const;
export const PUBLIC_PRODUCT_ORIGIN = BRIDGE_PUBLIC_ORIGIN;
export const PUBLIC_DEVELOPMENT_ORIGIN = "http://127.0.0.1:3211" as const;

const BridgeStatusEnvelopeSchema = z.object({
  status: BridgeProviderStatusSchema,
  provider: z.literal("codex"),
  message: z.string().min(1).max(240),
  engine: z.object({
    status: BridgeProviderStatusSchema,
    provider: z.literal("codex"),
    message: z.string().min(1).max(240),
  }),
  providers: z.array(BridgeProviderCapabilitySchema).min(1).max(4),
});

export type BridgeStatus = z.infer<typeof BridgeStatusEnvelopeSchema>;

export type BridgeProjectState = BridgeProject;

export type PairState = "pending" | "approved" | "expired" | "rejected";

export type PendingPairing = {
  pairingId: string;
  origin: string;
  repositoryUrl: string;
  audience: string;
  channels: string[];
  captures: Array<{
    fileName: string;
    mediaType: string;
    encodedBytes: number;
    contentSha256: string;
  }>;
  createdAt: string;
  expiresAt: string;
};

const PendingPairingSchema = z.object({
  pairingId: BridgePairingIdSchema,
  origin: z.string().url(),
  repositoryUrl: z.string().url(),
  audience: z.string().min(1).max(240),
  channels: z.array(z.string().min(1).max(100)).min(1).max(8),
  captures: z
    .array(
      z.object({
        fileName: z.string().min(1).max(180),
        mediaType: z.enum(["image/png", "image/jpeg"]),
        encodedBytes: z
          .number()
          .int()
          .positive()
          .max(8 * 1024 * 1024),
        contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .min(2)
    .max(4),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

const BridgeJobEnvelopeSchema = z.object({
  id: BridgeJobIdSchema,
  status: BridgeJobStatusSchema,
  stage: BridgeJobStageSchema,
  progress: z.number().min(0).max(100),
  message: z.string().min(1).max(1_000),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  error: z
    .object({
      code: z.string().min(1).max(100),
      message: z.string().min(1).max(2_000),
    })
    .optional(),
  result: BridgeJobResultSchema.optional(),
});

export type BridgeJob = z.infer<typeof BridgeJobEnvelopeSchema>;

type FetchLike = typeof fetch;

function requestId(): string {
  return crypto.randomUUID();
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & {
    error?: { message?: string } | string;
  };
  if (!response.ok) {
    const detail = typeof body.error === "string" ? body.error : body.error?.message;
    throw new BridgeRequestError(
      detail ?? `Local PitchFlow companion returned HTTP ${response.status}.`,
      response.status,
    );
  }
  return body;
}

export class BridgeRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BridgeRequestError";
  }
}

/**
 * Browser client for the loopback-only companion. The bearer token is deliberately
 * private and has no accessor so UI code cannot put it into URLs, storage, or logs.
 */
export class PitchFlowBridgeClient {
  #sessionToken: string | null = null;
  #localApprovalToken: string | null = null;

  constructor(private readonly fetcher: FetchLike = fetch) {}

  clearSession(): void {
    this.#sessionToken = null;
  }

  async getStatus(): Promise<BridgeStatus> {
    return BridgeStatusEnvelopeSchema.parse(
      await this.requestJson<unknown>("/api/bridge/status", { method: "GET" }, false),
    );
  }

  async requestPairing(
    project: BridgeProjectState,
  ): Promise<{ pairingId: string; expiresAt: string }> {
    return z
      .object({ pairingId: BridgePairingIdSchema, expiresAt: z.string().datetime() })
      .parse(
        await this.postJson(
          "/api/bridge/pair/request",
          { project: BridgeProjectSchema.parse(project) },
          false,
        ),
      );
  }

  async pollPairing(pairingId: string): Promise<{ status: PairState; expiresAt?: string }> {
    const response = z
      .object({
        status: z.enum(["pending", "approved", "expired", "rejected"]),
        expiresAt: z.string().datetime().optional(),
        sessionToken: z
          .string()
          .regex(/^[A-Za-z0-9_-]{43}$/)
          .optional(),
      })
      .parse(await this.postJson<unknown>("/api/bridge/pair/poll", { pairingId }, false));
    if (response.status === "approved") {
      if (!response.sessionToken || response.sessionToken.length < 32) {
        throw new Error("The companion approved pairing without a valid one-time session token.");
      }
      this.#sessionToken = response.sessionToken;
    }
    return response.expiresAt
      ? { status: response.status, expiresAt: response.expiresAt }
      : { status: response.status };
  }

  async getPendingPairing(): Promise<PendingPairing | null> {
    const response = z
      .object({
        pairings: z.array(PendingPairingSchema).max(32),
        approvalToken: z.string().min(32).max(128),
      })
      .parse(await this.requestJson<unknown>("/api/bridge/pair/pending", { method: "GET" }, false));
    this.#localApprovalToken = response.approvalToken;
    return response.pairings[0] ?? null;
  }

  async decidePairing(pairingId: string, decision: "approve" | "reject"): Promise<void> {
    if (!this.#localApprovalToken) throw new Error("Refresh the local pairing request first.");
    const approvalToken = this.#localApprovalToken;
    try {
      await readJson(
        await this.request(
          `/api/bridge/pair/${decision}`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-pitchflow-local-approval": approvalToken,
            },
            body: JSON.stringify({ pairingId }),
          },
          false,
        ),
      );
    } finally {
      this.#localApprovalToken = null;
    }
  }

  async startJob(project: BridgeProjectState): Promise<{ jobId: string }> {
    const input = BridgeProjectSchema.parse(project);
    return z
      .object({ jobId: BridgeJobIdSchema })
      .parse(
        await this.postJson(
          "/api/bridge/jobs",
          { ...input, captures: input.captures, provider: "codex" },
          true,
        ),
      );
  }

  async getJob(jobId: string): Promise<BridgeJob> {
    const response = z
      .object({ job: BridgeJobEnvelopeSchema })
      .parse(await this.postJson<unknown>("/api/bridge/jobs/status", { jobId }, true));
    return response.job;
  }

  async actOnJob(jobId: string, action: "cancel" | "retry"): Promise<{ jobId: string }> {
    return z
      .object({ jobId: BridgeJobIdSchema })
      .parse(await this.postJson("/api/bridge/jobs/action", { jobId, action }, true));
  }

  async getAsset(jobId: string, path: string): Promise<Blob> {
    const response = await this.request(
      "/api/bridge/assets",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId, path }),
      },
      true,
    );
    return response.blob();
  }

  private async postJson<T>(path: string, body: unknown, authenticated: boolean): Promise<T> {
    return this.requestJson<T>(
      path,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
      authenticated,
    );
  }

  private async requestJson<T>(
    path: string,
    init: RequestInit,
    authenticated: boolean,
  ): Promise<T> {
    return readJson<T>(await this.request(path, init, authenticated));
  }

  private async request(
    path: string,
    init: RequestInit,
    authenticated: boolean,
  ): Promise<Response> {
    if (!path.startsWith("/api/bridge/")) throw new Error("Invalid companion path.");
    if (authenticated && !this.#sessionToken) {
      throw new Error("Pair with the local PitchFlow companion before starting a job.");
    }
    const headers = new Headers(init.headers);
    headers.set("x-pitchflow-request-id", requestId());
    if (authenticated) headers.set("authorization", `Bearer ${this.#sessionToken}`);
    const response = await this.fetcher(new URL(path, BRIDGE_ORIGIN), {
      ...init,
      headers,
      cache: "no-store",
      credentials: "omit",
      mode: "cors",
      redirect: "error",
      referrerPolicy: "no-referrer",
    });
    if (authenticated && (response.status === 401 || response.status === 403)) {
      this.clearSession();
    }
    return response;
  }
}

export type CompanionTransferMessage = {
  type: "pitchflow:project-transfer";
  version: 1;
  nonce: string;
  project: BridgeProjectState;
};

export const CompanionTransferNonceSchema = z
  .string()
  .min(22)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

export function isAllowedPublicTransferOrigin(origin: string): boolean {
  return (
    origin === PUBLIC_PRODUCT_ORIGIN ||
    (process.env.NODE_ENV !== "production" && origin === PUBLIC_DEVELOPMENT_ORIGIN)
  );
}

export function isCompanionTransferMessage(value: unknown): value is CompanionTransferMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<CompanionTransferMessage>;
  if (message.type !== "pitchflow:project-transfer" || message.version !== 1) return false;
  return (
    CompanionTransferNonceSchema.safeParse(message.nonce).success &&
    BridgeProjectSchema.safeParse(message.project).success
  );
}

export function parseCompanionTransferMessage(value: unknown): CompanionTransferMessage {
  if (!isCompanionTransferMessage(value)) throw new Error("Invalid companion project transfer.");
  return { ...value, project: BridgeProjectSchema.parse(value.project) };
}

export type { BridgeJobResult, BridgeJobStage, BridgeProviderStatus };
