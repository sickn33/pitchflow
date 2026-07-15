import { createHash, randomBytes } from "node:crypto";

import { PitchFlowError, normalizeGitHubUrl } from "@pitchflow/core";

import {
  BRIDGE_PAIRING_TTL_MS,
  BRIDGE_SESSION_TTL_MS,
  BridgePairingIdSchema,
  BridgeProjectSchema,
  BridgeRequestIdSchema,
  type BridgeProject,
} from "./bridge-contract";

type PairingStatus = "pending" | "approved" | "rejected";

type PairingRecord = {
  id: string;
  origin: string;
  project: BridgeProject;
  status: PairingStatus;
  createdAt: number;
  expiresAt: number;
  sessionToken: string | null;
  sessionExpiresAt: number | null;
  sessionTokenDelivered: boolean;
};

type SessionRecord = {
  id: string;
  tokenHash: string;
  origin: string;
  createdAt: number;
  expiresAt: number;
  seenRequestIds: Set<string>;
  projectDigest: string;
};

export type PairingSummary = {
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

export type AuthenticatedBridgeSession = {
  id: string;
  origin: string;
  expiresAt: number;
};

type BridgeSecurityOptions = {
  now?: () => number;
  random?: (bytes: number) => Buffer;
  pairingTtlMs?: number;
  sessionTtlMs?: number;
  maxPendingPairings?: number;
  maxPendingPairingsPerOrigin?: number;
  maxSessions?: number;
  maxSessionsPerOrigin?: number;
};

const LOCAL_APPROVAL_TTL_MS = 2 * 60 * 1_000;

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalProject(projectInput: unknown): BridgeProject {
  const project = BridgeProjectSchema.parse(projectInput);
  return {
    ...project,
    repositoryUrl: normalizeGitHubUrl(project.repositoryUrl).canonicalUrl,
    captures: [...project.captures].sort((left, right) => left.order - right.order),
  };
}

function projectDigest(project: BridgeProject): string {
  return digest(JSON.stringify(project));
}

function encodedCaptureBytes(dataUrl: string): number {
  const encoded = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  return Math.max(0, (encoded.length / 4) * 3 - padding);
}

function bearerToken(authorization: string | null): string {
  const match = authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/);
  if (!match) {
    throw new PitchFlowError(
      "BRIDGE_SESSION_REQUIRED",
      "PitchFlow requires an approved local companion session.",
      401,
    );
  }
  return match[1]!;
}

export class BridgeSecurityStore {
  readonly #now: () => number;
  readonly #random: (bytes: number) => Buffer;
  readonly #pairingTtlMs: number;
  readonly #sessionTtlMs: number;
  readonly #maxPendingPairings: number;
  readonly #maxPendingPairingsPerOrigin: number;
  readonly #maxSessions: number;
  readonly #maxSessionsPerOrigin: number;
  readonly #pairings = new Map<string, PairingRecord>();
  readonly #sessionsByTokenHash = new Map<string, SessionRecord>();
  #localApprovalToken: { raw: string; expiresAt: number } | null = null;

  constructor(options: BridgeSecurityOptions = {}) {
    this.#now = options.now ?? Date.now;
    this.#random = options.random ?? randomBytes;
    this.#pairingTtlMs = options.pairingTtlMs ?? BRIDGE_PAIRING_TTL_MS;
    this.#sessionTtlMs = options.sessionTtlMs ?? BRIDGE_SESSION_TTL_MS;
    this.#maxPendingPairings = options.maxPendingPairings ?? 128;
    this.#maxPendingPairingsPerOrigin = options.maxPendingPairingsPerOrigin ?? 32;
    this.#maxSessions = options.maxSessions ?? 64;
    this.#maxSessionsPerOrigin = options.maxSessionsPerOrigin ?? 16;
  }

  #opaque(bytes: number): string {
    return this.#random(bytes).toString("base64url");
  }

  cleanup(): void {
    const now = this.#now();
    for (const [id, pairing] of this.#pairings) {
      if (pairing.expiresAt <= now) {
        pairing.sessionToken = null;
        this.#pairings.delete(id);
      }
    }
    for (const [tokenHash, session] of this.#sessionsByTokenHash) {
      if (session.expiresAt <= now) this.#sessionsByTokenHash.delete(tokenHash);
    }
    if (this.#localApprovalToken && this.#localApprovalToken.expiresAt <= now) {
      this.#localApprovalToken = null;
    }
  }

  issueLocalApprovalToken(): string {
    this.cleanup();
    if (this.#localApprovalToken) return this.#localApprovalToken.raw;
    const token = this.#opaque(32);
    this.#localApprovalToken = {
      raw: token,
      expiresAt: this.#now() + LOCAL_APPROVAL_TTL_MS,
    };
    return token;
  }

  consumeLocalApprovalToken(token: string | null): void {
    this.cleanup();
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      throw new PitchFlowError(
        "BRIDGE_LOCAL_APPROVAL_TOKEN_REQUIRED",
        "The local approval challenge is missing or invalid.",
        403,
      );
    }
    if (!this.#localApprovalToken || digest(token) !== digest(this.#localApprovalToken.raw)) {
      throw new PitchFlowError(
        "BRIDGE_LOCAL_APPROVAL_TOKEN_EXPIRED",
        "The local approval challenge expired or was already used.",
        403,
      );
    }
    this.#localApprovalToken = null;
  }

  requestPairing(origin: string, projectInput: unknown) {
    this.cleanup();
    const pending = [...this.#pairings.values()].filter((pairing) => pairing.status === "pending");
    if (
      pending.length >= this.#maxPendingPairings ||
      pending.filter((pairing) => pairing.origin === origin).length >=
        this.#maxPendingPairingsPerOrigin
    ) {
      throw new PitchFlowError(
        "BRIDGE_PAIRING_LIMIT",
        "The companion has too many pending pairing requests. Reject an old request or retry later.",
        429,
      );
    }
    const project = canonicalProject(projectInput);
    const pairingId = this.#opaque(24);
    const now = this.#now();
    const pairing: PairingRecord = {
      id: pairingId,
      origin,
      project,
      status: "pending",
      createdAt: now,
      expiresAt: now + this.#pairingTtlMs,
      sessionToken: null,
      sessionExpiresAt: null,
      sessionTokenDelivered: false,
    };
    this.#pairings.set(pairingId, pairing);
    return { pairingId, expiresAt: new Date(pairing.expiresAt).toISOString() };
  }

  pendingPairings(): PairingSummary[] {
    this.cleanup();
    return [...this.#pairings.values()]
      .filter((pairing) => pairing.status === "pending")
      .sort((left, right) => left.createdAt - right.createdAt)
      .map((pairing) => ({
        pairingId: pairing.id,
        origin: pairing.origin,
        repositoryUrl: pairing.project.repositoryUrl,
        audience: pairing.project.preferences.audience,
        channels: [...pairing.project.preferences.channels],
        captures: pairing.project.captures.map((capture) => ({
          fileName: capture.fileName,
          mediaType: capture.mediaType,
          encodedBytes: encodedCaptureBytes(capture.dataUrl),
          contentSha256: digest(capture.dataUrl),
        })),
        createdAt: new Date(pairing.createdAt).toISOString(),
        expiresAt: new Date(pairing.expiresAt).toISOString(),
      }));
  }

  decidePairing(pairingIdInput: unknown, decision: "approve" | "reject"): void {
    this.cleanup();
    const pairingId = BridgePairingIdSchema.parse(pairingIdInput);
    const pairing = this.#pairings.get(pairingId);
    if (!pairing || pairing.status !== "pending") {
      throw new PitchFlowError(
        "BRIDGE_PAIRING_NOT_PENDING",
        "The pairing request is missing, expired, or already decided.",
        409,
      );
    }
    if (decision === "reject") {
      pairing.status = "rejected";
      return;
    }
    const activeSessions = [...this.#sessionsByTokenHash.values()];
    if (
      activeSessions.length >= this.#maxSessions ||
      activeSessions.filter((session) => session.origin === pairing.origin).length >=
        this.#maxSessionsPerOrigin
    ) {
      throw new PitchFlowError(
        "BRIDGE_SESSION_LIMIT",
        "The companion has too many active sessions. Let an old session expire before pairing again.",
        429,
      );
    }
    const token = this.#opaque(32);
    const now = this.#now();
    const session: SessionRecord = {
      id: this.#opaque(16),
      tokenHash: digest(token),
      origin: pairing.origin,
      createdAt: now,
      expiresAt: now + this.#sessionTtlMs,
      seenRequestIds: new Set(),
      projectDigest: projectDigest(pairing.project),
    };
    this.#sessionsByTokenHash.set(session.tokenHash, session);
    pairing.status = "approved";
    pairing.sessionToken = token;
    pairing.sessionExpiresAt = session.expiresAt;
  }

  pollPairing(
    origin: string,
    pairingIdInput: unknown,
  ):
    | { status: "pending" | "rejected" | "expired" }
    | { status: "approved"; sessionToken?: string; expiresAt: string } {
    const pairingId = BridgePairingIdSchema.parse(pairingIdInput);
    const pairing = this.#pairings.get(pairingId);
    if (!pairing || pairing.expiresAt <= this.#now()) {
      if (pairing) {
        pairing.sessionToken = null;
        this.#pairings.delete(pairingId);
      }
      return { status: "expired" };
    }
    if (pairing.origin !== origin) {
      throw new PitchFlowError(
        "BRIDGE_PAIRING_ORIGIN_REJECTED",
        "The pairing request belongs to a different browser origin.",
        403,
      );
    }
    if (pairing.status !== "approved") return { status: pairing.status };
    if (pairing.sessionTokenDelivered) {
      return pairing.sessionExpiresAt && pairing.sessionExpiresAt > this.#now()
        ? {
            status: "approved",
            expiresAt: new Date(pairing.sessionExpiresAt).toISOString(),
          }
        : { status: "expired" };
    }
    const sessionToken = pairing.sessionToken;
    pairing.sessionToken = null;
    const session = sessionToken ? this.#sessionsByTokenHash.get(digest(sessionToken)) : undefined;
    if (!session) return { status: "expired" };
    pairing.sessionTokenDelivered = true;
    return {
      status: "approved",
      sessionToken: sessionToken!,
      expiresAt: new Date(session.expiresAt).toISOString(),
    };
  }

  authenticate(input: {
    origin: string;
    authorization: string | null;
    requestId: string | null;
  }): AuthenticatedBridgeSession {
    this.cleanup();
    const token = bearerToken(input.authorization);
    const session = this.#sessionsByTokenHash.get(digest(token));
    if (!session || session.expiresAt <= this.#now()) {
      throw new PitchFlowError(
        "BRIDGE_SESSION_EXPIRED",
        "The PitchFlow companion session expired. Pair again locally.",
        401,
      );
    }
    if (session.origin !== input.origin) {
      throw new PitchFlowError(
        "BRIDGE_SESSION_ORIGIN_REJECTED",
        "The companion session belongs to a different browser origin.",
        403,
      );
    }
    const requestId = BridgeRequestIdSchema.parse(input.requestId);
    if (session.seenRequestIds.has(requestId)) {
      throw new PitchFlowError(
        "BRIDGE_REQUEST_REPLAYED",
        "PitchFlow rejected a replayed companion request.",
        409,
      );
    }
    if (session.seenRequestIds.size >= 4_096) {
      throw new PitchFlowError(
        "BRIDGE_SESSION_REQUEST_LIMIT",
        "The companion session reached its bounded request limit. Pair again locally.",
        429,
      );
    }
    session.seenRequestIds.add(requestId);
    return { id: session.id, origin: session.origin, expiresAt: session.expiresAt };
  }

  assertProject(sessionId: string, projectInput: unknown): BridgeProject {
    this.cleanup();
    const session = [...this.#sessionsByTokenHash.values()].find(
      (candidate) => candidate.id === sessionId,
    );
    if (!session || session.expiresAt <= this.#now()) {
      throw new PitchFlowError(
        "BRIDGE_SESSION_EXPIRED",
        "The PitchFlow companion session expired. Pair again locally.",
        401,
      );
    }
    const project = canonicalProject(projectInput);
    if (projectDigest(project) !== session.projectDigest) {
      throw new PitchFlowError(
        "BRIDGE_PROJECT_MISMATCH",
        "The job does not match the repository, direction, and captures approved locally.",
        409,
      );
    }
    return project;
  }
}
