import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { sha256 } from "@pitchflow/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BridgeJobInput, BridgeJobResult } from "./bridge-contract";
import { BridgeJobManager, type BridgeJobRunner } from "./bridge-jobs";
import { parseDogfoodPackage } from "./dogfood";

const roots: string[] = [];

function input(): BridgeJobInput {
  const capture = (order: number) => ({
    id: `capture-${order + 1}`,
    order,
    fileName: `capture-${order + 1}.png`,
    label: `Product view ${order + 1}`,
    description: `Creator-owned product interface view ${order + 1}.`,
    provenance: "creator-owned" as const,
    mediaType: "image/png" as const,
    dataUrl: `data:image/png;base64,${Buffer.alloc(24, order + 1).toString("base64")}`,
  });
  return {
    repositoryUrl: "https://github.com/acme/demo",
    preferences: {
      audience: "Developers",
      positioning: "A useful developer utility",
      visualDirection: "Dark editorial interface",
      tone: "precise",
      channels: ["x", "linkedin"],
    },
    captures: [capture(0), capture(1)],
    provider: "codex",
  };
}

function result(filename = "site/index.html", data = Buffer.from("<h1>Demo</h1>")) {
  const dogfood = parseDogfoodPackage(
    JSON.parse(
      readFileSync(
        resolve(process.cwd(), "public/dogfood/pitchflow/v1/judge-package.json"),
        "utf8",
      ),
    ) as unknown,
  );
  const snapshot = dogfood.snapshot;
  const campaign = dogfood.campaign;
  const bridgeResult: BridgeJobResult = {
    snapshot,
    campaign,
    assets: [
      {
        id: "asset_aaaaaaaaaaaa",
        kind: filename.endsWith(".zip") ? "archive" : "microsite",
        filename,
        mediaType: filename.endsWith(".zip") ? "application/zip" : "text/html",
        width: null,
        height: null,
        bytes: data.byteLength,
        sha256: sha256(data),
        provenance: "pitchflow-generated",
        intendedChannel: "Test result",
      },
    ],
    packageFilename: "pitchflow-campaign.zip",
  };
  return { bridgeResult, data };
}

async function waitForStatus(
  manager: BridgeJobManager,
  owner: string,
  jobId: string,
  expected: "completed" | "failed" | "cancelled",
) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const job = await manager.status(owner, jobId);
    if (job.status === expected) return job;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error(`Job did not reach ${expected}.`);
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  delete process.env.PITCHFLOW_REPOSITORY_ROOT;
});

describe("BridgeJobManager", () => {
  it("reports real runner progress and a completed result", async () => {
    const output = result();
    const runner: BridgeJobRunner = async (_input, context) => {
      context.progress("fetching_evidence", 0.1, "Fetching evidence");
      context.progress("creative_direction", 0.3, "Directing campaign");
      return {
        result: output.bridgeResult,
        outputDirectory: "/tmp/fake-output",
        allowedAssetPaths: new Set(["site/index.html"]),
      };
    };
    const manager = new BridgeJobManager({ runner });
    const queued = await manager.start(
      { id: "session-a", expiresAt: Date.now() + 60_000 },
      input(),
    );
    const completed = await waitForStatus(manager, "session-a", queued.id, "completed");
    expect(completed).toMatchObject({
      status: "completed",
      stage: "complete",
      progress: 100,
      result: { campaign: { id: output.bridgeResult.campaign.id } },
    });
  });

  it("allows only one active job per session", async () => {
    const runner: BridgeJobRunner = async (_input, context) => {
      await new Promise((_resolve, reject) => {
        context.signal.addEventListener("abort", () => reject(new Error("cancelled")), {
          once: true,
        });
      });
      throw new Error("unreachable");
    };
    const manager = new BridgeJobManager({ runner });
    const owner = { id: "session-a", expiresAt: Date.now() + 60_000 };
    const first = await manager.start(owner, input());
    await expect(manager.start(owner, input())).rejects.toThrow(/already has an active/i);
    await manager.cancel(owner.id, first.id);
    await waitForStatus(manager, owner.id, first.id, "cancelled");
  });

  it("propagates cancellation and creates a new isolated job on retry", async () => {
    const output = result();
    let runCount = 0;
    const runner: BridgeJobRunner = async (_input, context) => {
      runCount += 1;
      if (runCount === 1) {
        await new Promise((_resolve, reject) => {
          context.signal.addEventListener("abort", () => reject(new Error("cancelled")), {
            once: true,
          });
        });
      }
      return {
        result: output.bridgeResult,
        outputDirectory: "/tmp/fake-output",
        allowedAssetPaths: new Set(["site/index.html"]),
      };
    };
    const manager = new BridgeJobManager({ runner });
    const owner = { id: "session-a", expiresAt: Date.now() + 60_000 };
    const first = await manager.start(owner, input());
    await manager.cancel(owner.id, first.id);
    await waitForStatus(manager, owner.id, first.id, "cancelled");
    const retry = await manager.retry(owner, first.id);
    expect(retry.id).not.toBe(first.id);
    await waitForStatus(manager, owner.id, retry.id, "completed");
  });

  it("isolates job status and errors without leaking raw provider diagnostics", async () => {
    const runner = vi.fn(async () => {
      throw new Error("provider-secret-sentinel");
    });
    const manager = new BridgeJobManager({ runner });
    const job = await manager.start({ id: "session-a", expiresAt: Date.now() + 60_000 }, input());
    const failed = await waitForStatus(manager, "session-a", job.id, "failed");
    expect(JSON.stringify(failed)).not.toContain("provider-secret-sentinel");
    await expect(manager.status("session-b", job.id)).rejects.toThrow(/not found/i);
  });

  it("authorizes only indexed regular assets owned by the session", async () => {
    const root = await mkdtemp(join(tmpdir(), "pitchflow-bridge-test-"));
    roots.push(root);
    process.env.PITCHFLOW_REPOSITORY_ROOT = root;
    const output = result();
    const runner: BridgeJobRunner = async (_input, context) => {
      const directory = join(root, "artifacts", "exports", ".bridge-jobs", context.jobId, "output");
      await mkdir(join(directory, "site"), { recursive: true });
      await writeFile(join(directory, "site/index.html"), output.data);
      return {
        result: output.bridgeResult,
        outputDirectory: directory,
        allowedAssetPaths: new Set(["site/index.html"]),
      };
    };
    const manager = new BridgeJobManager({ runner });
    const job = await manager.start({ id: "session-a", expiresAt: Date.now() + 60_000 }, input());
    await waitForStatus(manager, "session-a", job.id, "completed");
    expect((await manager.readAsset("session-a", job.id, "site/index.html")).data).toEqual(
      output.data,
    );
    await expect(manager.readAsset("session-b", job.id, "site/index.html")).rejects.toThrow(
      /not found/i,
    );
    await expect(manager.readAsset("session-a", job.id, "../secret")).rejects.toThrow();
    await expect(manager.readAsset("session-a", job.id, "site/missing.html")).rejects.toThrow(
      /not found/i,
    );
  });
});
