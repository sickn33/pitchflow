import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  PITCHFLOW_PROMPT_VERSION,
  createDeterministicCampaignDraft,
  finalizeCampaignManifest,
} from "@pitchflow/core";

import { createTestSnapshot } from "../helpers/snapshot";

function campaignFixture() {
  const snapshot = createTestSnapshot();
  const manifest = finalizeCampaignManifest(createDeterministicCampaignDraft(snapshot), snapshot, {
    provider: "deterministic-fixture",
    model: "fixture-e2e",
    promptVersion: PITCHFLOW_PROMPT_VERSION,
    generatedAt: "2026-07-15T06:00:00.000Z",
    threadId: null,
    repairAttempts: 0,
    usage: null,
  });
  return { manifest, snapshot };
}

const productHero = "Paste your repo. Get a launch-ready site, social kit, and product video.";
const workflowSteps = ["Analyze", "Direct", "Generate", "Deliver", "Export"];
const workflowMarkers = [
  "01 · Analyze",
  "02 · Direct",
  "03 · Generate",
  "04 · Deliver",
  "05 · Export",
];

async function expectViewport(page: Page, width: number, height: number) {
  expect(page.viewportSize()).toEqual({ width, height });
  await expect
    .poll(() => page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })))
    .toEqual({ width, height });
}

async function expectProductJourney(page: Page) {
  await expect(
    page.getByRole("navigation", { name: "PitchFlow workflow" }).locator("li strong"),
  ).toHaveText(workflowSteps);
  const markers = page.locator(".step-heading > span, .export-copy > span");
  await expect(markers).toHaveText(workflowMarkers);
  const tops = await markers.evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().top + window.scrollY),
  );
  expect(tops).toEqual([...tops].sort((left, right) => left - right));
}

async function mockLocalRuntime(page: Page) {
  await page.route("**/api/status", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        mode: "local",
        generationEnabled: true,
        codex: {
          authenticated: true,
          method: "chatgpt",
          cliVersion: "0.144.4",
          credentialValuesRead: false,
        },
      }),
    });
  });
}

test("completes the local Analyze, Direct, Generate, Deliver, and Export journey", async ({
  page,
}, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  const { snapshot, manifest } = campaignFixture();
  await mockLocalRuntime(page);
  await page.route("**/api/analyze", async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      repositoryUrl: "https://github.com/acme/demo",
    });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ snapshot }),
    });
  });
  await page.route("**/api/generate", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    expect(body.snapshot).toMatchObject({ id: snapshot.id, commitSha: snapshot.commitSha });
    expect(body.preferences).toMatchObject({
      visualDirection: "Editorial product clarity with confident motion and high-contrast type",
    });
    expect(JSON.stringify(body)).not.toContain("data:image/");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ manifest }),
    });
  });

  const exportRequests: Record<string, unknown>[] = [];
  await page.route("**/api/export", async (route) => {
    exportRequests.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      contentType: "application/zip",
      headers: {
        "content-disposition": 'attachment; filename="pitchflow-e2e.zip"',
        "x-pitchflow-assets": "23",
        "x-pitchflow-sha256": "a".repeat(64),
      },
      body: Buffer.from("PK\u0005\u0006".padEnd(22, "\u0000"), "binary"),
    });
  });

  await page.goto("/");
  await expectViewport(page, 1440, 1000);
  await expect(page.getByRole("heading", { name: productHero, exact: true })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "PitchFlow workflow" }).locator("li strong"),
  ).toHaveText(workflowSteps);

  await page.getByLabel("Public GitHub repository").fill("https://github.com/acme/demo");
  await page.getByRole("button", { name: "Analyze repository" }).click();
  await expect(
    page.getByRole("heading", { name: "Here’s what PitchFlow understood." }),
  ).toBeVisible();
  await expect(page.getByText("Codex is ready for local generation.")).toBeVisible();
  await expect(
    page.locator(".understanding-grid").getByText("demo", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("3 files mapped")).toBeVisible();

  const generateButton = page.getByRole("button", { name: "Generate campaign" });
  await expect(generateButton).toBeDisabled();

  const captureDirectory = join(testInfo.outputDir, "real-ui-captures");
  await mkdir(captureDirectory, { recursive: true });
  const analysisPath = join(captureDirectory, "pitchflow-analysis.png");
  await page.screenshot({ path: analysisPath, fullPage: false });
  await page.locator("#direct").scrollIntoViewIfNeeded();
  const directionPath = join(captureDirectory, "pitchflow-direction.png");
  await page.screenshot({ path: directionPath, fullPage: false });

  await page.locator("#product-captures").setInputFiles([analysisPath, directionPath]);
  const descriptions = page.getByLabel("What this real screen shows");
  await expect(descriptions).toHaveCount(2);
  await descriptions
    .nth(0)
    .fill("PitchFlow repository analysis with commit-pinned product understanding.");
  await descriptions
    .nth(1)
    .fill("PitchFlow launch direction controls and real product capture inputs.");
  const provenance = page.getByLabel("Provenance");
  await provenance.nth(0).selectOption("creator-owned");
  await provenance.nth(1).selectOption("creator-owned");

  await page.getByRole("checkbox", { name: /Use my local Codex sign-in/i }).check();
  await expect(generateButton).toBeEnabled();
  await generateButton.click();

  await expect(
    page.getByRole("heading", { name: "Review the campaign plan before rendering." }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Website and copy are editable now. Images are creative previews and videos are storyboards until export.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "Website" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#campaign-panel-website h3")).toHaveText(
    manifest.productBrief.oneLiner,
  );

  await page.getByRole("tab", { name: "Images" }).click();
  await expect(page.getByText(/Creative previews only.*local image renderer/i)).toBeVisible();
  await expect(page.locator("#campaign-panel-images img")).toHaveCount(0);

  await page.getByRole("tab", { name: "Videos" }).click();
  await expect(page.getByText(/Storyboard only.*render during export/i)).toBeVisible();
  await expect(page.locator("#campaign-panel-videos video")).toHaveCount(0);

  await page.getByRole("tab", { name: "Copy" }).click();
  await page.getByLabel("X copy").fill("Reviewed launch copy for X.");

  await page.getByRole("tab", { name: "Export" }).click();
  await expectProductJourney(page);
  const firstClaim = page.locator("#campaign-panel-export .claim-review textarea").first();
  await expect(firstClaim).toHaveValue(manifest.claims[0]!.text);
  await firstClaim.fill("Reviewed locally: Demo is a testable developer utility.");
  await expect(firstClaim).toHaveValue(/Reviewed locally/);

  const exportButton = page.getByRole("button", { name: "Download complete launch package" });
  await expect(exportButton).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await exportButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("pitchflow-e2e.zip");
  expect(exportRequests).toHaveLength(1);
  expect((exportRequests[0]?.captures as unknown[]).length).toBe(2);
  expect(JSON.stringify(exportRequests[0])).not.toContain("/Users/");
  const exportedCampaign = exportRequests[0]?.campaign as {
    copy: { x: string };
    claims: Array<Record<string, unknown>>;
  };
  expect(exportedCampaign.copy.x).toBe("Reviewed launch copy for X.");
  expect(exportedCampaign.claims[0]).toMatchObject({
    text: "Reviewed locally: Demo is a testable developer utility.",
    classification: "user_supplied",
    approvalRequired: false,
  });
  await expect(page.getByRole("heading", { name: "Your launch package is ready." })).toBeVisible();
  await expect(page.locator("#campaign-panel-export").getByRole("status")).toHaveText(
    "Downloaded pitchflow-e2e.zip.",
  );

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("shows a truthful repository failure without unlocking generation", async ({ page }) => {
  await mockLocalRuntime(page);
  await page.route("**/api/analyze", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "REPOSITORY_NOT_FOUND",
          message: "The repository was not found or is not public.",
        },
      }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Public GitHub repository").fill("https://github.com/acme/missing");
  await page.getByRole("button", { name: "Analyze repository" }).click();

  await expect(page.locator(".error-banner[role='alert']")).toContainText(
    "The repository was not found or is not public.",
  );
  await expect(page.getByRole("button", { name: "Generate campaign" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: productHero, exact: true })).toBeVisible();
});

test("keeps its primary journey usable at a narrow mobile viewport", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await mockLocalRuntime(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expectViewport(page, 390, 844);
  await expect(page.getByRole("heading", { name: productHero, exact: true })).toBeVisible();
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
  await page.getByRole("link", { name: "Skip to main content" }).focus();
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  expect(consoleErrors).toEqual([]);
});
