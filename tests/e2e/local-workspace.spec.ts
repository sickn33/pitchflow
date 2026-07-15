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

test("completes the local evidence, generation, capture, and export journey", async ({
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
      headers: { "content-disposition": 'attachment; filename="pitchflow-e2e.zip"' },
      body: Buffer.from("PK\u0005\u0006".padEnd(22, "\u0000"), "binary"),
    });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /PitchFlow ships the story/i })).toBeVisible();

  await page.getByLabel("Canonical public GitHub URL").fill("https://github.com/acme/demo");
  await page.getByRole("button", { name: "Analyze repository" }).click();
  await expect(page.getByText(`acme/demo @ ${snapshot.commitSha.slice(0, 7)}`)).toBeVisible();
  await expect(
    page.getByText("Codex authenticated · credential values were not read"),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "demo", exact: true })).toBeVisible();
  await expect(page.locator(".evidence-card")).toHaveCount(snapshot.evidence.length);

  await page.getByRole("checkbox", { name: /Run GPT‑5.6/i }).check();
  await page.getByRole("button", { name: "Generate launch system" }).click();
  await expect(page.getByRole("tab", { name: "preview" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".preview-hero h3")).toHaveText(manifest.productBrief.oneLiner);

  const firstClaim = page.getByLabel(`Edit claim ${manifest.claims[0]!.id}`);
  await firstClaim.fill("Reviewed locally: Demo is a testable developer utility.");
  await expect(firstClaim).toHaveValue(/Reviewed locally/);

  const captureDirectory = join(testInfo.outputDir, "real-ui-captures");
  await mkdir(captureDirectory, { recursive: true });
  const previewPath = join(captureDirectory, "pitchflow-preview.png");
  await page.screenshot({ path: previewPath, fullPage: false });
  await page.getByRole("tab", { name: "evidence" }).click();
  const evidencePath = join(captureDirectory, "pitchflow-evidence.png");
  await page.screenshot({ path: evidencePath, fullPage: false });

  await page.locator("#product-captures").setInputFiles([previewPath, evidencePath]);
  const descriptions = page.getByLabel("What this real screen shows");
  await expect(descriptions).toHaveCount(2);
  await descriptions
    .nth(0)
    .fill("PitchFlow campaign preview with evidence-linked generated product claims.");
  await descriptions
    .nth(1)
    .fill("PitchFlow evidence workspace showing the commit-pinned source records.");
  const provenance = page.getByLabel("Provenance");
  await provenance.nth(0).selectOption("creator-owned");
  await provenance.nth(1).selectOption("creator-owned");

  const exportButton = page.getByRole("button", { name: "Export captured launch package" });
  await expect(exportButton).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await exportButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^pitchflow-campaign_/);
  expect(exportRequests).toHaveLength(1);
  expect((exportRequests[0]?.captures as unknown[]).length).toBe(2);
  expect(JSON.stringify(exportRequests[0])).not.toContain("/Users/");

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
  await page.getByLabel("Canonical public GitHub URL").fill("https://github.com/acme/missing");
  await page.getByRole("button", { name: "Analyze repository" }).click();

  await expect(page.locator(".error-banner[role='alert']")).toContainText(
    "The repository was not found or is not public.",
  );
  await expect(page.getByRole("button", { name: "Generate launch system" })).toHaveCount(0);
  await expect(page.getByText("Your repository is the creative brief.")).toBeVisible();
});

test("keeps its primary journey usable at a narrow mobile viewport", async ({ page }) => {
  await mockLocalRuntime(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /PitchFlow ships the story/i })).toBeVisible();
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
  await page.getByRole("link", { name: "Skip to main content" }).focus();
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
});
