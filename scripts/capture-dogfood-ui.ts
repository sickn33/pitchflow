import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";

import { CampaignManifestSchema, RepoSnapshotSchema } from "@pitchflow/core";
import { chromium, type Browser, type Page } from "@playwright/test";
import sharp from "sharp";

import { argumentValue, requiredArgument } from "./arguments";

const root = resolve(process.cwd());
const snapshotPath = resolve(requiredArgument("snapshot"));
const manifestPath = resolve(requiredArgument("manifest"));
const codexReportPath = resolve(requiredArgument("codex-report"));
const bundleDirectory = resolve(requiredArgument("bundle"));
const outputDirectory = resolve(requiredArgument("output"));
const port = Number(argumentValue("port") ?? "3220");

for (const path of [
  snapshotPath,
  manifestPath,
  codexReportPath,
  bundleDirectory,
  outputDirectory,
]) {
  if (!path.startsWith(`${root}${sep}`)) {
    throw new Error("Dogfood capture paths must remain inside the PitchFlow repository.");
  }
}
if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
  throw new Error("Dogfood capture --port must be an integer from 1024 through 65535.");
}

const browserCandidates = [
  process.env.PITCHFLOW_CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter((candidate): candidate is string => Boolean(candidate));
const executablePath = browserCandidates.find((candidate) => existsSync(candidate));
if (!executablePath) {
  throw new Error(
    "PitchFlow UI capture requires local Chrome, Edge, or Chromium. Set PITCHFLOW_CHROME_PATH when needed.",
  );
}

const snapshot = RepoSnapshotSchema.parse(JSON.parse(await readFile(snapshotPath, "utf8")));
const manifest = CampaignManifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));
const codexReport: unknown = JSON.parse(await readFile(codexReportPath, "utf8"));
if (
  typeof codexReport !== "object" ||
  codexReport === null ||
  !("codex" in codexReport) ||
  typeof codexReport.codex !== "object" ||
  codexReport.codex === null ||
  !("authenticated" in codexReport.codex) ||
  codexReport.codex.authenticated !== true ||
  !("method" in codexReport.codex) ||
  codexReport.codex.method !== "chatgpt" ||
  !("cliVersion" in codexReport.codex) ||
  typeof codexReport.codex.cliVersion !== "string" ||
  !("credentialValuesRead" in codexReport.codex) ||
  codexReport.codex.credentialValuesRead !== false
) {
  throw new Error("Dogfood capture requires a successful redacted local Codex auth report.");
}
const verifiedCodexStatus = {
  authenticated: true as const,
  method: "chatgpt" as const,
  cliVersion: codexReport.codex.cliVersion,
  credentialValuesRead: false as const,
};
const bundledManifest = CampaignManifestSchema.parse(
  JSON.parse(await readFile(join(bundleDirectory, "campaign-manifest.json"), "utf8")),
);
if (
  snapshot.repository.canonicalUrl !== manifest.source.repositoryUrl ||
  snapshot.commitSha !== manifest.source.commitSha
) {
  throw new Error("Dogfood snapshot and campaign manifest do not describe the same pinned source.");
}
if (bundledManifest.id !== manifest.id) {
  throw new Error("The verified export bundle does not belong to the captured campaign.");
}
const bundleIndex: unknown = JSON.parse(
  await readFile(join(bundleDirectory, "asset-index.json"), "utf8"),
);
if (
  typeof bundleIndex !== "object" ||
  bundleIndex === null ||
  !("assets" in bundleIndex) ||
  !Array.isArray(bundleIndex.assets) ||
  bundleIndex.assets.length === 0
) {
  throw new Error("The verified export bundle has no valid asset index.");
}
const bundleArchivePath = join(bundleDirectory, "pitchflow-campaign.zip");
const bundleArchive = await readFile(bundleArchivePath);
const bundleSha256 = createHash("sha256").update(bundleArchive).digest("hex");
const bundleAssetCount = bundleIndex.assets.length;

await mkdir(outputDirectory, { recursive: true });

function launchWorkspace(): ChildProcessWithoutNullStreams {
  return spawn("pnpm", ["pitchflow", "--no-open", "--port", String(port)], {
    cwd: root,
    env: {
      ...process.env,
      PITCHFLOW_PUBLIC_VIEWER: "0",
    },
    stdio: "pipe",
  });
}

async function waitForWorkspace(process: ChildProcessWithoutNullStreams): Promise<void> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (process.exitCode !== null) {
      throw new Error(`PitchFlow workspace exited before capture with code ${process.exitCode}.`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/status`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) return;
    } catch {
      // The local server is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error("Timed out waiting for the local PitchFlow workspace.");
}

async function stopWorkspace(process: ChildProcessWithoutNullStreams): Promise<void> {
  if (process.exitCode !== null) return;
  process.kill("SIGTERM");
  const gracefulExit = once(process, "exit");
  const timeout = new Promise<"timeout">((resolveTimeout) => {
    setTimeout(() => resolveTimeout("timeout"), 5_000).unref();
  });
  if ((await Promise.race([gracefulExit, timeout])) === "timeout" && process.exitCode === null) {
    process.kill("SIGKILL");
    await once(process, "exit");
  }
}

async function mockRealDogfoodArtifacts(page: Page): Promise<void> {
  await page.route("**/api/status", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        mode: "local",
        generationEnabled: true,
        codex: verifiedCodexStatus,
      }),
    });
  });
  await page.route("**/api/analyze", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ snapshot }),
    });
  });
  await page.route("**/api/generate", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ manifest }),
    });
  });
}

type CaptureDefinition = {
  filename: string;
  label: string;
  description: string;
  viewport: { width: number; height: number };
  panel: "evidence" | "preview" | "copy";
  sceneIndexes: number[];
};

const captureDefinitions: CaptureDefinition[] = [
  {
    filename: "01-pinned-evidence.png",
    label: "Pinned repository evidence",
    description:
      "PitchFlow evidence workspace showing the public repository, pinned commit, and bounded source records.",
    viewport: { width: 1600, height: 1000 },
    panel: "evidence",
    sceneIndexes: [1, 2, 3],
  },
  {
    filename: "02-campaign-preview.png",
    label: "Evidence-linked campaign preview",
    description:
      "PitchFlow campaign preview showing the GPT-5.6 Sol narrative and editable evidence-linked product claims.",
    viewport: { width: 1600, height: 1000 },
    panel: "preview",
    sceneIndexes: [1, 4],
  },
  {
    filename: "03-channel-copy.png",
    label: "Cross-channel launch copy",
    description:
      "PitchFlow copy workspace showing campaign language generated from the same commit-pinned manifest.",
    viewport: { width: 1600, height: 1000 },
    panel: "copy",
    sceneIndexes: [4],
  },
];

const handoffDefinition = {
  filename: "04-verified-export-handoff.png",
  label: "Verified campaign export handoff",
  description:
    "PitchFlow export receipt showing the microsite, social images, carousel, copy, both video masters, checksums, and ZIP.",
  viewport: { width: 1600, height: 1000 },
  sceneIndexes: [5],
};

async function sha256File(path: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

const workspace = launchWorkspace();
let browser: Browser | null = null;
try {
  await waitForWorkspace(workspace);
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({
    viewport: captureDefinitions[0]!.viewport,
    deviceScaleFactor: 1,
    colorScheme: "dark",
    reducedMotion: "no-preference",
    acceptDownloads: true,
  });
  const page = await context.newPage();
  await mockRealDogfoodArtifacts(page);
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
  await page.getByLabel("Canonical public GitHub URL").fill(snapshot.repository.canonicalUrl);
  await page.getByRole("button", { name: "Analyze repository" }).click();
  await page
    .getByText(
      `${snapshot.repository.owner}/${snapshot.repository.name} @ ${snapshot.commitSha.slice(0, 7)}`,
    )
    .waitFor();
  await page.getByRole("checkbox", { name: /Run GPT‑5\.6/i }).check();
  await page.getByRole("button", { name: "Generate launch system" }).click();
  await page.locator(".preview-hero h3").waitFor();

  const captures = [];
  for (const definition of captureDefinitions) {
    await page.setViewportSize(definition.viewport);
    await page.getByRole("tab", { name: definition.panel, exact: true }).click();
    await page.locator(".canvas").scrollIntoViewIfNeeded();
    await page.waitForTimeout(350);
    const path = join(outputDirectory, definition.filename);
    await page.screenshot({ path, fullPage: false, animations: "disabled" });
    const metadata = await sharp(path).metadata();
    if (
      metadata.width !== definition.viewport.width ||
      metadata.height !== definition.viewport.height
    ) {
      throw new Error(`${definition.filename} was not captured at its declared viewport size.`);
    }
    captures.push({
      path,
      filename: basename(path),
      label: definition.label,
      description: definition.description,
      provenance: "creator-owned" as const,
      sceneIndexes: definition.sceneIndexes,
      width: metadata.width,
      height: metadata.height,
      sha256: await sha256File(path),
    });
  }

  await page.locator("#product-captures").setInputFiles(captures.map((capture) => capture.path));
  await page
    .locator(".capture-list > li")
    .nth(captures.length - 1)
    .waitFor();
  const labels = page.getByLabel("Capture label");
  const descriptions = page.getByLabel("What this real screen shows");
  const provenance = page.getByLabel("Provenance");
  for (const [index, definition] of captureDefinitions.entries()) {
    await labels.nth(index).fill(definition.label);
    await descriptions.nth(index).fill(definition.description);
    await provenance.nth(index).selectOption("creator-owned");
  }
  await page.route("**/api/export", async (route) => {
    await route.fulfill({
      contentType: "application/zip",
      headers: {
        "content-disposition": `attachment; filename="pitchflow-${manifest.id}.zip"`,
        "x-pitchflow-assets": String(bundleAssetCount),
        "x-pitchflow-campaign": manifest.id,
        "x-pitchflow-sha256": bundleSha256,
      },
      body: Buffer.from("PK\u0005\u0006".padEnd(22, "\u0000"), "binary"),
    });
  });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export captured launch package" }).click();
  await downloadPromise;
  await page.getByRole("heading", { name: "Your launch package is ready." }).waitFor();
  await page.setViewportSize(handoffDefinition.viewport);
  await page.locator(".handoff-view").scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  const handoffPath = join(outputDirectory, handoffDefinition.filename);
  await page.screenshot({ path: handoffPath, fullPage: false, animations: "disabled" });
  const handoffMetadata = await sharp(handoffPath).metadata();
  if (
    handoffMetadata.width !== handoffDefinition.viewport.width ||
    handoffMetadata.height !== handoffDefinition.viewport.height
  ) {
    throw new Error(
      `${handoffDefinition.filename} was not captured at its declared viewport size.`,
    );
  }
  captures.push({
    path: handoffPath,
    filename: basename(handoffPath),
    label: handoffDefinition.label,
    description: handoffDefinition.description,
    provenance: "creator-owned" as const,
    sceneIndexes: handoffDefinition.sceneIndexes,
    width: handoffMetadata.width,
    height: handoffMetadata.height,
    sha256: await sha256File(handoffPath),
  });
  await context.close();

  const captureManifestPath = join(outputDirectory, "capture-manifest.json");
  await writeFile(
    captureManifestPath,
    `${JSON.stringify(
      {
        version: 1,
        capturedAt: new Date().toISOString(),
        captureMethod:
          "Actual local PitchFlow web workspace rendered in system Chromium with the verified Codex auth report, repository snapshot, GPT-5.6 Sol manifest, and checksum-valid prior export receipt injected through deterministic route fixtures.",
        repository: snapshot.repository.canonicalUrl,
        commitSha: snapshot.commitSha,
        campaignId: manifest.id,
        captures,
      },
      null,
      2,
    )}\n`,
    { flag: "wx" },
  );
  console.log(
    JSON.stringify(
      {
        status: "ok",
        repository: snapshot.repository.canonicalUrl,
        commitSha: snapshot.commitSha,
        campaignId: manifest.id,
        captureManifest: relative(root, captureManifestPath),
        captures: captures.map(({ path, ...capture }) => ({
          ...capture,
          path: relative(root, path),
        })),
        credentialValuesPrinted: false,
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await stopWorkspace(workspace);
}
