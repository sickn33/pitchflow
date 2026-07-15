import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import { argumentValue } from "./arguments";

const execFileAsync = promisify(execFile);
const root = resolve(process.cwd());

type DependencyNode = {
  version?: unknown;
  resolved?: unknown;
  dependencies?: unknown;
};

type PackageVersion = { name: string; version: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectDependencies(value: unknown, packages: Map<string, PackageVersion>): void {
  if (!isRecord(value)) return;
  for (const [name, rawNode] of Object.entries(value)) {
    if (!isRecord(rawNode)) continue;
    const node = rawNode as DependencyNode;
    if (
      typeof node.version === "string" &&
      !node.version.startsWith("link:") &&
      typeof node.resolved === "string" &&
      node.resolved.startsWith("https://registry.npmjs.org/")
    ) {
      packages.set(`${name}@${node.version}`, { name, version: node.version });
    }
    collectDependencies(node.dependencies, packages);
  }
}

const { stdout } = await execFileAsync(
  "pnpm",
  ["list", "-r", "--prod", "--json", "--depth", "Infinity"],
  {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  },
);
const projects: unknown = JSON.parse(stdout);
if (!Array.isArray(projects)) throw new Error("pnpm did not return a production dependency graph.");
const packages = new Map<string, PackageVersion>();
for (const project of projects) {
  if (isRecord(project)) collectDependencies(project.dependencies, packages);
}
const inventory = [...packages.values()].sort((left, right) =>
  `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`),
);
if (inventory.length === 0) throw new Error("Production dependency inventory is empty.");

const response = await fetch("https://api.osv.dev/v1/querybatch", {
  method: "POST",
  headers: { "content-type": "application/json", accept: "application/json" },
  body: JSON.stringify({
    queries: inventory.map(({ name, version }) => ({
      package: { ecosystem: "npm", name },
      version,
    })),
  }),
  signal: AbortSignal.timeout(45_000),
});
if (!response.ok) {
  throw new Error(`OSV dependency audit failed with HTTP ${response.status}.`);
}
const responseValue: unknown = await response.json();
if (
  !isRecord(responseValue) ||
  !Array.isArray(responseValue.results) ||
  responseValue.results.length !== inventory.length
) {
  throw new Error("OSV dependency audit returned a malformed or incomplete result set.");
}

const findings: Array<Record<string, unknown>> = [];
for (const [index, result] of responseValue.results.entries()) {
  if (!isRecord(result) || !Array.isArray(result.vulns)) continue;
  for (const vulnerability of result.vulns) {
    if (!isRecord(vulnerability) || typeof vulnerability.id !== "string") continue;
    findings.push({
      package: inventory[index],
      id: vulnerability.id,
      aliases: Array.isArray(vulnerability.aliases)
        ? vulnerability.aliases.filter((value): value is string => typeof value === "string")
        : [],
      summary: typeof vulnerability.summary === "string" ? vulnerability.summary : null,
      modified: typeof vulnerability.modified === "string" ? vulnerability.modified : null,
    });
  }
}

const report = {
  format: "pitchflow-osv-audit",
  version: 1,
  generatedAt: new Date().toISOString(),
  endpoint: "https://api.osv.dev/v1/querybatch",
  productionPackages: inventory.length,
  findings,
  status: findings.length === 0 ? "ok" : "failed",
};
const configuredOutput = argumentValue("output");
if (configuredOutput) {
  const output = resolve(configuredOutput);
  if (!output.startsWith(`${root}${sep}`)) {
    throw new Error("Dependency audit output must remain inside the PitchFlow repository.");
  }
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
console.log(
  JSON.stringify(
    {
      ...report,
      ...(configuredOutput ? { output: relative(root, resolve(configuredOutput)) } : {}),
    },
    null,
    2,
  ),
);
if (findings.length > 0) process.exitCode = 1;
