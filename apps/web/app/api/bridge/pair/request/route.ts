import { BridgePairRequestSchema } from "../../../../../lib/bridge-contract";
import {
  bridgeError,
  bridgeJson,
  bridgePreflight,
  bridgeRequestContext,
  readBridgeJson,
} from "../../../../../lib/bridge-http";
import { bridgeSecurity } from "../../../../../lib/bridge-state";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let context;
  try {
    context = bridgeRequestContext(request);
    const input = BridgePairRequestSchema.parse(await readBridgeJson(request, 34 * 1024 * 1024));
    return bridgeJson(context, bridgeSecurity.requestPairing(context.origin, input.project), {
      status: 201,
    });
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
