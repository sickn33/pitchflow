import { BridgeJobStatusRequestSchema } from "../../../../../lib/bridge-contract";
import {
  bridgeError,
  bridgeJson,
  bridgePreflight,
  bridgeRequestContext,
  readBridgeJson,
} from "../../../../../lib/bridge-http";
import { bridgeJobs, bridgeSecurity } from "../../../../../lib/bridge-state";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let context;
  try {
    context = bridgeRequestContext(request);
    const session = bridgeSecurity.authenticate({
      origin: context.origin,
      authorization: request.headers.get("authorization"),
      requestId: request.headers.get("x-pitchflow-request-id"),
    });
    const input = BridgeJobStatusRequestSchema.parse(await readBridgeJson(request, 2_048));
    return bridgeJson(context, { job: await bridgeJobs.status(session.id, input.jobId) });
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
