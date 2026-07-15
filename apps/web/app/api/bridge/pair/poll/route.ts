import { BridgePairPollSchema } from "../../../../../lib/bridge-contract";
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
    const input = BridgePairPollSchema.parse(await readBridgeJson(request, 2_048));
    return bridgeJson(context, bridgeSecurity.pollPairing(context.origin, input.pairingId));
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
