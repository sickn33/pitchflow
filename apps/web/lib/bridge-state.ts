import { BridgeJobManager } from "./bridge-jobs";
import { BridgeSecurityStore } from "./bridge-security";

declare global {
  var __pitchflowBridgeSecurity: BridgeSecurityStore | undefined;
  var __pitchflowBridgeJobs: BridgeJobManager | undefined;
}

export const bridgeSecurity =
  globalThis.__pitchflowBridgeSecurity ??
  (globalThis.__pitchflowBridgeSecurity = new BridgeSecurityStore());

export const bridgeJobs =
  globalThis.__pitchflowBridgeJobs ?? (globalThis.__pitchflowBridgeJobs = new BridgeJobManager());
