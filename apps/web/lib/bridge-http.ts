import { PitchFlowError } from "@pitchflow/core";
import { z } from "zod";

import { BRIDGE_DEFAULT_PORT, BRIDGE_PUBLIC_ORIGIN } from "./bridge-contract";
import { errorResponse } from "./http";
import { isPublicViewer } from "./runtime";

const ALLOWED_HEADERS = new Set(["authorization", "content-type", "x-pitchflow-request-id"]);

function exactHttpOrigin(value: string, label: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PitchFlowError(
      "BRIDGE_ORIGIN_CONFIGURATION_INVALID",
      `${label} must be one exact HTTP(S) origin.`,
      500,
    );
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new PitchFlowError(
      "BRIDGE_ORIGIN_CONFIGURATION_INVALID",
      `${label} must be one exact credential-free HTTP(S) origin without a path.`,
      500,
    );
  }
  const loopbackHttp =
    url.protocol === "http:" &&
    (url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]");
  if (url.protocol !== "https:" && !loopbackHttp) {
    throw new PitchFlowError(
      "BRIDGE_ORIGIN_CONFIGURATION_INVALID",
      `${label} must use HTTPS unless it is an explicit loopback development origin.`,
      500,
    );
  }
  return url.origin;
}

export function bridgeOrigins(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  const rawPort = environment.PITCHFLOW_PORT ?? String(BRIDGE_DEFAULT_PORT);
  if (!/^\d{4,5}$/.test(rawPort)) {
    throw new PitchFlowError(
      "BRIDGE_PORT_CONFIGURATION_INVALID",
      "PITCHFLOW_PORT must be an integer between 1024 and 65535.",
      500,
    );
  }
  const port = Number(rawPort);
  if (port < 1024 || port > 65_535) {
    throw new PitchFlowError(
      "BRIDGE_PORT_CONFIGURATION_INVALID",
      "PITCHFLOW_PORT must be an integer between 1024 and 65535.",
      500,
    );
  }
  const localOrigin = `http://127.0.0.1:${port}`;
  const publicOrigin = exactHttpOrigin(
    environment.PITCHFLOW_ALLOWED_ORIGINS ?? BRIDGE_PUBLIC_ORIGIN,
    "PITCHFLOW_ALLOWED_ORIGINS",
  );
  if (publicOrigin === localOrigin) {
    throw new PitchFlowError(
      "BRIDGE_ORIGIN_CONFIGURATION_INVALID",
      "The public and local companion origins must be distinct.",
      500,
    );
  }
  return { port, localOrigin, publicOrigin };
}

export type BridgeRequestContext = {
  origin: string;
  localOrigin: string;
  publicOrigin: string;
  isLocal: boolean;
};

export function bridgeRequestContext(
  request: Request,
  options: { localOnly?: boolean } = {},
): BridgeRequestContext {
  if (isPublicViewer()) {
    throw new PitchFlowError(
      "BRIDGE_LOCAL_RUNTIME_REQUIRED",
      "The companion bridge exists only on the user's loopback runtime.",
      403,
    );
  }
  const { port, localOrigin, publicOrigin } = bridgeOrigins();
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (
    url.protocol !== "http:" ||
    (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") ||
    url.port !== String(port) ||
    host !== `127.0.0.1:${port}`
  ) {
    throw new PitchFlowError(
      "BRIDGE_LOOPBACK_HOST_REJECTED",
      "The companion accepts only its exact 127.0.0.1 host and port.",
      403,
    );
  }
  const headerOrigin = request.headers.get("origin");
  const inferredSameOrigin =
    !headerOrigin && request.headers.get("sec-fetch-site") === "same-origin" ? localOrigin : null;
  const origin = headerOrigin ?? inferredSameOrigin;
  if (!origin || (origin !== localOrigin && origin !== publicOrigin)) {
    throw new PitchFlowError(
      "BRIDGE_ORIGIN_REJECTED",
      "The companion rejected a request from an unapproved browser origin.",
      403,
    );
  }
  if (options.localOnly && origin !== localOrigin) {
    throw new PitchFlowError(
      "BRIDGE_LOCAL_APPROVAL_REQUIRED",
      "This companion action requires the local PitchFlow workspace.",
      403,
    );
  }
  return { origin, localOrigin, publicOrigin, isLocal: origin === localOrigin };
}

export function bridgeCorsHeaders(context: BridgeRequestContext): Headers {
  const headers = new Headers({
    "access-control-allow-origin": context.origin,
    "cache-control": "no-store",
    vary: "Origin",
  });
  return headers;
}

export function bridgeJson(
  context: BridgeRequestContext,
  body: unknown,
  init: ResponseInit = {},
): Response {
  const headers = bridgeCorsHeaders(context);
  for (const [name, value] of new Headers(init.headers)) headers.set(name, value);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export async function readBridgeJson(request: Request, maximumBytes: number): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (contentType !== "application/json") {
    throw new PitchFlowError(
      "BRIDGE_CONTENT_TYPE_REJECTED",
      "PitchFlow companion requests require application/json.",
      415,
    );
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new PitchFlowError(
      "BRIDGE_REQUEST_TOO_LARGE",
      `The companion request exceeded the ${maximumBytes}-byte limit.`,
      413,
    );
  }
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  const reader = request.body?.getReader();
  if (reader) {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > maximumBytes) {
        await reader.cancel();
        throw new PitchFlowError(
          "BRIDGE_REQUEST_TOO_LARGE",
          `The companion request exceeded the ${maximumBytes}-byte limit.`,
          413,
        );
      }
      chunks.push(next.value);
    }
  }
  const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new PitchFlowError(
      "BRIDGE_INVALID_JSON",
      "PitchFlow companion requests require a valid JSON object.",
      400,
    );
  }
}

export function bridgeError(error: unknown, context?: BridgeRequestContext): Response {
  const response =
    error instanceof PitchFlowError || error instanceof z.ZodError
      ? errorResponse(error)
      : Response.json(
          {
            error: {
              code: "BRIDGE_INTERNAL_ERROR",
              message: "The local companion could not complete the request.",
            },
          },
          { status: 500 },
        );
  if (!context) return response;
  const headers = new Headers(response.headers);
  for (const [name, value] of bridgeCorsHeaders(context)) headers.set(name, value);
  return new Response(response.body, { status: response.status, headers });
}

export function bridgePreflight(request: Request, options: { localOnly?: boolean } = {}): Response {
  const context = bridgeRequestContext(request, options);
  const requestedMethod = request.headers.get("access-control-request-method");
  if (requestedMethod !== "GET" && requestedMethod !== "POST") {
    throw new PitchFlowError(
      "BRIDGE_PREFLIGHT_METHOD_REJECTED",
      "The companion preflight requested an unsupported method.",
      405,
    );
  }
  const requestedHeaders = (request.headers.get("access-control-request-headers") ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (requestedHeaders.some((header) => !ALLOWED_HEADERS.has(header))) {
    throw new PitchFlowError(
      "BRIDGE_PREFLIGHT_HEADERS_REJECTED",
      "The companion preflight requested unsupported headers.",
      403,
    );
  }
  const headers = bridgeCorsHeaders(context);
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set(
    "access-control-allow-headers",
    "authorization, content-type, x-pitchflow-request-id",
  );
  headers.set("access-control-max-age", "600");
  if (request.headers.get("access-control-request-private-network") === "true") {
    headers.set("access-control-allow-private-network", "true");
  }
  return new Response(null, { status: 204, headers });
}
