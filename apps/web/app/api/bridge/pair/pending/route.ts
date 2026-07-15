import {
  bridgeError,
  bridgeJson,
  bridgePreflight,
  bridgeRequestContext,
} from "../../../../../lib/bridge-http";
import { bridgeSecurity } from "../../../../../lib/bridge-state";

export const runtime = "nodejs";

export function GET(request: Request) {
  let context;
  try {
    context = bridgeRequestContext(request, { localOnly: true });
    const pairings = bridgeSecurity.pendingPairings();
    return bridgeJson(context, {
      pairings,
      approvalToken: bridgeSecurity.issueLocalApprovalToken(),
    });
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
