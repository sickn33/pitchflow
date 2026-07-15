import {
  bridgeError,
  bridgeJson,
  bridgePreflight,
  bridgeRequestContext,
} from "../../../../lib/bridge-http";
import { detectProviderCapabilities } from "../../../../lib/provider-status";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let context;
  try {
    context = bridgeRequestContext(request);
    const providers = await detectProviderCapabilities();
    const codex = providers.find((provider) => provider.provider === "codex")!;
    return bridgeJson(context, {
      status: codex.status,
      provider: "codex",
      message: codex.message,
      engine: { status: codex.status, provider: "codex", message: codex.message },
      providers,
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
