import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import { containsBinaryData, redactPotentialSecrets } from "@pitchflow/core";

import { argumentValue } from "./arguments";

const execFileAsync = promisify(execFile);
const root = resolve(process.cwd());
const syntheticFixtureFiles = new Set([
  "packages/codex/src/generate.test.ts",
  "packages/core/src/github.test.ts",
  "packages/core/src/github-url.test.ts",
  "packages/core/src/security.test.ts",
  "packages/core/src/security.ts",
]);
const binaryExtensions = new Set([
  ".aiff",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".mp3",
  ".mp4",
  ".pdf",
  ".png",
  ".ttf",
  ".webm",
  ".woff",
  ".woff2",
  ".zip",
]);

const { stdout } = await execFileAsync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  },
);
const files = stdout.split("\0").filter(Boolean).sort();
const findings: Array<{ path: string; kind: string }> = [];
let textFilesScanned = 0;

for (const filename of files) {
  if (filename.startsWith(".git/") || syntheticFixtureFiles.has(filename)) continue;
  if (
    filename === ".env" ||
    filename.endsWith("/.env") ||
    /(^|\/)(?:auth|credentials|secrets?|tokens?|session)\.json$/i.test(filename)
  ) {
    findings.push({ path: filename, kind: "sensitive-filename" });
    continue;
  }
  if (binaryExtensions.has(extname(filename).toLowerCase())) continue;
  const absolute = resolve(root, filename);
  if (!absolute.startsWith(`${root}${sep}`)) {
    findings.push({ path: filename, kind: "path-boundary" });
    continue;
  }
  let content: string;
  try {
    content = await readFile(absolute, "utf8");
  } catch {
    continue;
  }
  if (containsBinaryData(content)) continue;
  textFilesScanned += 1;
  if (redactPotentialSecrets(content) !== content) {
    findings.push({ path: relative(root, absolute), kind: "potential-secret" });
  }
}

const result = {
  format: "pitchflow-secret-audit",
  version: 1,
  generatedAt: new Date().toISOString(),
  status: findings.length === 0 ? "ok" : "failed",
  filesConsidered: files.length,
  textFilesScanned,
  syntheticFixtureExclusions: [...syntheticFixtureFiles].sort(),
  findings,
  credentialValuesPrinted: false,
};
const configuredOutput = argumentValue("output");
if (configuredOutput) {
  const output = resolve(configuredOutput);
  if (!output.startsWith(`${root}${sep}`)) {
    throw new Error("Secret audit output must remain inside the PitchFlow repository.");
  }
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}
console.log(JSON.stringify(result, null, 2));
if (findings.length > 0) process.exitCode = 1;
