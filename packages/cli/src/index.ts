import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import open from "open";

import {
  buildWorkspaceEnvironment,
  HELP_TEXT,
  launcherMessages,
  parseLauncherArguments,
  waitForWorkspace,
  WORKSPACE_BUILD_PROCESS,
  workspaceProcess,
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

for (const message of launcherMessages(url)) console.log(message);

let stopping = false;
const readinessController = new AbortController();
let activeChild: ChildProcess | undefined;
const environment = buildWorkspaceEnvironment(options, repositoryRoot);

const stop = (signal: NodeJS.Signals) => {
  stopping = true;
  readinessController.abort(new Error(`PitchFlow stopped by ${signal}.`));
  activeChild?.kill(signal);
};

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

async function runProductionBuild(): Promise<void> {
  console.log("Preparing the production-safe local workspace...");
  const build = spawn(WORKSPACE_BUILD_PROCESS.command, [...WORKSPACE_BUILD_PROCESS.args], {
    cwd: repositoryRoot,
    env: environment,
    stdio: "inherit",
  });
  activeChild = build;

  const code = await new Promise<number>((resolveExit, rejectExit) => {
    build.once("error", rejectExit);
    build.once("close", (exitCode) => resolveExit(exitCode ?? 1));
  });
  if (code !== 0) {
    throw new Error(
      "Unable to prepare PitchFlow. Run `pnpm install`, then `pnpm --filter @pitchflow/web build`, and retry `pnpm pitchflow connect`.",
    );
  }
}

try {
  if (options.command === "connect") await runProductionBuild();
} catch (error) {
  if (!stopping) console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
  process.exit();
}

if (stopping) process.exit();

const processSpec = workspaceProcess(options.command);
const child = spawn(processSpec.command, [...processSpec.args], {
  cwd: repositoryRoot,
  env: environment,
  stdio: "inherit",
});
activeChild = child;

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
