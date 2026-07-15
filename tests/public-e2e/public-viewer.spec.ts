import { createHash } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { DOGFOOD_PACKAGE_URL, parseDogfoodPackage } from "../../apps/web/lib/dogfood";

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

test("serves the complete immutable package and denies public generation", async ({
  page,
  request,
}, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  const packageResponse = await request.get(DOGFOOD_PACKAGE_URL);
  expect(packageResponse.ok()).toBe(true);
  const dogfood = parseDogfoodPackage(await packageResponse.json());
  expect(dogfood.campaign.generation).toMatchObject({
    provider: "codex-sdk",
    model: "gpt-5.6-sol",
  });

  await page.goto("/");
  await expect(page.locator(".mode-pill[data-mode='viewer']")).toContainText("Cached judge viewer");
  await expect(
    page.getByRole("heading", { name: "Watch the launch. Inspect the package." }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Caption-complete launch films" })).toBeVisible();
  await expect(page.locator(".video-card video")).toHaveCount(2);
  await expect(page.locator(".social-grid .gallery-image-card")).toHaveCount(4);
  await expect(page.locator(".carousel-grid .gallery-image-card")).toHaveCount(5);
  await expect(page.locator(".capture-grid .gallery-image-card")).toHaveCount(4);
  await expect(page.locator(".asset-shelf li")).toHaveCount(dogfood.assets.length);

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

  await testInfo.attach("public-viewer-desktop", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  expect(consoleErrors).toEqual([]);
});

test("keeps the cached judge path accessible and responsive", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Watch the launch. Inspect the package." }),
  ).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Caption-complete launch films" })).toBeVisible();
  const overflowAudit = await page.evaluate(() => {
    const originalBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    const originalY = window.scrollY;
    window.scrollTo(1_000, originalY);
    const viewportScrollX = window.scrollX;
    window.scrollTo(0, originalY);
    document.documentElement.style.scrollBehavior = originalBehavior;

    const unexpectedElements = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((element) => !element.closest(".carousel-grid"))
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        const styles = getComputedStyle(element);
        return {
          element: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${
            element.className && typeof element.className === "string"
              ? `.${element.className.trim().replaceAll(/\s+/g, ".")}`
              : ""
          }`,
          left: Math.round(bounds.left),
          right: Math.round(bounds.right),
          width: Math.round(bounds.width),
          visible:
            styles.display !== "none" &&
            styles.visibility !== "hidden" &&
            bounds.width > 1 &&
            bounds.height > 1,
        };
      })
      .filter(
        ({ left, right, visible }) => visible && (left < -1 || right > window.innerWidth + 1),
      );

    const carousels = [...document.querySelectorAll<HTMLElement>(".carousel-grid")].map(
      (element) => {
        const bounds = element.getBoundingClientRect();
        const styles = getComputedStyle(element);
        const originalScroll = element.scrollLeft;
        const originalSnap = element.style.scrollSnapType;
        element.style.scrollSnapType = "none";
        element.scrollLeft = 100;
        const testedScroll = element.scrollLeft;
        element.scrollLeft = originalScroll;
        element.style.scrollSnapType = originalSnap;
        return {
          left: Math.round(bounds.left),
          right: Math.round(bounds.right),
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          overflowX: styles.overflowX,
          testedScroll,
        };
      },
    );
    return { viewportScrollX, unexpectedElements, carousels };
  });
  expect(overflowAudit.viewportScrollX).toBe(0);
  expect(overflowAudit.unexpectedElements).toEqual([]);
  expect(overflowAudit.carousels).toHaveLength(1);
  expect(overflowAudit.carousels[0]).toMatchObject({ overflowX: "auto" });
  expect(overflowAudit.carousels[0]!.left).toBeGreaterThanOrEqual(0);
  expect(overflowAudit.carousels[0]!.right).toBeLessThanOrEqual(390);
  expect(overflowAudit.carousels[0]!.scrollWidth).toBeGreaterThan(
    overflowAudit.carousels[0]!.clientWidth,
  );
  expect(overflowAudit.carousels[0]!.testedScroll).toBeGreaterThan(0);
  await testInfo.attach("public-viewer-mobile", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  expect(consoleErrors).toEqual([]);
});
