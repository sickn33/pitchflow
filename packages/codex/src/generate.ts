import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Codex, type ThreadItem, type Usage } from "@openai/codex-sdk";
import {
  CampaignDraftSchema,
  CampaignPreferencesSchema,
  PITCHFLOW_PROMPT_VERSION,
  RepoSnapshotSchema,
  auditSnapshotIntegrity,
  finalizeCampaignManifest,
  type CampaignDraft,
  type CampaignManifest,
  type CampaignPreferences,
  type RepoSnapshot,
} from "@pitchflow/core";
import { z } from "zod";

import { buildCodexEnvironment } from "./environment";
import { resolveProjectCodexCli } from "./auth";
import { buildCreativeDirectorPrompt } from "./prompt";

export { buildCodexEnvironment } from "./environment";

export const PITCHFLOW_REQUIRED_MODEL = "gpt-5.6-sol" as const;

export type StructuredRunResult = {
  response: string;
  threadId: string | null;
  usage: Usage | null;
  items: ThreadItem[];
};

export type StructuredRunner = (input: {
  prompt: string;
  outputSchema: unknown;
  signal: AbortSignal;
  repairMessage?: string;
}) => Promise<StructuredRunResult>;

export type GenerateCampaignOptions = {
  model?: string;
  workingDirectory: string;
  timeoutMs?: number;
  runner?: StructuredRunner;
  generatedAt?: string;
  version?: number;
  signal?: AbortSignal;
};

export class CodexGenerationError extends Error {
  readonly code:
    | "AUTH_REQUIRED"
    | "INVALID_EVIDENCE"
    | "INVALID_MODEL"
    | "TOOL_ACTIVITY"
    | "INVALID_OUTPUT"
    | "RUNTIME_ERROR"
    | "TIMEOUT";

  constructor(code: CodexGenerationError["code"], message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CodexGenerationError";
    this.code = code;
  }
}

function normalizeUsage(usage: Usage | null): CampaignManifest["generation"]["usage"] {
  if (!usage) return null;
  return {
    inputTokens: usage.input_tokens,
    cachedInputTokens: usage.cached_input_tokens,
    outputTokens: usage.output_tokens,
    reasoningOutputTokens: usage.reasoning_output_tokens,
  };
}

function mergeUsage(left: Usage | null, right: Usage | null): Usage | null {
  if (!left) return right;
  if (!right) return left;
  return {
    input_tokens: left.input_tokens + right.input_tokens,
    cached_input_tokens: left.cached_input_tokens + right.cached_input_tokens,
    output_tokens: left.output_tokens + right.output_tokens,
    reasoning_output_tokens: left.reasoning_output_tokens + right.reasoning_output_tokens,
  };
}

function assertNoToolActivity(items: ThreadItem[]): void {
  const forbidden = items.filter((item) =>
    ["command_execution", "file_change", "mcp_tool_call", "web_search"].includes(item.type),
  );
  if (forbidden.length > 0) {
    throw new CodexGenerationError(
      "TOOL_ACTIVITY",
      `The creative-director run attempted disallowed tool activity: ${forbidden.map((item) => item.type).join(", ")}.`,
    );
  }
}

function parseDraft(response: string): CampaignDraft {
  let parsed: unknown;
  try {
    parsed = JSON.parse(response);
  } catch (error) {
    throw new CodexGenerationError("INVALID_OUTPUT", "GPT-5.6 returned non-JSON output.", {
      cause: error,
    });
  }
  const result = CampaignDraftSchema.safeParse(parsed);
  if (!result.success) {
    throw new CodexGenerationError(
      "INVALID_OUTPUT",
      `GPT-5.6 output failed schema validation: ${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

function createSdkRunner(model: string, workingDirectory: string): StructuredRunner {
  const codex = new Codex({
    codexPathOverride: resolveProjectCodexCli(),
    env: buildCodexEnvironment(),
  });
  const thread = codex.startThread({
    model,
    modelReasoningEffort: "high",
    workingDirectory,
    skipGitRepoCheck: true,
    sandboxMode: "read-only",
    approvalPolicy: "never",
    networkAccessEnabled: false,
    webSearchMode: "disabled",
  });

  return async ({ prompt, outputSchema, signal, repairMessage }) => {
    const result = await thread.run(repairMessage ? `${repairMessage}\n\n${prompt}` : prompt, {
      outputSchema,
      signal,
    });
    return {
      response: result.finalResponse,
      threadId: thread.id,
      usage: result.usage,
      items: result.items,
    };
  };
}

export async function generateCampaignWithCodex(
  snapshotInput: RepoSnapshot,
  preferencesInput: CampaignPreferences,
  options: GenerateCampaignOptions,
): Promise<CampaignManifest> {
  const snapshot = RepoSnapshotSchema.parse(snapshotInput);
  const preferences = CampaignPreferencesSchema.parse(preferencesInput);
  const snapshotIntegrity = auditSnapshotIntegrity(snapshot);
  if (!snapshotIntegrity.valid) {
    throw new CodexGenerationError(
      "INVALID_EVIDENCE",
      `Repository evidence integrity failed before generation: ${snapshotIntegrity.errors[0]}`,
    );
  }
  const model = options.model ?? process.env.PITCHFLOW_CODEX_MODEL ?? PITCHFLOW_REQUIRED_MODEL;
  if (model !== PITCHFLOW_REQUIRED_MODEL) {
    throw new CodexGenerationError(
      "INVALID_MODEL",
      `PitchFlow's Build Week path is pinned to ${PITCHFLOW_REQUIRED_MODEL}; received ${model}.`,
    );
  }

  const isolatedDirectory = options.runner
    ? null
    : await mkdtemp(join(tmpdir(), "pitchflow-codex-"));
  try {
    const runner = options.runner ?? createSdkRunner(model, isolatedDirectory!);
    const prompt = buildCreativeDirectorPrompt(snapshot, preferences);
    const outputSchema = z.toJSONSchema(CampaignDraftSchema);
    const timeoutSignal = AbortSignal.timeout(options.timeoutMs ?? 240_000);
    const signal = options.signal
      ? AbortSignal.any([timeoutSignal, options.signal])
      : timeoutSignal;
    let repairAttempts = 0;
    let totalUsage: Usage | null = null;
    let threadId: string | null = null;
    let latestError: CodexGenerationError | null = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const run = await runner({
          prompt,
          outputSchema,
          signal,
          ...(latestError
            ? {
                repairMessage: `Your prior response was rejected. Repair it without changing evidence IDs. Validation error: ${latestError.message}`,
              }
            : {}),
        });
        threadId = run.threadId;
        totalUsage = mergeUsage(totalUsage, run.usage);
        assertNoToolActivity(run.items);
        const draft = parseDraft(run.response);
        return finalizeCampaignManifest(
          draft,
          snapshot,
          {
            provider: "codex-sdk",
            model,
            promptVersion: PITCHFLOW_PROMPT_VERSION,
            generatedAt: options.generatedAt ?? new Date().toISOString(),
            threadId,
            repairAttempts,
            usage: normalizeUsage(totalUsage),
          },
          options.version ?? 1,
        );
      } catch (error) {
        if (error instanceof CodexGenerationError && error.code === "TOOL_ACTIVITY") throw error;
        if (signal.aborted) {
          throw new CodexGenerationError(
            "TIMEOUT",
            "The local Codex generation timed out safely.",
            { cause: error },
          );
        }
        if (!(error instanceof CodexGenerationError)) {
          throw new CodexGenerationError(
            "RUNTIME_ERROR",
            "The local Codex runtime failed before valid output was returned.",
            { cause: error },
          );
        }
        if (error.code !== "INVALID_OUTPUT") throw error;
        latestError = error;
        repairAttempts += 1;
      }
    }

    throw new CodexGenerationError(
      "INVALID_OUTPUT",
      `GPT-5.6 failed validation after one repair attempt: ${latestError?.message ?? "unknown error"}`,
      { cause: latestError ?? undefined },
    );
  } finally {
    if (isolatedDirectory) await rm(isolatedDirectory, { recursive: true, force: true });
  }
}
