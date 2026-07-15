import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

import { argumentValue } from "./arguments";

type PackageRecord = {
  name: string;
  version: string;
  license: string;
  path: string;
};

const root = resolve(process.cwd());
const store = join(root, "node_modules", ".pnpm");
const disallowedLicense = /(?:^|\W)(?:AGPL|SSPL|BUSL|Commons Clause|UNLICENSED)(?:$|\W)/i;
const packages = new Map<string, PackageRecord>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function addPackage(directory: string): Promise<void> {
  try {
    const packagePath = join(directory, "package.json");
    const value: unknown = JSON.parse(await readFile(packagePath, "utf8"));
    if (typeof value !== "object" || value === null || Array.isArray(value)) return;
    const record = value as Record<string, unknown>;
    if (typeof record.name !== "string" || typeof record.version !== "string") return;
    const declaredLicense =
      typeof record.license === "string"
        ? record.license
        : Array.isArray(record.licenses)
          ? record.licenses
              .map((entry: unknown) =>
                typeof entry === "string"
                  ? entry
                  : isRecord(entry) && typeof entry.type === "string"
                    ? String(entry.type)
                    : "",
              )
              .filter(Boolean)
              .join(" OR ")
          : "MISSING";
    const license =
      declaredLicense === "MISSING" && /^@remotion\/compositor-[a-z0-9-]+$/i.test(record.name)
        ? "Remotion License (platform compositor binary)"
        : declaredLicense;
    const key = `${record.name}@${record.version}`;
    packages.set(key, {
      name: record.name,
      version: record.version,
      license,
      path: relative(root, directory),
    });
  } catch {
    // pnpm virtual-store entries may contain peers or metadata without a package root.
  }
}

for (const virtualEntry of await readdir(store, { withFileTypes: true })) {
  if (!virtualEntry.isDirectory() || virtualEntry.name.startsWith(".")) continue;
  const moduleRoot = join(store, virtualEntry.name, "node_modules");
  let entries;
  try {
    entries = await readdir(moduleRoot, { withFileTypes: true });
  } catch {
    continue;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    if (entry.name.startsWith("@")) {
      const scopeRoot = join(moduleRoot, entry.name);
      for (const scoped of await readdir(scopeRoot, { withFileTypes: true })) {
        if (scoped.isDirectory() || scoped.isSymbolicLink()) {
          await addPackage(join(scopeRoot, scoped.name));
        }
      }
    } else {
      await addPackage(join(moduleRoot, entry.name));
    }
  }
}

const inventory = [...packages.values()].sort((left, right) =>
  `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`),
);
const findings = inventory
  .filter((entry) => entry.license === "MISSING" || disallowedLicense.test(entry.license))
  .map(({ name, version, license }) => ({ name, version, license }));
const result = {
  format: "pitchflow-license-inventory",
  version: 1,
  generatedAt: new Date().toISOString(),
  packages: inventory,
  summary: {
    packageCount: inventory.length,
    uniqueLicenses: [...new Set(inventory.map((entry) => entry.license))].sort(),
    disallowedOrMissing: findings,
  },
};

const configuredOutput = argumentValue("output");
if (configuredOutput) {
  const output = resolve(configuredOutput);
  if (!output.startsWith(`${root}${sep}`)) {
    throw new Error("License inventory output must remain inside the PitchFlow repository.");
  }
  await mkdir(resolve(output, ".."), { recursive: true });
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}
console.log(
  JSON.stringify(
    {
      status: findings.length === 0 ? "ok" : "failed",
      packages: inventory.length,
      uniqueLicenses: result.summary.uniqueLicenses,
      findings,
      ...(configuredOutput ? { output: relative(root, resolve(configuredOutput)) } : {}),
    },
    null,
    2,
  ),
);
if (findings.length > 0) process.exitCode = 1;
