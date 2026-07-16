import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { chromium, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";

import { requiredArgument } from "./arguments";

const root = resolve(process.cwd());
const baseUrl = new URL(requiredArgument("url"));
const outputDirectory = resolve(requiredArgument("output"));
const edgePath = "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge";

if (!(["http:", "https:"] as const).includes(baseUrl.protocol as "http:" | "https:")) {
  throw new Error("Comprehension QA requires an HTTP(S) origin.");
}
if (baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
  throw new Error("Comprehension QA URL must not contain credentials or state.");
}
if (!outputDirectory.startsWith(`${root}${sep}`)) {
  throw new Error("Comprehension QA output must remain inside the PitchFlow repository.");
}
if (!existsSync(edgePath)) throw new Error("Microsoft Edge is not installed.");

const proposition =
  "Turn a GitHub repository into a launch website, social images, product videos, and ready-to-post copy.";
const truth =
  "PitchFlow reads the repository, uses your product screenshots for visual truth, and runs GPT‑5.6 through your local Codex account. Your credentials stay on your machine.";
const purpose =
  "This page shows what is real, how Codex/GPT-5.6 was used, and how the outputs were verified.";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function assertNoRootOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth - document.body.clientWidth,
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    scrollX: window.scrollX,
  }));
  assert(overflow.body <= 1, `${label}: body overflows by ${overflow.body}px.`);
  assert(overflow.document <= 1, `${label}: document overflows by ${overflow.document}px.`);
  assert(overflow.scrollX === 0, `${label}: opened with horizontal scroll.`);
  return overflow;
}

async function assertA11y(page: Page, label: string) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = result.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  assert(blocking.length === 0, `${label}: blocking axe findings ${JSON.stringify(blocking)}.`);
  return { total: result.violations.length, seriousOrCritical: blocking.length };
}

async function assertInsideViewport(locator: Locator, height: number, label: string) {
  const box = await locator.boundingBox();
  assert(box, `${label}: element is missing or not rendered.`);
  assert(box.y >= 0, `${label}: starts above the viewport at ${box.y}px.`);
  assert(
    box.y + box.height <= height,
    `${label}: ends below ${height}px at ${box.y + box.height}px.`,
  );
  return { top: box.y, bottom: box.y + box.height };
}

async function captureViewport(page: Page, name: string, width: number, height: number) {
  const path = resolve(outputDirectory, name);
  const bytes = await page.screenshot({ path, fullPage: false, animations: "disabled" });
  const metadata = await sharp(bytes).metadata();
  assert(metadata.width === width, `${name}: expected width ${width}, got ${metadata.width}.`);
  assert(metadata.height === height, `${name}: expected height ${height}, got ${metadata.height}.`);
  return {
    path: relative(root, path),
    width: metadata.width,
    height: metadata.height,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
  };
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ executablePath: edgePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  colorScheme: "dark",
  reducedMotion: "reduce",
});
const page = await context.newPage();
const consoleErrors: string[] = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

const report: Record<string, unknown> = {
  status: "running",
  checkedAt: new Date().toISOString(),
  browser: { name: "Microsoft Edge", version: browser.version(), headless: true },
  url: baseUrl.origin,
};

try {
  const homeResults: Record<string, unknown> = {};
  const evidenceResults: Record<string, unknown> = {};

  for (const viewport of [
    { label: "desktop", width: 1440, height: 1000 },
    { label: "mobile", width: 390, height: 844 },
  ] as const) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(new URL("/", baseUrl).href, { waitUntil: "networkidle", timeout: 60_000 });
    await page.evaluate(() => window.scrollTo(0, 0));

    const heading = page.getByRole("heading", { name: proposition, exact: true });
    const audience = page.getByText("For developers and open-source maintainers", { exact: true });
    const truthText = page.getByText(truth, { exact: true });
    const input = page.getByLabel("GitHub repository", { exact: true });
    const primary = page.getByRole("button", { name: "Create marketing assets", exact: true });
    const demo = page.getByRole("button", { name: "Explore the PitchFlow demo", exact: true });
    const chain = page.getByRole("region", { name: "How PitchFlow creates marketing assets" });

    for (const locator of [heading, audience, truthText, input, primary, demo, chain]) {
      assert(
        (await locator.count()) === 1,
        `${viewport.label}: comprehension element is ambiguous.`,
      );
    }
    const visiblePositions = {
      audience: await assertInsideViewport(audience, viewport.height, `${viewport.label} audience`),
      proposition: await assertInsideViewport(
        heading,
        viewport.height,
        `${viewport.label} proposition`,
      ),
      truth: await assertInsideViewport(
        truthText,
        viewport.height,
        `${viewport.label} local Codex truth`,
      ),
      input: await assertInsideViewport(
        input,
        viewport.height,
        `${viewport.label} repository input`,
      ),
      primary: await assertInsideViewport(
        primary,
        viewport.height,
        `${viewport.label} primary action`,
      ),
      demo: await assertInsideViewport(demo, viewport.height, `${viewport.label} demo action`),
      chain: await assertInsideViewport(
        chain,
        viewport.height,
        `${viewport.label} input-process-output chain`,
      ),
    };
    const outputs = await page
      .getByLabel("Generated deliverables")
      .getByRole("listitem")
      .allTextContents();
    assert(
      JSON.stringify(outputs) ===
        JSON.stringify(["Website", "Social images", "Product videos", "Copy", "ZIP"]),
      `${viewport.label}: explicit deliverables changed: ${JSON.stringify(outputs)}.`,
    );
    const primaryCount = await page.locator(".pf-repo-control button").count();
    assert(
      primaryCount === 1,
      `${viewport.label}: expected one repository primary, got ${primaryCount}.`,
    );
    const demoBackground = await demo.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    assert(
      demoBackground === "rgba(0, 0, 0, 0)",
      `${viewport.label}: demo action no longer reads as secondary (${demoBackground}).`,
    );
    const overflow = await assertNoRootOverflow(page, `${viewport.label} homepage`);
    const accessibility = await assertA11y(page, `${viewport.label} homepage`);
    const screenshot = await captureViewport(
      page,
      `homepage-${viewport.label}-${viewport.width}x${viewport.height}.png`,
      viewport.width,
      viewport.height,
    );
    homeResults[viewport.label] = {
      visiblePositions,
      outputs,
      primaryCount,
      overflow,
      accessibility,
      screenshot,
    };

    await page.goto(new URL("/evidence", baseUrl).href, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("heading", { name: "See what is real and how it was proved." }).waitFor();
    assert(
      (await page.getByText(purpose, { exact: true }).count()) === 1,
      `${viewport.label}: Evidence purpose is missing.`,
    );
    assert(
      (await page.getByText("3-minute judge path", { exact: true }).count()) === 1,
      `${viewport.label}: judge path is missing.`,
    );
    assert(
      (await page.locator(".evidence-section").count()) === 4,
      `${viewport.label}: Evidence must have four proof sections.`,
    );
    assert(
      (await page.getByText("Why this matters", { exact: true }).count()) === 4,
      `${viewport.label}: every section needs a Why this matters.`,
    );
    const rawDetails = page.locator(".evidence-raw details");
    assert(
      (await rawDetails.count()) === 4,
      `${viewport.label}: raw evidence disclosure count changed.`,
    );
    for (let index = 0; index < (await rawDetails.count()); index += 1) {
      assert(
        !(await rawDetails.nth(index).getAttribute("open")),
        `${viewport.label}: raw receipt ${index + 1} is expanded by default.`,
      );
    }
    const evidenceOverflow = await assertNoRootOverflow(
      page,
      `${viewport.label} Evidence overview`,
    );
    const evidenceAccessibility = await assertA11y(page, `${viewport.label} Evidence overview`);
    const overviewScreenshot = await captureViewport(
      page,
      `evidence-overview-${viewport.label}-${viewport.width}x${viewport.height}.png`,
      viewport.width,
      viewport.height,
    );

    const inventory = rawDetails.filter({ hasText: "immutable package files" });
    await inventory.locator("summary").click();
    await inventory.scrollIntoViewIfNeeded();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    assert(
      (await inventory.getAttribute("open")) !== null,
      `${viewport.label}: raw inventory did not expand.`,
    );
    assert(
      (await page.locator(".evidence-asset-table tbody tr").count()) === 25,
      `${viewport.label}: raw asset receipt lost files.`,
    );
    const expandedOverflow = await assertNoRootOverflow(
      page,
      `${viewport.label} expanded raw Evidence`,
    );
    const expandedScreenshot = await captureViewport(
      page,
      `evidence-raw-expanded-${viewport.label}-${viewport.width}x${viewport.height}.png`,
      viewport.width,
      viewport.height,
    );
    evidenceResults[viewport.label] = {
      sections: 4,
      whyThisMatters: 4,
      rawDisclosures: 4,
      rawCollapsedByDefault: true,
      assetRowsAfterExpansion: 25,
      overflow: evidenceOverflow,
      expandedOverflow,
      accessibility: evidenceAccessibility,
      overviewScreenshot,
      expandedScreenshot,
    };
  }

  assert(consoleErrors.length === 0, `Browser console errors: ${consoleErrors.join(" | ")}`);
  Object.assign(report, {
    status: "ok",
    fiveSecondContract: {
      proposition,
      audience: "For developers and open-source maintainers",
      input: "GitHub repository plus optional screenshots and creative direction",
      process: "GPT‑5.6 through local Codex; credentials stay local",
      outputs: ["Website", "Social images", "Product videos", "Copy", "ZIP"],
    },
    homepage: homeResults,
    evidence: evidenceResults,
    consoleErrors,
  });
} finally {
  await browser.close();
}

const reportPath = resolve(outputDirectory, "comprehension-browser-qa.json");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(
  `${JSON.stringify({ ...report, report: relative(root, reportPath) }, null, 2)}\n`,
);
