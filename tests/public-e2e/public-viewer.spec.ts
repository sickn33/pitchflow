import { createHash } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { DOGFOOD_PACKAGE_URL, parseDogfoodPackage } from "../../apps/web/lib/dogfood";

const productHero = "Paste your repo. Get a launch-ready site, social kit, and product video.";
const workflowSteps = ["Analyze", "Direct", "Generate", "Deliver", "Export"];
const workflowMarkers = [
  "01 · Analyze",
  "02 · Direct",
  "03 · Generate",
  "04 · Deliver",
  "05 · Export",
];

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function expectViewport(page: Page, width: number, height: number) {
  expect(page.viewportSize()).toEqual({ width, height });
  await expect
    .poll(() => page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })))
    .toEqual({ width, height });
}

function expectPngDimensions(image: Buffer, width: number, height: number) {
  expect(image.subarray(1, 4).toString("ascii")).toBe("PNG");
  expect(image.readUInt32BE(16)).toBe(width);
  expect(image.readUInt32BE(20)).toBe(height);
}

async function expectNoRootOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
    scrollX: window.scrollX,
  }));
  expect(overflow.document).toBeLessThanOrEqual(1);
  expect(overflow.body).toBeLessThanOrEqual(1);
  expect(overflow.scrollX).toBe(0);
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

test("serves the immutable dogfood through the complete product journey and denies public generation", async ({
  page,
  request,
}, testInfo) => {
  const consoleErrors = collectConsoleErrors(page);
  const packageResponse = await request.get(DOGFOOD_PACKAGE_URL);
  expect(packageResponse.ok()).toBe(true);
  const dogfood = parseDogfoodPackage(await packageResponse.json());
  expect(dogfood.campaign.generation).toMatchObject({
    provider: "codex-sdk",
    model: "gpt-5.6-sol",
  });

  await page.goto("/");
  await expectViewport(page, 1440, 1000);
  await expect(page.getByRole("heading", { name: productHero, exact: true })).toBeVisible();
  await expect(
    page.getByText("Interactive demo · generated from the PitchFlow repository"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Here’s what PitchFlow understood." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Explore the finished PitchFlow demo." }),
  ).toBeVisible();

  await expect(page.getByRole("tab", { name: "Website" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#campaign-panel-website h3")).toHaveText(
    dogfood.campaign.productBrief.oneLiner,
  );
  await expect(page.getByRole("link", { name: "Open full website" })).toHaveAttribute(
    "href",
    "/dogfood/pitchflow/v1/site/index.html",
  );

  await page.getByRole("tab", { name: "Images" }).click();
  await expect(page.locator("#campaign-panel-images .gallery-image-card")).toHaveCount(13);
  await expect(page.getByText("Production images from the complete PitchFlow demo.")).toBeVisible();

  await page.getByRole("tab", { name: "Videos" }).click();
  await expect(page.locator("#campaign-panel-videos video")).toHaveCount(2);
  await expect(
    page.getByText("Play the landscape and portrait masters from the PitchFlow demo."),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Copy" }).click();
  await expect(page.getByRole("heading", { name: "Inspect the launch voice." })).toBeVisible();

  await page.getByRole("tab", { name: "Export" }).click();
  await expectProductJourney(page);
  const archive = dogfood.assets.find((asset) => asset.mediaType === "application/zip");
  expect(archive).toBeDefined();
  await expect(
    page.getByRole("link", { name: "Download complete launch package" }),
  ).toHaveAttribute("href", archive!.href);

  for (const asset of dogfood.assets) {
    const response = await request.get(asset.href, { timeout: 180_000 });
    expect(response.ok(), asset.href).toBe(true);
    const body = await response.body();
    expect(body.byteLength, asset.href).toBe(asset.bytes);
    expect(sha256(body), asset.href).toBe(asset.sha256);
    expect(response.headers()["cache-control"], asset.href).toContain("immutable");
  }

  const statusResponse = await request.get("/api/status");
  expect(await statusResponse.json()).toEqual({
    mode: "public-viewer",
    generationEnabled: false,
    codex: null,
  });
  for (const route of ["/api/analyze", "/api/generate", "/api/export"]) {
    const response = await request.post(route, {
      headers: { "content-type": "application/json" },
      data: "not-valid-json",
    });
    expect(response.status(), route).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PUBLIC_VIEWER_READ_ONLY" },
    });
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  const screenshot = await page.screenshot({ fullPage: false });
  expectPngDimensions(screenshot, 1440, 1000);
  await testInfo.attach("public-product-desktop-1440x1000", {
    body: screenshot,
    contentType: "image/png",
  });
  await expectNoRootOverflow(page);
  expect(consoleErrors).toEqual([]);
});

test("preserves an arbitrary public repository in an honest local-only handoff without mutation requests", async ({
  page,
}) => {
  const consoleErrors = collectConsoleErrors(page);
  const mutationRequests: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() !== "GET" && /^\/api\/(?:analyze|generate|export)$/.test(path)) {
      mutationRequests.push(`${request.method()} ${path}`);
    }
  });

  await page.goto("/");
  const repositoryInput = page.getByLabel("Public GitHub repository");
  await expect(repositoryInput).toHaveValue("https://github.com/sickn33/pitchflow");

  const repositoryUrl = "https://github.com/openai/codex";
  await repositoryInput.fill(repositoryUrl);
  await page.getByRole("button", { name: "Analyze repository" }).click();

  await expect(page.getByText("Your repository is ready for the local workspace.")).toBeVisible();
  const deepLinkHref = await page.locator(".handoff-deep-link a").getAttribute("href");
  expect(deepLinkHref).not.toBeNull();
  const deepLink = new URL(deepLinkHref!);
  expect(deepLink.origin).toBe("http://127.0.0.1:3210");
  expect(deepLink.searchParams.get("repo")).toBe(repositoryUrl);
  await expect(repositoryInput).toHaveValue(repositoryUrl);
  expect(mutationRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("keeps repository records, claim anchors, real media, and package hashes on the evidence route", async ({
  page,
  request,
}) => {
  const consoleErrors = collectConsoleErrors(page);
  const packageResponse = await request.get(DOGFOOD_PACKAGE_URL);
  const dogfood = parseDogfoodPackage(await packageResponse.json());

  await page.goto("/evidence");
  await expect(
    page.getByRole("heading", {
      name: "Inspect a complete campaign. Generate only on your machine.",
    }),
  ).toBeVisible();
  await expect(page.locator(".evidence-card")).toHaveCount(dogfood.snapshot.evidence.length);
  for (const evidence of dogfood.snapshot.evidence) {
    await expect(page.locator(`#evidence-${evidence.id}`)).toHaveCount(1);
  }

  const firstClaim = dogfood.campaign.claims[0]!;
  const firstEvidenceId = firstClaim.evidenceIds[0]!;
  await page
    .getByLabel(`Evidence for ${firstClaim.text}`)
    .getByRole("button", { name: firstEvidenceId })
    .click();
  await expect(page.locator(`#evidence-${firstEvidenceId}`)).toBeFocused();

  await expect(page.locator(".video-card video")).toHaveCount(2);
  await expect(page.locator(".social-grid .gallery-image-card")).toHaveCount(4);
  await expect(page.locator(".carousel-grid .gallery-image-card")).toHaveCount(5);
  await expect(page.locator(".capture-grid .gallery-image-card")).toHaveCount(4);
  await expect(page.locator(".asset-shelf li")).toHaveCount(dogfood.assets.length);
  await expect(
    page.getByRole("link", { name: "Return to the PitchFlow workspace" }),
  ).toHaveAttribute("href", "/");
  expect(consoleErrors).toEqual([]);
});

test("keeps the product-first judge path accessible at exact desktop and mobile dimensions", async ({
  page,
}, testInfo) => {
  const consoleErrors = collectConsoleErrors(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Explore the finished PitchFlow demo." }),
  ).toBeVisible();
  await expectViewport(page, 1440, 1000);
  await expectNoRootOverflow(page);

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expectViewport(page, 390, 844);
  await expect(page.getByRole("heading", { name: productHero, exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Explore the finished PitchFlow demo." }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectNoRootOverflow(page);

  const stepperOverflow = await page
    .getByRole("navigation", { name: "PitchFlow workflow" })
    .evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      overflowX: getComputedStyle(element).overflowX,
    }));
  expect(stepperOverflow.overflowX).toBe("auto");
  expect(stepperOverflow.scrollWidth).toBeGreaterThan(stepperOverflow.clientWidth);

  const screenshot = await page.screenshot({ fullPage: false });
  expectPngDimensions(screenshot, 390, 844);
  await testInfo.attach("public-product-mobile-390x844", {
    body: screenshot,
    contentType: "image/png",
  });
  await page.getByRole("link", { name: "Skip to main content" }).focus();
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  expect(consoleErrors).toEqual([]);
});
