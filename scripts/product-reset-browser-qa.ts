import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { chromium, type Page } from "@playwright/test";
import sharp from "sharp";

import { argumentValue, requiredArgument } from "./arguments";

const root = resolve(process.cwd());
const baseUrl = new URL(requiredArgument("url"));
const outputDirectory = resolve(requiredArgument("output"));
const label = argumentValue("label") ?? "local-public";

if (
  (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") ||
  baseUrl.username ||
  baseUrl.password ||
  baseUrl.search ||
  baseUrl.hash
) {
  throw new Error("Browser QA requires a credential-free HTTP(S) origin URL.");
}
if (!outputDirectory.startsWith(`${root}${sep}`)) {
  throw new Error("Browser QA output must remain inside the PitchFlow repository.");
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
  throw new Error("PitchFlow browser QA requires Chrome, Edge, or Chromium.");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

async function assertNoRootOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth - document.body.clientWidth,
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    scrollX: window.scrollX,
  }));
  assert(overflow.body <= 1, `${label}: body overflows horizontally by ${overflow.body}px.`);
  assert(
    overflow.document <= 1,
    `${label}: document overflows horizontally by ${overflow.document}px.`,
  );
  assert(overflow.scrollX === 0, `${label}: page opened with a horizontal scroll offset.`);
  return overflow;
}

async function assertFirstViewportContract(page: Page, viewportHeight: number, label: string) {
  const positions = await page.evaluate(() => {
    const selectors = {
      heading: "#hero-heading",
      input: "#repository-url",
      inputContract: ".hero-input-contract",
      outputs: ".product-outputs",
      stepper: ".product-stepper",
    } as const;
    return Object.fromEntries(
      Object.entries(selectors).map(([name, selector]) => {
        const element = document.querySelector(selector);
        if (!element) return [name, null];
        const rect = element.getBoundingClientRect();
        return [name, { top: rect.top, bottom: rect.bottom }];
      }),
    );
  });
  for (const [name, position] of Object.entries(positions)) {
    assert(position, `${label}: ${name} is missing from the product-first surface.`);
    assert(
      position.top >= 0 && position.bottom <= viewportHeight,
      `${label}: ${name} is not fully visible in the first viewport (${position.top}–${position.bottom}px).`,
    );
  }
  return positions;
}

async function assertA11y(page: Page, label: string) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = result.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  assert(
    blocking.length === 0,
    `${label}: serious/critical axe violations: ${JSON.stringify(blocking)}`,
  );
  return { blockingViolations: blocking.length, totalViolations: result.violations.length };
}

async function captureFullPage(page: Page, fileName: string, expectedWidth: number) {
  const path = resolve(outputDirectory, fileName);
  const bytes = await page.screenshot({ path, fullPage: true, animations: "disabled" });
  const metadata = await sharp(bytes).metadata();
  assert(
    metadata.width === expectedWidth,
    `${fileName}: expected width ${expectedWidth}, got ${metadata.width}.`,
  );
  assert((metadata.height ?? 0) > 0, `${fileName}: screenshot has no measurable height.`);
  return {
    path: relative(root, path),
    width: metadata.width,
    height: metadata.height,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
  };
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  colorScheme: "dark",
  reducedMotion: "reduce",
  acceptDownloads: true,
});
const page = await context.newPage();
const consoleErrors: string[] = [];
const mutationRequests: string[] = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));
page.on("request", (request) => {
  const path = new URL(request.url()).pathname;
  if (request.method() !== "GET" && /^\/api\/(?:analyze|generate|export)$/.test(path)) {
    mutationRequests.push(`${request.method()} ${path}`);
  }
});

const productHero = "Paste your repo. Get a launch-ready site, social kit, and product video.";
const repositoryUrl = "https://github.com/openai/codex";

try {
  await page.goto(baseUrl.href, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: productHero, exact: true }).waitFor();
  await page
    .getByRole("heading", { name: "Explore the finished PitchFlow demo.", exact: true })
    .waitFor();

  const desktopFirstViewport = await assertFirstViewportContract(page, 1000, "desktop");
  const desktopOverflow = await assertNoRootOverflow(page, "desktop");
  const desktopA11y = await assertA11y(page, "desktop");

  for (const name of ["Website", "Images", "Videos", "Copy", "Export"] as const) {
    const tab = page.getByRole("tab", { name, exact: true });
    assert((await tab.count()) === 1, `Delivery tab ${name} is missing or ambiguous.`);
    await tab.click();
    assert(
      (await tab.getAttribute("aria-selected")) === "true",
      `Delivery tab ${name} did not activate.`,
    );
  }

  const repositoryInput = page.getByLabel("Public GitHub repository", { exact: true });
  await repositoryInput.fill(repositoryUrl);
  await page.getByRole("button", { name: "Analyze repository", exact: true }).click();
  await page
    .getByText("Your repository is ready for the local workspace.", { exact: true })
    .waitFor();
  const handoff = page.locator(".handoff-deep-link a");
  assert((await handoff.count()) === 1, "Public repository handoff link is missing or ambiguous.");
  const handoffHref = await handoff.getAttribute("href");
  assert(handoffHref, "Public repository handoff has no href.");
  const handoffUrl = new URL(handoffHref);
  assert(
    handoffUrl.origin === "http://127.0.0.1:3210",
    "Handoff does not target the loopback workspace.",
  );
  assert(handoffUrl.searchParams.get("repo") === repositoryUrl, "Handoff lost the repository URL.");
  assert(
    mutationRequests.length === 0,
    `Public mode sent mutation requests: ${mutationRequests.join(", ")}`,
  );

  await page.getByRole("button", { name: "Try the PitchFlow demo", exact: true }).click();
  await page
    .getByRole("heading", { name: "Explore the finished PitchFlow demo.", exact: true })
    .waitFor();
  await page.waitForFunction(
    (expectedRepository) =>
      (document.querySelector("#repository-url") as HTMLInputElement | null)?.value ===
        expectedRepository && !document.querySelector(".handoff-deep-link"),
    "https://github.com/sickn33/pitchflow",
    { timeout: 60_000 },
  );
  const restoredRepository = await repositoryInput.inputValue();
  assert(
    restoredRepository === "https://github.com/sickn33/pitchflow",
    "Trying the demo did not restore the PitchFlow repository input.",
  );
  assert(
    (await page.locator(".handoff-deep-link").count()) === 0,
    "Trying the demo retained a stale arbitrary-repository handoff.",
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  const desktopScreenshot = await captureFullPage(
    page,
    `${label}-desktop-1440x1000-full.png`,
    1440,
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: productHero, exact: true }).waitFor();
  await page
    .getByRole("heading", { name: "Explore the finished PitchFlow demo.", exact: true })
    .waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  const mobileFirstViewport = await assertFirstViewportContract(page, 844, "mobile");
  const mobileOverflow = await assertNoRootOverflow(page, "mobile");
  const mobileA11y = await assertA11y(page, "mobile");
  const mobileScreenshot = await captureFullPage(page, `${label}-mobile-390x844-full.png`, 390);

  const evidenceLink = page.getByRole("link", { name: "View product evidence", exact: true });
  assert((await evidenceLink.count()) === 1, "Secondary evidence link is missing.");
  assert((await evidenceLink.getAttribute("href")) === "/evidence", "Evidence link is incorrect.");
  assert(consoleErrors.length === 0, `Browser console errors: ${consoleErrors.join(" | ")}`);

  const report = {
    status: "ok",
    checkedAt: new Date().toISOString(),
    url: baseUrl.origin,
    productHero,
    desktop: {
      viewport: { width: 1440, height: 1000 },
      firstViewport: desktopFirstViewport,
      overflow: desktopOverflow,
      accessibility: desktopA11y,
      screenshot: desktopScreenshot,
    },
    mobile: {
      viewport: { width: 390, height: 844 },
      firstViewport: mobileFirstViewport,
      overflow: mobileOverflow,
      accessibility: mobileA11y,
      screenshot: mobileScreenshot,
    },
    deliveryTabs: ["Website", "Images", "Videos", "Copy", "Export"],
    repositoryHandoff: handoffUrl.href,
    mutationRequests,
    consoleErrors,
  };
  const reportPath = resolve(outputDirectory, `${label}-browser-qa.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: "w" });
  console.log(JSON.stringify({ ...report, report: relative(root, reportPath) }, null, 2));
} finally {
  await browser.close();
}
