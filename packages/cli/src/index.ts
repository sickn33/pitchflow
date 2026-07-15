import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import open from "open";

const packageDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(packageDirectory, "../../..");
const port = process.env.PITCHFLOW_PORT ?? "3210";
const url = `http://127.0.0.1:${port}`;

console.log(`PitchFlow local workspace: ${url}`);
console.log("Authenticated Codex generation remains on this machine.");

const child = spawn("pnpm", ["--filter", "@pitchflow/web", "dev"], {
  cwd: repositoryRoot,
  env: { ...process.env, PITCHFLOW_PORT: port, PITCHFLOW_PUBLIC_VIEWER: "0" },
  stdio: "inherit",
});

const openTimer = setTimeout(() => {
  void open(url, { wait: false });
}, 1800);

const stop = (signal: NodeJS.Signals) => {
  clearTimeout(openTimer);
  child.kill(signal);
};

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

child.on("exit", (code) => {
  clearTimeout(openTimer);
  process.exitCode = code ?? 1;
});
