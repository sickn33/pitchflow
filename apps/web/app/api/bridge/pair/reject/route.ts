import {
  BridgePairDecisionSchema,
  BridgeRequestIdSchema,
} from "../../../../../lib/bridge-contract";
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
    context = bridgeRequestContext(request, { localOnly: true });
    BridgeRequestIdSchema.parse(request.headers.get("x-pitchflow-request-id"));
    bridgeSecurity.consumeLocalApprovalToken(request.headers.get("x-pitchflow-local-approval"));
    const input = BridgePairDecisionSchema.parse(await readBridgeJson(request, 2_048));
    bridgeSecurity.decidePairing(input.pairingId, "reject");
    return bridgeJson(context, { status: "rejected" });
  } catch (error) {
    return bridgeError(error, context);
  }
}

export function OPTIONS(request: Request) {
  try {
    return bridgePreflight(request, { localOnly: true });
  } catch (error) {
    return bridgeError(error);
  }
}
