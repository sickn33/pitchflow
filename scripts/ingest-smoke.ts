import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";

import { ingestPublicGitHubRepository } from "@pitchflow/core";

import { requiredArgument } from "./arguments";

const repositoryUrl = requiredArgument("repo");
const outputPath = resolve(requiredArgument("output"));
const root = resolve(process.cwd());
if (!outputPath.startsWith(`${root}${sep}`)) {
  throw new Error("Smoke evidence output must remain inside the PitchFlow repository.");
}

const snapshot = await ingestPublicGitHubRepository(repositoryUrl, {
  ...(process.env.GITHUB_TOKEN ? { githubToken: process.env.GITHUB_TOKEN } : {}),
});
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: "wx" });

console.log(
  JSON.stringify(
    {
      status: "ok",
      repository: snapshot.repository.canonicalUrl,
      commitSha: snapshot.commitSha,
      evidenceItems: snapshot.evidence.length,
      discoveredFiles: snapshot.limits.discoveredFiles,
      includedFiles: snapshot.limits.includedFiles,
      includedBytes: snapshot.limits.includedBytes,
      outputPath: relative(root, outputPath),
      credentialValuesPrinted: false,
    },
    null,
    2,
  ),
);
