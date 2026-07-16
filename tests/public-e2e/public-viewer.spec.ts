import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { DOGFOOD_PACKAGE_URL, parseDogfoodPackage } from "../../apps/web/lib/dogfood";

const productHero = "Paste your repo. Get the whole launch kit.";

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

function expectPngDimensions(image: Buffer, width: number, height: number) {
  expect(image.subarray(1, 4).toString("ascii")).toBe("PNG");
  expect(image.readUInt32BE(16)).toBe(width);
  expect(image.readUInt32BE(20)).toBe(height);
}

type PixelStats = {
  width: number;
  height: number;
  min: number;
  max: number;
  mean: number;
  stdev: number;
};

async function decodedImagePixels(image: Locator): Promise<PixelStats> {
  await image.scrollIntoViewIfNeeded();
  return image.evaluate(async (element: HTMLImageElement) => {
    await element.decode();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const scale = Math.min(1, 160 / element.naturalWidth, 160 / element.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(element.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(element.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable for image proof.");
    context.drawImage(element, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    let sum = 0;
    let squareSum = 0;
    let min = 255;
    let max = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const luminance =
        0.2126 * pixels[index]! + 0.7152 * pixels[index + 1]! + 0.0722 * pixels[index + 2]!;
      count += 1;
      sum += luminance;
      squareSum += luminance * luminance;
      min = Math.min(min, luminance);
      max = Math.max(max, luminance);
    }
    const mean = sum / count;
    return {
      width: element.naturalWidth,
      height: element.naturalHeight,
      min,
      max,
      mean,
      stdev: Math.sqrt(squareSum / count - mean * mean),
    };
  });
}

async function decodedVideoPixels(video: Locator): Promise<PixelStats & { duration: number }> {
  await video.scrollIntoViewIfNeeded();
  return video.evaluate(async (element: HTMLVideoElement) => {
    element.preload = "auto";
    element.muted = true;
    element.load();
    if (element.readyState < 2) {
      await new Promise<void>((resolve, reject) => {
        element.addEventListener("loadeddata", () => resolve(), { once: true });
        element.addEventListener("error", () => reject(new Error("Video frame failed to load.")), {
          once: true,
        });
      });
    }
    element.currentTime = Math.min(1, element.duration / 2);
    await new Promise<void>((resolve) =>
      element.addEventListener("seeked", () => resolve(), { once: true }),
    );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = Math.max(1, Math.round((160 * element.videoHeight) / element.videoWidth));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable for video proof.");
    context.drawImage(element, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    let sum = 0;
    let squareSum = 0;
    let min = 255;
    let max = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const luminance =
        0.2126 * pixels[index]! + 0.7152 * pixels[index + 1]! + 0.0722 * pixels[index + 2]!;
      count += 1;
      sum += luminance;
      squareSum += luminance * luminance;
      min = Math.min(min, luminance);
      max = Math.max(max, luminance);
    }
    const mean = sum / count;
    return {
      width: element.videoWidth,
      height: element.videoHeight,
      duration: element.duration,
      min,
      max,
      mean,
      stdev: Math.sqrt(squareSum / count - mean * mean),
    };
  });
}

async function attachCaptures(page: Page, outputDir: string) {
  const directory = join(outputDir, "public-project-captures");
  await mkdir(directory, { recursive: true });
  const first = join(directory, "repository.png");
  const second = join(directory, "direction.png");
  await page.screenshot({ path: first, fullPage: false });
  await page.screenshot({ path: second, fullPage: true });
  await page.locator("#product-captures").setInputFiles([first, second]);
  const descriptions = page.getByLabel("What this real screen shows");
  await descriptions
    .nth(0)
    .fill("Validated repository summary in the real PitchFlow project flow.");
  await descriptions
    .nth(1)
    .fill("Creative direction and capture inputs for the current repository.");
  const provenance = page.getByLabel("Provenance");
  await provenance.nth(0).selectOption("creator-owned");
  await provenance.nth(1).selectOption("creator-owned");
}

test("opens the immutable dogfood as an unmistakable read-only results project", async ({
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
  await expect(page.getByRole("navigation", { name: "New project steps" })).toHaveCount(0);
  await page.getByRole("button", { name: "Explore the PitchFlow demo" }).click();

  await expect(
    page.getByText("Read-only demo · generated from the PitchFlow repository"),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "PitchFlow launch kit" })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveText(["Website", "Images", "Videos", "Copy", "Export"]);
  await expect(page.getByRole("button", { name: "Create from my repository" })).toBeVisible();

  await page.getByRole("tab", { name: "Images" }).click();
  const imagePreviews = page.locator("#campaign-panel-images img");
  await expect(imagePreviews).toHaveCount(13);
  const imagePixelProof: PixelStats[] = [];
  for (let index = 0; index < (await imagePreviews.count()); index += 1) {
    const stats = await decodedImagePixels(imagePreviews.nth(index));
    expect(stats.width).toBeGreaterThan(0);
    expect(stats.height).toBeGreaterThan(0);
    expect(stats.max - stats.min).toBeGreaterThan(100);
    expect(stats.stdev).toBeGreaterThan(20);
    imagePixelProof.push(stats);
  }
  await imagePreviews.first().scrollIntoViewIfNeeded();
  const decodedImagesScreenshot = await page.screenshot({ fullPage: false });
  await testInfo.attach("decoded-images-visible-pixels", {
    body: decodedImagesScreenshot,
    contentType: "image/png",
  });
  await page.getByRole("tab", { name: "Videos" }).click();
  const videoPreviews = page.locator("#campaign-panel-videos video");
  await expect(videoPreviews).toHaveCount(2);
  const videoPixelProof: Array<PixelStats & { duration: number }> = [];
  for (let index = 0; index < (await videoPreviews.count()); index += 1) {
    const stats = await decodedVideoPixels(videoPreviews.nth(index));
    expect(stats.width).toBeGreaterThan(0);
    expect(stats.height).toBeGreaterThan(0);
    expect(stats.duration).toBe(36);
    expect(stats.max - stats.min).toBeGreaterThan(100);
    expect(stats.stdev).toBeGreaterThan(20);
    videoPixelProof.push(stats);
  }
  await testInfo.attach("decoded-media-pixel-proof", {
    body: Buffer.from(
      JSON.stringify({ images: imagePixelProof, videos: videoPixelProof }, null, 2),
    ),
    contentType: "application/json",
  });
  await page.getByRole("tab", { name: "Copy" }).click();
  await expect(page.getByRole("heading", { name: "Inspect the launch voice." })).toBeVisible();
  await page.getByRole("tab", { name: "Export" }).click();
  const archive = dogfood.assets.find((asset) => asset.mediaType === "application/zip");
  expect(archive).toBeDefined();
  await expect(
    page.getByRole("link", { name: "Download complete launch package" }),
  ).toHaveAttribute("href", archive!.href);
  expect(
    await page
      .locator("#campaign-panel-export")
      .evaluate((element) => Math.round(element.getBoundingClientRect().height)),
  ).toBeLessThan(500);

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
  await testInfo.attach("demo-results-desktop-1440x1000", {
    body: screenshot,
    contentType: "image/png",
  });
  await expectNoRootOverflow(page);
  expect(consoleErrors).toEqual([]);
});

test("preserves a fresh project through direction and shows the honest disconnected engine state", async ({
  page,
}, testInfo) => {
  const consoleErrors = collectConsoleErrors(page);
  await page.route("https://api.github.com/repos/acme/demo", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        full_name: "acme/demo",
        description: "A small public product used for the PitchFlow UI contract.",
        language: "TypeScript",
        license: { spdx_id: "MIT" },
      }),
    });
  });
  await page.route("http://127.0.0.1:3210/api/bridge/**", async (route) =>
    route.abort("connectionrefused"),
  );

  await page.goto("/");
  await page.getByLabel("GitHub repository").fill("https://github.com/acme/demo");
  await page.getByRole("button", { name: "Generate launch kit" }).click();
  await expect(page.getByRole("heading", { name: "Repository ready." })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Repository ready." }).getByText("acme/demo", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue to direction" }).click();
  await page.getByLabel("Audience").fill("Developers who ship small open-source products");
  await attachCaptures(page, testInfo.outputDir);
  await page.getByRole("button", { name: "Continue to engine" }).click();

  await expect(page.getByRole("heading", { name: "Connect your Codex engine." })).toBeVisible();
  await expect(page.getByText("Local engine not connected")).toBeVisible();
  await expect(page.getByText("pnpm pitchflow connect")).toBeVisible();
  await expect(page.getByText("The hosted page could not reach loopback.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open local workspace with this project" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Check connection" })).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await expect(
    page.getByRole("button", { name: "Open local workspace with this project" }),
  ).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByLabel("Audience")).toHaveValue(
    "Developers who ship small open-source products",
  );
  await expect(page.getByLabel("What this real screen shows")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "PitchFlow launch kit" })).toHaveCount(0);
  await expectNoRootOverflow(page);
  expect(consoleErrors).toEqual([]);
});

test("keeps provenance and complete media evidence on the secondary evidence route", async ({
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

test("passes entry and demo accessibility at exact desktop and mobile viewports", async ({
  page,
}, testInfo) => {
  const consoleErrors = collectConsoleErrors(page);
  await page.goto("/");
  await expectViewport(page, 1440, 1000);
  await expect(page.getByRole("heading", { name: productHero, exact: true })).toBeVisible();
  await expectNoRootOverflow(page);
  let accessibility = await new AxeBuilder({ page })
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
  await expectNoRootOverflow(page);
  const entry = await page.screenshot({ fullPage: false });
  expectPngDimensions(entry, 390, 844);
  await testInfo.attach("entry-mobile-390x844", { body: entry, contentType: "image/png" });

  await page.getByRole("button", { name: "Explore the PitchFlow demo" }).click();
  await expect(
    page.getByText("Read-only demo · generated from the PitchFlow repository"),
  ).toBeVisible();
  await expectNoRootOverflow(page);
  accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);
  await page.getByRole("link", { name: "Skip to main content" }).focus();
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  expect(consoleErrors).toEqual([]);
});
