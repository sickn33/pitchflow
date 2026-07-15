import {
  bridgeError,
  bridgeJson,
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
    const input = await readBridgeJson(request, 34 * 1024 * 1024);
    const approvedInput = bridgeSecurity.assertProject(session.id, input);
    const job = await bridgeJobs.start(session, approvedInput);
    return bridgeJson(context, { jobId: job.id }, { status: 202 });
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
