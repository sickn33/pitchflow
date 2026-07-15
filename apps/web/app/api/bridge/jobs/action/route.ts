import { BridgeJobActionSchema } from "../../../../../lib/bridge-contract";
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
    const input = BridgeJobActionSchema.parse(await readBridgeJson(request, 2_048));
    const job =
      input.action === "cancel"
        ? await bridgeJobs.cancel(session.id, input.jobId)
        : await bridgeJobs.retry(session, input.jobId);
    return bridgeJson(context, { jobId: job.id });
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
