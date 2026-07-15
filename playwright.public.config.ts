import { existsSync } from "node:fs";

import { defineConfig } from "@playwright/test";

const systemBrowsers = [
  process.env.PITCHFLOW_CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter((candidate): candidate is string => Boolean(candidate));

const executablePath = systemBrowsers.find((candidate) => existsSync(candidate));
if (!executablePath) {
  throw new Error(
    "PitchFlow public verification requires local Chrome/Edge/Chromium. Set PITCHFLOW_CHROME_PATH when it is not in a standard location.",
  );
}

export default defineConfig({
  testDir: "./tests/public-e2e",
  outputDir: "./test-results-public",
  timeout: 240_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-public" }]],
  use: {
    baseURL: "http://127.0.0.1:3211",
    browserName: "chromium",
    launchOptions: { executablePath },
    viewport: { width: 1440, height: 1000 },
    colorScheme: "dark",
    contextOptions: { reducedMotion: "reduce" },
    acceptDownloads: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: {
    command: "PITCHFLOW_PUBLIC_VIEWER=1 PITCHFLOW_PORT=3211 pnpm --filter @pitchflow/web start",
    url: "http://127.0.0.1:3211/api/status",
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
  },
});
