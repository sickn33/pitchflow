import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

import { buildCodexEnvironment } from "./environment";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

export type CodexAuthStatus = {
  authenticated: boolean;
  method: "chatgpt" | "api-key" | "unknown";
  cliVersion: string | null;
  credentialValuesRead: false;
};

export function resolveProjectCodexCli(): string {
  const packageJson = require.resolve("@openai/codex/package.json");
  return resolve(dirname(packageJson), "bin/codex.js");
}

async function runCodexCommand(arguments_: string[]): Promise<string> {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [resolveProjectCodexCli(), ...arguments_],
    {
      encoding: "utf8",
      env: buildCodexEnvironment(),
      maxBuffer: 256 * 1024,
      timeout: 15_000,
    },
  );
  return `${stdout}\n${stderr}`;
}

export async function inspectCodexAuth(): Promise<CodexAuthStatus> {
  let cliVersion: string | null = null;
  try {
    const versionOutput = await runCodexCommand(["--version"]);
    cliVersion = versionOutput.match(/codex-cli\s+([^\s]+)/)?.[1] ?? null;
  } catch {
    return { authenticated: false, method: "unknown", cliVersion, credentialValuesRead: false };
  }

  try {
    const status = await runCodexCommand(["login", "status"]);
    const method = /using ChatGPT/i.test(status)
      ? "chatgpt"
      : /API key/i.test(status)
        ? "api-key"
        : "unknown";
    return {
      authenticated: /logged in/i.test(status),
      method,
      cliVersion,
      credentialValuesRead: false,
    };
  } catch {
    return { authenticated: false, method: "unknown", cliVersion, credentialValuesRead: false };
  }
}
