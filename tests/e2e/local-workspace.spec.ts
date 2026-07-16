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

const productHero =
  "Turn a GitHub repository into a launch website, social images, product videos, and ready-to-post copy.";
const wizardSteps = ["Repository", "Direction", "Engine", "Generate"];

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

async function expectViewport(page: Page, width: number, height: number) {
  expect(page.viewportSize()).toEqual({ width, height });
  await expect
    .poll(() => page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })))
    .toEqual({ width, height });
}

async function expectNoRootOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }));
  expect(overflow.document).toBeLessThanOrEqual(1);
  expect(overflow.body).toBeLessThanOrEqual(1);
}

async function expectFullyInsideFirstViewport(
  page: Page,
  selectors: string[],
  viewportHeight: number,
) {
  const positions = await page.evaluate((requestedSelectors) => {
    return requestedSelectors.map((selector) => {
      const element = document.querySelector(selector);
      if (!element) return { selector, missing: true };
      const rect = element.getBoundingClientRect();
      return { selector, top: rect.top, bottom: rect.bottom, missing: false };
    });
  }, selectors);

  for (const position of positions) {
    expect(position.missing, `${position.selector} must exist`).toBe(false);
    expect(
      position.top,
      `${position.selector} must start inside the viewport`,
    ).toBeGreaterThanOrEqual(0);
    expect(
      position.bottom,
      `${position.selector} must finish inside the ${viewportHeight}px viewport`,
    ).toBeLessThanOrEqual(viewportHeight);
  }
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

async function addAttributedCaptures(page: Page, outputDir: string) {
  const captureDirectory = join(outputDir, "real-ui-captures");
  await mkdir(captureDirectory, { recursive: true });
  const first = join(captureDirectory, "repository.png");
  const second = join(captureDirectory, "direction.png");
  await page.screenshot({ path: first, fullPage: false });
  await page.screenshot({ path: second, fullPage: true });
  await page.locator("#product-captures").setInputFiles([first, second]);

  const descriptions = page.getByLabel("What this real screen shows");
  await expect(descriptions).toHaveCount(2);
  await descriptions.nth(0).fill("Repository confirmation inside the real PitchFlow workflow.");
  await descriptions.nth(1).fill("Launch direction controls with the current project defaults.");
  const provenance = page.getByLabel("Provenance");
  await provenance.nth(0).selectOption("creator-owned");
  await provenance.nth(1).selectOption("creator-owned");
}

test("keeps one focused action per state and completes the real local workflow", async ({
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
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ snapshot }) });
  });
  await page.route("**/api/generate", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    expect(body.snapshot).toMatchObject({ id: snapshot.id, commitSha: snapshot.commitSha });
    expect(JSON.stringify(body)).not.toContain("data:image/");
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ manifest }) });
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
  await expect(page.getByRole("button", { name: "Create marketing assets" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Explore the PitchFlow demo" })).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "New project steps" })).toHaveCount(0);

  await page.getByLabel("GitHub repository", { exact: true }).fill("https://github.com/acme/demo");
  await page.getByRole("button", { name: "Create marketing assets" }).click();
  await expect(page.getByRole("heading", { name: "Repository ready." })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "New project steps" }).locator("li strong"),
  ).toHaveText(wizardSteps);
  await expect(page.locator(".pf-primary-button:visible")).toHaveCount(1);

  await page.getByRole("button", { name: "Continue to direction" }).click();
  await expect(page.getByRole("heading", { name: "Direct the launch." })).toBeVisible();
  await page.getByLabel("Audience").fill("Design-minded browser extension developers");
  await addAttributedCaptures(page, testInfo.outputDir);
  await expect(page.getByRole("button", { name: "Continue to engine" })).toBeEnabled();

  await page
    .getByRole("navigation", { name: "New project steps" })
    .getByRole("button", { name: /Repository/ })
    .click();
  await page.getByRole("button", { name: "Continue to direction" }).click();
  await expect(page.getByLabel("Audience")).toHaveValue(
    "Design-minded browser extension developers",
  );
  await expect(page.getByLabel("What this real screen shows")).toHaveCount(2);

  await page.getByRole("button", { name: "Continue to engine" }).click();
  await expect(page.getByRole("heading", { name: "Use your Codex engine." })).toBeVisible();
  await expect(page.getByText("Codex is connected")).toBeVisible();
  await page.getByRole("checkbox", { name: /Use my local Codex sign-in/i }).check();
  await page.getByRole("button", { name: "Continue to generate" }).click();

  await expect(page.getByRole("heading", { name: "Ready to build the launch kit." })).toBeVisible();
  await page.getByRole("button", { name: "Generate launch kit" }).click();
  await expect(
    page.getByText("Generated by your connected local engine · acme/demo"),
  ).toBeVisible();
  await expect(page.getByRole("tab")).toHaveText(["Website", "Images", "Videos", "Copy", "Export"]);
  await expect(page.getByRole("tab", { name: "Website" })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("tab", { name: "Copy" }).click();
  await page.getByLabel("X copy").fill("Reviewed launch copy for X.");
  await page.getByRole("tab", { name: "Export" }).click();
  const exportButton = page.getByRole("button", { name: "Download complete launch package" });
  await expect(exportButton).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await exportButton.click();
  expect((await downloadPromise).suggestedFilename()).toBe("pitchflow-e2e.zip");
  expect(exportRequests).toHaveLength(1);
  expect((exportRequests[0]?.captures as unknown[]).length).toBe(2);
  expect(JSON.stringify(exportRequests[0])).not.toContain("/Users/");
  expect((exportRequests[0]?.campaign as { copy: { x: string } }).copy.x).toBe(
    "Reviewed launch copy for X.",
  );

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);
  await expectNoRootOverflow(page);
  expect(consoleErrors).toEqual([]);
});

test("shows a truthful repository error without entering the wizard", async ({ page }) => {
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
  await page
    .getByLabel("GitHub repository", { exact: true })
    .fill("https://github.com/acme/missing");
  await page.getByRole("button", { name: "Create marketing assets" }).click();
  await expect(page.locator("#repository-error")).toContainText(
    "The repository was not found or is not public.",
  );
  await expect(page.getByRole("heading", { name: productHero, exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "New project steps" })).toHaveCount(0);
});

test("keeps the entry hierarchy usable at 390 by 844", async ({ page }) => {
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
  await expect(page.getByText("For developers and open-source maintainers")).toBeVisible();
  await expect(
    page.getByText(
      "PitchFlow reads the repository, uses your product screenshots for visual truth, and runs GPT‑5.6 through your local Codex account. Your credentials stay on your machine.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Generated deliverables").getByRole("listitem")).toHaveText([
    "Website",
    "Social images",
    "Product videos",
    "Copy",
    "ZIP",
  ]);
  await expectFullyInsideFirstViewport(
    page,
    [
      ".pf-entry-eyebrow",
      "#hero-heading",
      ".pf-entry-truth",
      ".pf-repo-form",
      ".pf-demo-action",
      ".pf-output-preview",
    ],
    844,
  );
  await expectNoRootOverflow(page);
  await page.getByRole("link", { name: "Skip to main content" }).focus();
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  expect(consoleErrors).toEqual([]);
});
