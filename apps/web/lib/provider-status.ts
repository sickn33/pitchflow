import { constants } from "node:fs";
import { access, realpath, stat } from "node:fs/promises";
import { delimiter, isAbsolute, join } from "node:path";

import { inspectCodexAuth, type CodexAuthStatus } from "@pitchflow/codex";

import type { BridgeProviderCapability } from "./bridge-contract";

type ProviderDetectionOptions = {
  inspectCodex?: () => Promise<CodexAuthStatus>;
  detectClaude?: () => Promise<BridgeProviderCapability>;
};

export function codexCapability(status: CodexAuthStatus): BridgeProviderCapability {
  if (!status.cliVersion) {
    return {
      provider: "codex",
      status: "missing",
      message: "The project-local Codex runtime is unavailable.",
      selectable: false,
    };
  }
  if (!status.authenticated || status.method === "unknown") {
    return {
      provider: "codex",
      status: "authentication_required",
      message: "Sign in to Codex with your local ChatGPT entitlement.",
      selectable: false,
    };
  }
  if (status.method === "api-key") {
    return {
      provider: "codex",
      status: "authentication_required",
      message: "API-key billing is disabled. Sign in to Codex with ChatGPT instead.",
      selectable: false,
    };
  }
  return {
    provider: "codex",
    status: "connected",
    message: "Codex is authenticated locally through ChatGPT.",
    selectable: true,
  };
}

async function resolveClaudeExecutable(pathValue = process.env.PATH): Promise<string | null> {
  if (!pathValue) return null;
  for (const directory of pathValue.split(delimiter).filter(Boolean)) {
    if (!isAbsolute(directory)) continue;
    const candidate = join(directory, "claude");
    try {
      await access(candidate, constants.X_OK);
      const resolved = await realpath(candidate);
      if ((await stat(resolved)).isFile()) return resolved;
    } catch {
      // Continue through the existing PATH. PitchFlow never downloads a provider client.
    }
  }
  return null;
}

export async function detectClaudeCode(): Promise<BridgeProviderCapability> {
  const executable = await resolveClaudeExecutable();
  if (!executable) {
    return {
      provider: "claude-code",
      status: "missing",
      message: "Claude Code is not installed; the optional adapter is unavailable.",
      selectable: false,
    };
  }
  return {
    provider: "claude-code",
    status: "failed",
    message:
      "Claude Code is installed, but PitchFlow does not claim authentication or enable the optional adapter.",
    selectable: false,
  };
}

export async function detectProviderCapabilities(
  options: ProviderDetectionOptions = {},
): Promise<BridgeProviderCapability[]> {
  const inspect = options.inspectCodex ?? inspectCodexAuth;
  const detectClaude = options.detectClaude ?? detectClaudeCode;
  let codex: BridgeProviderCapability;
  try {
    codex = codexCapability(await inspect());
  } catch {
    codex = {
      provider: "codex",
      status: "failed",
      message: "Codex capability detection failed without reading credential values.",
      selectable: false,
    };
  }
  let claude: BridgeProviderCapability;
  try {
    claude = await detectClaude();
  } catch {
    claude = {
      provider: "claude-code",
      status: "failed",
      message: "Claude Code capability detection failed.",
      selectable: false,
    };
  }
  return [codex, claude];
}
