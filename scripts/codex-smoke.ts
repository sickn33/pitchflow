import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";

import { generateCampaignWithCodex, inspectCodexAuth } from "@pitchflow/codex";
import {
  RepoSnapshotSchema,
  auditManifestEvidence,
  type CampaignPreferences,
} from "@pitchflow/core";

import { requiredArgument } from "./arguments";

const inputPath = resolve(requiredArgument("snapshot"));
const outputPath = resolve(requiredArgument("output"));
const root = resolve(process.cwd());
for (const path of [inputPath, outputPath]) {
  if (!path.startsWith(`${root}${sep}`)) {
    throw new Error("Codex smoke inputs and outputs must remain inside the PitchFlow repository.");
  }
}

const auth = await inspectCodexAuth();
if (!auth.authenticated) {
  throw new Error(
    "Local Codex authentication is required. Run the project-local Codex login first.",
  );
}
const snapshot = RepoSnapshotSchema.parse(JSON.parse(await readFile(inputPath, "utf8")));
const preferences: CampaignPreferences = {
  audience: "Indie developers, open-source maintainers, and developer-tool teams",
  positioning:
    "A precise launch narrative that makes the repository's proven value immediately understandable",
  visualDirection:
    "Use only truthful product captures in a precise, high-contrast developer-tool visual system",
  tone: "precise",
  channels: ["x", "linkedin", "product-hunt", "email"],
};
const startedAt = new Date().toISOString();
const manifest = await generateCampaignWithCodex(snapshot, preferences, {
  workingDirectory: root,
});
const audit = auditManifestEvidence(manifest, snapshot);
if (!audit.valid) throw new Error(`Evidence audit failed: ${audit.errors.join("; ")}`);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
const reportPath = outputPath.replace(/\.json$/i, "-report.json");
const relativeManifestPath = relative(root, outputPath);
const relativeReportPath = relative(root, reportPath);
await writeFile(
  reportPath,
  `${JSON.stringify(
    {
      status: "ok",
      startedAt,
      completedAt: new Date().toISOString(),
      repository: snapshot.repository.canonicalUrl,
      commitSha: snapshot.commitSha,
      provider: manifest.generation.provider,
      model: manifest.generation.model,
      promptVersion: manifest.generation.promptVersion,
      threadId: manifest.generation.threadId,
      repairAttempts: manifest.generation.repairAttempts,
      usage: manifest.generation.usage,
      evidenceAudit: audit,
      codex: {
        authenticated: auth.authenticated,
        method: auth.method,
        cliVersion: auth.cliVersion,
        credentialValuesRead: auth.credentialValuesRead,
      },
      manifestPath: relativeManifestPath,
      credentialValuesPrinted: false,
    },
    null,
    2,
  )}\n`,
  { flag: "wx" },
);
console.log(
  JSON.stringify(
    {
      status: "ok",
      model: manifest.generation.model,
      threadId: manifest.generation.threadId,
      claims: manifest.claims.length,
      evidenceLinks: audit.checkedLinks,
      manifestPath: relativeManifestPath,
      reportPath: relativeReportPath,
      credentialValuesPrinted: false,
    },
    null,
    2,
  ),
);
