import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";

import { chromium } from "@playwright/test";
import sharp from "sharp";

import { repeatedArgumentValues, requiredArgument } from "./arguments";

const root = resolve(process.cwd());
const baseUrl = new URL(requiredArgument("url"));
const output = resolve(requiredArgument("output"));
const repositoryUrl = requiredArgument("repo");
const capturePaths = repeatedArgumentValues("capture").map((path) => resolve(path));
const edgePath = "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge";

if (baseUrl.protocol !== "https:" || baseUrl.pathname !== "/") {
  throw new Error("Connected browser verification requires a credential-free HTTPS origin.");
}
if (!output.startsWith(`${root}${sep}`)) {
  throw new Error("Connected browser evidence must remain inside the PitchFlow repository.");
}
if (capturePaths.length < 2 || capturePaths.length > 4) {
  throw new Error("Connected browser verification requires 2–4 product captures.");
}
for (const path of capturePaths) {
  if (!existsSync(path)) throw new Error(`Capture does not exist: ${path}`);
}
if (!existsSync(edgePath)) throw new Error("Microsoft Edge is not installed.");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: edgePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
  reducedMotion: "reduce",
  colorScheme: "dark",
});
const page = await context.newPage();
const consoleErrors: string[] = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

const productHero = "Paste your repo. Get a launch-ready site, social kit, and product video.";
const progress: Array<{ at: string; message: string; value: number }> = [];
let permissionState = "unsupported";

try {
  await page.goto(baseUrl.href, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: productHero, exact: true }).waitFor();
  await page
    .getByRole("heading", { name: "Explore the finished PitchFlow demo.", exact: true })
    .waitFor();

  permissionState = await page.evaluate(async () => {
    try {
      const status = await navigator.permissions.query({ name: "local-network-access" as never });
      return status.state;
    } catch {
      return "unsupported";
    }
  });

  await page.getByLabel("Public GitHub repository", { exact: true }).fill(repositoryUrl);
  await page.getByRole("button", { name: "Analyze repository", exact: true }).click();
  await page.getByRole("heading", { name: "Repository ready for your local engine." }).waitFor();
  await page.locator("#product-captures").setInputFiles(capturePaths);
  await page.locator(".capture-list li").last().waitFor({ timeout: 30_000 });
  assert(
    (await page.locator(".capture-list li").count()) === capturePaths.length,
    "Capture upload count mismatch.",
  );
  for (let index = 0; index < capturePaths.length; index += 1) {
    const item = page.locator(".capture-list li").nth(index);
    await item
      .getByLabel("Capture label")
      .fill(index === 0 ? "Palette workspace" : `Product settings ${index}`);
    await item
      .getByLabel("What this real screen shows")
      .fill(
        index === 0
          ? "Creator-owned VibePalette workspace showing a captured palette and export actions."
          : "Creator-owned VibePalette settings showing formats, themes, and product controls.",
      );
    await item.getByLabel("Provenance").selectOption("creator-owned");
  }

  await page.getByRole("heading", { name: "Connect your generation engine." }).waitFor();
  await page.waitForFunction(
    () =>
      !document.querySelector(".bridge-connection strong")?.textContent?.includes("Checking") &&
      Boolean(document.querySelector(".bridge-connection strong")?.textContent?.trim()),
    undefined,
    { timeout: 45_000 },
  );
  const engineText =
    (await page.locator(".bridge-connection > div:first-child strong").textContent())?.trim() ?? "";
  const connectionError =
    (
      await page
        .locator(".bridge-fallback")
        .textContent()
        .catch(() => null)
    )?.trim() ?? null;

  if (!/engine found$/i.test(engineText)) {
    assert(engineText === "Local engine not connected", `Unexpected engine state: ${engineText}`);
    const fallback = page.getByRole("button", { name: "Open local workspace with this project" });
    assert((await fallback.count()) === 1, "Policy-blocked connection omitted the local fallback.");
    const popupPromise = page.waitForEvent("popup");
    await fallback.click();
    const localPage = await popupPromise;
    await localPage.waitForLoadState("domcontentloaded");
    await localPage
      .getByText("Project transferred from the public workspace.", { exact: false })
      .waitFor({ timeout: 30_000 });
    assert(
      (await localPage.getByLabel("Public GitHub repository", { exact: true }).inputValue()) ===
        repositoryUrl,
      "Fallback transfer lost the repository URL.",
    );
    await localPage.getByRole("button", { name: "Analyze repository", exact: true }).click();
    const localUnderstanding = localPage.getByRole("heading", {
      name: "Here’s what PitchFlow understood.",
    });
    const localAnalysisError = localPage.locator(".error-banner");
    await Promise.race([
      localUnderstanding.waitFor({ timeout: 120_000 }),
      localAnalysisError.waitFor({ timeout: 120_000 }).then(async () => {
        throw new Error(
          `Local fallback analysis failed: ${(await localAnalysisError.textContent())?.trim() ?? "unknown error"}`,
        );
      }),
    ]);
    assert(
      (await localPage.locator(".capture-list li").count()) === capturePaths.length,
      "Fallback transfer lost captures.",
    );
    const screenshotPath = join(output, "edge-policy-fallback-full.png");
    await page.screenshot({ path: screenshotPath, fullPage: true, animations: "disabled" });
    const report = {
      status: "policy-blocked-fallback-pass",
      checkedAt: new Date().toISOString(),
      browser: { name: "Microsoft Edge", version: browser.version(), headless: true },
      url: baseUrl.origin,
      permissionState,
      engineText,
      connectionError,
      projectTransfer: {
        repositoryUrl,
        captures: capturePaths.length,
        credentialsTransferred: false,
      },
      screenshot: relative(root, screenshotPath),
      consoleErrors,
    };
    await writeFile(
      join(output, "edge-connected-browser-qa.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = 0;
  } else {
    const pair = page.getByRole("button", { name: "Pair this browser" });
    await pair.waitFor();
    await pair.click();
    await page
      .getByText("Approve this short-lived request in the local PitchFlow window.")
      .waitFor();

    const localPage = await context.newPage();
    await localPage.goto("http://127.0.0.1:3210/", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await localPage
      .getByRole("heading", { name: "Allow this PitchFlow project?" })
      .waitFor({ timeout: 30_000 });
    assert(
      (await localPage.getByText(repositoryUrl, { exact: true }).count()) === 1,
      "Local approval shows the wrong repository.",
    );
    await localPage.getByRole("button", { name: "Approve pairing" }).click();

    const start = page.getByRole("button", { name: "Generate complete launch package" });
    await start.waitFor({ timeout: 30_000 });
    await start.click();
    await page.getByRole("button", { name: "Cancel generation" }).waitFor({ timeout: 30_000 });

    const deadline = Date.now() + 35 * 60 * 1_000;
    let lastMessage = "";
    while (Date.now() < deadline) {
      const job = page.locator(".bridge-job");
      const message = (await job.locator(".bridge-job-heading strong").textContent())?.trim() ?? "";
      const value = Number(await job.locator("progress").getAttribute("value"));
      if (message && message !== lastMessage) {
        progress.push({ at: new Date().toISOString(), message, value });
        process.stdout.write(`${value}% ${message}\n`);
        lastMessage = message;
      }
      if (
        await page
          .getByRole("heading", { name: "Your generated launch campaign is ready." })
          .isVisible()
      )
        break;
      const alert = page.locator(".bridge-job [role=alert]");
      if (await alert.isVisible())
        throw new Error((await alert.textContent()) ?? "Bridge job failed.");
      await page.waitForTimeout(1_500);
    }
    await page
      .getByRole("heading", { name: "Your generated launch campaign is ready." })
      .waitFor({ timeout: 5_000 });
    assert(
      await page.getByText("VibePalette", { exact: true }).first().isVisible(),
      "Fresh result is not VibePalette.",
    );

    for (const name of ["Website", "Images", "Videos", "Copy", "Export"] as const) {
      const tab = page.getByRole("tab", { name, exact: true });
      await tab.click();
      assert(
        (await tab.getAttribute("aria-selected")) === "true",
        `${name} result tab did not activate.`,
      );
    }

    const downloadPromise = page.waitForEvent("download", { timeout: 180_000 });
    await page.getByRole("button", { name: "Download complete launch package" }).click();
    const download = await downloadPromise;
    const downloadPath = join(output, "edge-vibepalette-launch-package.zip");
    await download.saveAs(downloadPath);
    const downloadBytes = await readFile(downloadPath);
    assert(
      downloadBytes.byteLength > 50 * 1024 * 1024,
      "Downloaded launch package is unexpectedly small.",
    );
    await page.getByText(`Downloaded ${download.suggestedFilename()}.`, { exact: true }).waitFor();

    const screenshotPath = join(output, "edge-connected-result-1440x1000-full.png");
    const screenshotBytes = await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      animations: "disabled",
    });
    const screenshotMetadata = await sharp(screenshotBytes).metadata();
    const browserStorage = await page.evaluate(() => ({
      local: Object.fromEntries(Object.entries(localStorage)),
      session: Object.fromEntries(Object.entries(sessionStorage)),
      href: location.href,
    }));
    assert(
      Object.keys(browserStorage.local).length === 0,
      "Session data leaked into localStorage.",
    );
    assert(
      Object.keys(browserStorage.session).length === 0,
      "Session data leaked into sessionStorage.",
    );
    assert(!/[A-Za-z0-9_-]{43}/.test(browserStorage.href), "A token leaked into the public URL.");
    assert(consoleErrors.length === 0, `Browser console errors: ${consoleErrors.join(" | ")}`);

    const report = {
      status: "connected-result-pass",
      checkedAt: new Date().toISOString(),
      browser: { name: "Microsoft Edge", version: browser.version(), headless: true },
      url: baseUrl.origin,
      permissionState,
      engineText,
      repositoryUrl,
      captures: capturePaths.map((path) => basename(path)),
      localApproval: true,
      progress,
      deliveryTabs: ["Website", "Images", "Videos", "Copy", "Export"],
      download: {
        filename: download.suggestedFilename(),
        bytes: downloadBytes.byteLength,
        sha256: sha256(downloadBytes),
        localPathIgnored: relative(root, downloadPath),
      },
      screenshot: {
        path: relative(root, screenshotPath),
        width: screenshotMetadata.width,
        height: screenshotMetadata.height,
        bytes: screenshotBytes.byteLength,
        sha256: sha256(screenshotBytes),
      },
      persistentBrowserStorage: false,
      tokenInUrl: false,
      consoleErrors,
    };
    await writeFile(
      join(output, "edge-connected-browser-qa.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }
} finally {
  await browser.close();
}
