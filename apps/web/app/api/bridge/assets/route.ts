import { BridgeAssetRequestSchema } from "../../../../lib/bridge-contract";
import {
  bridgeCorsHeaders,
  bridgeError,
  bridgePreflight,
  bridgeRequestContext,
  readBridgeJson,
} from "../../../../lib/bridge-http";
import { bridgeJobs, bridgeSecurity } from "../../../../lib/bridge-state";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  let context;
  try {
    context = bridgeRequestContext(request);
    const session = bridgeSecurity.authenticate({
      origin: context.origin,
      authorization: request.headers.get("authorization"),
      requestId: request.headers.get("x-pitchflow-request-id"),
    });
    const input = BridgeAssetRequestSchema.parse(await readBridgeJson(request, 4_096));
    const { data, asset } = await bridgeJobs.readAsset(session.id, input.jobId, input.path);
    const headers = bridgeCorsHeaders(context);
    headers.set("content-type", asset.mediaType);
    headers.set("content-length", String(data.byteLength));
    headers.set("x-pitchflow-sha256", asset.sha256);
    headers.set(
      "content-disposition",
      `${asset.kind === "archive" ? "attachment" : "inline"}; filename="${asset.filename.split("/").at(-1)}"`,
    );
    return new Response(new Uint8Array(data), { status: 200, headers });
  } catch (error) {
    return bridgeError(error, context);
  }
}

export function OPTIONS(request: Request) {
  try {
    return bridgePreflight(request);
  } catch (error) {
    return bridgeError(error);
  }
}
