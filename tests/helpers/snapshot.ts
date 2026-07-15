import {
  PITCHFLOW_SCHEMA_VERSION,
  RepoSnapshotSchema,
  createEvidenceItem,
  snapshotIdentifier,
  type RepoSnapshot,
} from "@pitchflow/core";

const commitSha = "a".repeat(40);

export function createTestSnapshot(): RepoSnapshot {
  const sourceUrl = `https://github.com/acme/demo/tree/${commitSha}`;
  const evidence = [
    createEvidenceItem({
      kind: "repository_metadata",
      label: "GitHub repository metadata",
      path: null,
      excerpt: "Name: acme/demo\nDescription: A testable developer utility.",
      normalizedFact: "A testable developer utility.",
      sourceUrl,
      commitSha,
    }),
    createEvidenceItem({
      kind: "readme",
      label: "README.md",
      path: "README.md",
      excerpt: "# Demo\n\nDemo turns repository facts into a useful result.",
      normalizedFact: null,
      sourceUrl: `https://github.com/acme/demo/blob/${commitSha}/README.md`,
      commitSha,
    }),
    createEvidenceItem({
      kind: "source_tree",
      label: "Bounded repository tree",
      path: null,
      excerpt: "README.md (64 bytes)\npackage.json (120 bytes)\nsrc/index.ts (320 bytes)",
      normalizedFact: "3 files discovered",
      sourceUrl,
      commitSha,
    }),
  ];

  return RepoSnapshotSchema.parse({
    schemaVersion: PITCHFLOW_SCHEMA_VERSION,
    id: snapshotIdentifier("https://github.com/acme/demo", commitSha, evidence),
    repository: {
      owner: "acme",
      name: "demo",
      canonicalUrl: "https://github.com/acme/demo",
      description: "A testable developer utility.",
      homepage: "https://example.com/",
      defaultBranch: "main",
      licenseSpdx: "MIT",
      isArchived: false,
      isFork: false,
    },
    requestedRef: null,
    resolvedRef: "main",
    commitSha,
    capturedAt: "2026-07-15T04:00:00.000Z",
    languages: { TypeScript: 440 },
    tree: [
      { path: "README.md", size: 64, kind: "file" },
      { path: "package.json", size: 120, kind: "file" },
      { path: "src/index.ts", size: 320, kind: "file" },
    ],
    evidence,
    limits: {
      discoveredFiles: 3,
      includedFiles: 2,
      includedBytes: 184,
      truncatedTree: false,
    },
  });
}
