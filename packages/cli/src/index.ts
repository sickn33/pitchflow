import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import open from "open";

import {
  HELP_TEXT,
  parseLauncherArguments,
  waitForWorkspace,
  type LauncherOptions,
} from "./launcher";

const packageDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(packageDirectory, "../../..");
let options: LauncherOptions;
try {
  options = parseLauncherArguments(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error("Run `pnpm pitchflow --help` for usage.");
  process.exitCode = 1;
  process.exit();
}

if (options.help) {
  console.log(HELP_TEXT);
  process.exit();
}

const port = String(options.port);
const url = `http://127.0.0.1:${port}`;

console.log(`Starting PitchFlow local workspace at ${url}`);
console.log("Authenticated Codex generation remains on this machine.");

const child = spawn("pnpm", ["--filter", "@pitchflow/web", "dev"], {
  cwd: repositoryRoot,
  env: {
    ...process.env,
    PITCHFLOW_PORT: port,
    PITCHFLOW_PUBLIC_VIEWER: "0",
    PITCHFLOW_REPOSITORY_ROOT: repositoryRoot,
  },
  stdio: "inherit",
});

let stopping = false;
const readinessController = new AbortController();

const readiness = waitForWorkspace(url, { signal: readinessController.signal })
  .then(async () => {
    console.log(`PitchFlow is ready: ${url}`);
    if (options.openBrowser) await open(url, { wait: false });
  })
  .catch((error: unknown) => {
    if (stopping || readinessController.signal.aborted) return;
    console.error(error instanceof Error ? error.message : String(error));
    stopping = true;
    child.kill("SIGTERM");
    process.exitCode = 1;
  });

const stop = (signal: NodeJS.Signals) => {
  stopping = true;
  readinessController.abort(new Error(`PitchFlow stopped by ${signal}.`));
  child.kill(signal);
};

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

child.on("exit", (code) => {
  stopping = true;
  readinessController.abort(new Error("PitchFlow web process exited before readiness."));
  if (code && code !== 0) process.exitCode = code;
});

child.on("error", (error) => {
  stopping = true;
  readinessController.abort(error);
  console.error(`Unable to start PitchFlow: ${error.message}`);
  process.exitCode = 1;
});

await readiness;
