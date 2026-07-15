import { PitchFlowError } from "@pitchflow/core";
import { z } from "zod";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

function isSameLoopbackOrigin(origin: string, requestUrl: URL): boolean {
  try {
    const candidate = new URL(origin);
    return (
      LOOPBACK_HOSTS.has(candidate.hostname) &&
      candidate.protocol === requestUrl.protocol &&
      candidate.port === requestUrl.port &&
      candidate.username === "" &&
      candidate.password === ""
    );
  } catch {
    return false;
  }
}

export async function readTrustedLocalJson(
  request: Request,
  maximumBytes: number,
): Promise<unknown> {
  const url = new URL(request.url);
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    throw new PitchFlowError(
      "LOCAL_REQUEST_HOST_REJECTED",
      "PitchFlow local mutations only accept loopback requests.",
      403,
    );
  }
  const origin = request.headers.get("origin");
  // Next.js normalizes the bound 127.0.0.1 host to localhost in Request.url.
  // Treat loopback aliases on the same scheme and port as one local origin,
  // while continuing to reject every non-loopback or cross-port mutation.
  if (origin && origin !== url.origin && !isSameLoopbackOrigin(origin, url)) {
    throw new PitchFlowError(
      "LOCAL_REQUEST_ORIGIN_REJECTED",
      "PitchFlow rejected a cross-origin local mutation request.",
      403,
    );
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (contentType !== "application/json") {
    throw new PitchFlowError(
      "LOCAL_REQUEST_CONTENT_TYPE_REJECTED",
      "PitchFlow local mutations require application/json.",
      415,
    );
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new PitchFlowError(
      "LOCAL_REQUEST_TOO_LARGE",
      `PitchFlow local request exceeded the ${maximumBytes}-byte limit.`,
      413,
    );
  }
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > maximumBytes) {
    throw new PitchFlowError(
      "LOCAL_REQUEST_TOO_LARGE",
      `PitchFlow local request exceeded the ${maximumBytes}-byte limit.`,
      413,
    );
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new PitchFlowError(
      "LOCAL_REQUEST_INVALID_JSON",
      "PitchFlow local mutations require a valid JSON object.",
      400,
    );
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof PitchFlowError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  if (error instanceof z.ZodError) {
    return Response.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "The request did not match PitchFlow's schema.",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 400 },
    );
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("PitchFlow route failure", { message });
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "PitchFlow could not complete the request." } },
    { status: 500 },
  );
}
