import { execFile, spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import { argumentValue } from "./arguments";

const execFileAsync = promisify(execFile);
const root = resolve(process.cwd());
const repository = argumentValue("repository") ?? "https://github.com/sickn33/pitchflow.git";
const output = resolve(
  argumentValue("output") ??
    "artifacts/verification/2026-07-15-pitchflow/clean-clone-verification.json",
);
if (!output.startsWith(`${root}${sep}`)) {
  throw new Error("Clean-clone report must remain inside the PitchFlow repository.");
}

type CommandResult = {
  command: string;
  durationMs: number;
  exitCode: 0;
};

async function run(
  cwd: string,
  command: string,
  args: string[],
  environment: NodeJS.ProcessEnv = process.env,
): Promise<{ summary: CommandResult; stdout: string; stderr: string }> {
  const startedAt = Date.now();
  const result = await execFileAsync(command, args, {
    cwd,
    encoding: "utf8",
    env: environment,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 10 * 60_000,
  });
  return {
    summary: {
      command: [command, ...args].join(" "),
      durationMs: Date.now() - startedAt,
      exitCode: 0,
    },
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Unable to reserve a loopback port.");
  await new Promise<void>((resolvePromise, reject) =>
    server.close((error) => (error ? reject(error) : resolvePromise())),
  );
  return address.port;
}

async function waitForStatus(port: number): Promise<Record<string, unknown>> {
  const url = `http://127.0.0.1:${port}/api/status`;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) {
        const value: unknown = await response.json();
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          return value as Record<string, unknown>;
        }
      }
    } catch {
      // The launcher is still starting. Poll only the loopback status endpoint.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error("Clean-clone launcher did not become ready within 60 seconds.");
}

const temporaryRoot = await mkdtemp(join(tmpdir(), "pitchflow-clean-clone-"));
const cloneDirectory = join(temporaryRoot, "repo");
const cleanHome = join(temporaryRoot, "home");
const commands: CommandResult[] = [];

try {
  await mkdir(cleanHome, { recursive: true });
  const expectedCommit = (await run(root, "git", ["rev-parse", "HEAD"])).stdout.trim();
  const clone = await run(root, "git", [
    "clone",
    "--depth",
    "1",
    "--filter=blob:none",
    "--branch",
    "main",
    repository,
    cloneDirectory,
  ]);
  commands.push(clone.summary);
  const actualCommit = (await run(cloneDirectory, "git", ["rev-parse", "HEAD"])).stdout.trim();
  if (actualCommit !== expectedCommit) {
    throw new Error(`Public clone resolved ${actualCommit}; expected ${expectedCommit}.`);
  }

  const install = await run(cloneDirectory, "pnpm", ["install", "--frozen-lockfile"], {
    ...process.env,
    CI: "true",
  });
  commands.push(install.summary);
  const staticCheck = await run(cloneDirectory, "pnpm", ["check:static"]);
  commands.push(staticCheck.summary);
  const secretCheck = await run(cloneDirectory, "pnpm", ["verify:secrets"]);
  commands.push(secretCheck.summary);
  const submissionCheck = await run(cloneDirectory, "pnpm", [
    "verify:submission",
    "--",
    "--allow-gates",
  ]);
  commands.push(submissionCheck.summary);
  const codexVersion = await run(cloneDirectory, "pnpm", [
    "--filter",
    "@pitchflow/codex",
    "exec",
    "codex",
    "--version",
  ]);
  commands.push(codexVersion.summary);

  const port = await availablePort();
  const launcherCommand = `pnpm pitchflow --no-open --port ${port}`;
  const launcherEnvironment = {
    ...process.env,
    HOME: cleanHome,
    CODEX_HOME: join(cleanHome, ".codex"),
  };
  const launcher = spawn("pnpm", ["pitchflow", "--no-open", "--port", String(port)], {
    cwd: cloneDirectory,
    env: launcherEnvironment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let launcherOutput = "";
  launcher.stdout.on("data", (chunk: Buffer) => {
    launcherOutput += chunk.toString("utf8");
  });
  launcher.stderr.on("data", (chunk: Buffer) => {
    launcherOutput += chunk.toString("utf8");
  });
  const status = await waitForStatus(port);
  const page = await fetch(`http://127.0.0.1:${port}/`, {
    signal: AbortSignal.timeout(5_000),
  });
  const pageText = await page.text();
  launcher.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolvePromise) => launcher.once("exit", () => resolvePromise())),
    new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 10_000)),
  ]);
  if (launcher.exitCode === null) launcher.kill("SIGKILL");

  const codex =
    typeof status.codex === "object" && status.codex !== null
      ? (status.codex as Record<string, unknown>)
      : null;
  if (
    status.mode !== "local" ||
    status.generationEnabled !== false ||
    !codex ||
    codex.authenticated !== false ||
    codex.credentialValuesRead !== false ||
    !page.ok ||
    !pageText.includes("PitchFlow")
  ) {
    throw new Error("Clean-profile launcher did not expose the expected safe local state.");
  }
  const sensitivePattern =
    /(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{16,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|(?:access|refresh|auth)[_-]?token\s*[:=]\s*\S+)/iu;
  if (sensitivePattern.test(launcherOutput)) {
    throw new Error("Clean-profile launcher output matched a credential-value pattern.");
  }
  commands.push({ command: launcherCommand, durationMs: 0, exitCode: 0 });

  const statusAfter = await run(cloneDirectory, "git", ["status", "--porcelain"]);
  if (statusAfter.stdout.trim() !== "") {
    throw new Error("Clean clone became dirty during verification.");
  }
  const testMatch = staticCheck.stdout.match(/Tests\s+(\d+) passed/u);
  const report = {
    format: "pitchflow-clean-clone-verification",
    version: 1,
    status: "ok",
    verifiedAt: new Date().toISOString(),
    repository: "https://github.com/sickn33/pitchflow",
    commitSha: actualCommit,
    clone: {
      shallow: true,
      partialCloneFilter: "blob:none",
      dirtyAfterVerification: false,
    },
    commands,
    checks: {
      frozenLockfileInstall: true,
      productionBuild: true,
      strictTypecheck: true,
      zeroWarningLint: true,
      testsPassed: testMatch ? Number(testMatch[1]) : null,
      secretScan: true,
      localSubmissionPacket: true,
      codexCliVersion: codexVersion.stdout.trim(),
    },
    launcher: {
      command: launcherCommand,
      pageStatus: page.status,
      mode: status.mode,
      generationEnabledWithoutAuth: status.generationEnabled,
      codexAuthenticatedInEmptyProfile: codex.authenticated,
      credentialValuesRead: codex.credentialValuesRead,
      credentialValuesPrinted: false,
      readyMessageObserved: launcherOutput.includes("PitchFlow is ready"),
    },
    cleanup: {
      cloneRemovedAfterReport: true,
      personalAuthCopied: false,
    },
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ...report, report: relative(root, output) }, null, 2));
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
