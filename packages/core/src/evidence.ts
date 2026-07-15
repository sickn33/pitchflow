import { createHash } from "node:crypto";

import {
  CampaignManifestSchema,
  EvidenceItemSchema,
  type CampaignManifest,
  type EvidenceItem,
  type RepoSnapshot,
} from "./schema";
import { safeExcerpt } from "./security";

export function sha256(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

export function evidenceContentHash(excerpt: string): string {
  return `sha256:${sha256(excerpt)}`;
}

export function evidenceIdentifier(
  input: Pick<EvidenceItem, "kind" | "path" | "label" | "commitSha"> & {
    contentHash: string;
  },
): string {
  return `ev_${sha256(
    JSON.stringify([input.kind, input.path, input.label, input.contentHash, input.commitSha]),
  ).slice(0, 12)}`;
}

export function snapshotIdentifier(
  canonicalUrl: string,
  commitSha: string,
  evidence: Pick<EvidenceItem, "contentHash">[],
): string {
  return `snapshot_${sha256(
    JSON.stringify([canonicalUrl, commitSha, evidence.map((item) => item.contentHash)]),
  ).slice(0, 16)}`;
}

export function createEvidenceItem(
  input: Omit<EvidenceItem, "id" | "contentHash" | "excerpt"> & { excerpt: string },
): EvidenceItem {
  const excerpt = safeExcerpt(input.excerpt);
  const contentHash = evidenceContentHash(excerpt);
  const id = evidenceIdentifier({ ...input, contentHash });
  return EvidenceItemSchema.parse({ ...input, id, contentHash, excerpt });
}

export type SnapshotIntegrityAudit = {
  valid: boolean;
  errors: string[];
};

export function auditSnapshotIntegrity(snapshot: RepoSnapshot): SnapshotIntegrityAudit {
  const errors: string[] = [];
  for (const evidence of snapshot.evidence) {
    const expectedContentHash = evidenceContentHash(evidence.excerpt);
    if (evidence.contentHash !== expectedContentHash) {
      errors.push(`Evidence ${evidence.id} content hash does not match its excerpt.`);
    }
    const expectedId = evidenceIdentifier({ ...evidence, contentHash: expectedContentHash });
    if (evidence.id !== expectedId) {
      errors.push(`Evidence ${evidence.id} identifier does not match its canonical fields.`);
    }
    if (evidence.commitSha !== snapshot.commitSha) {
      errors.push(`Evidence ${evidence.id} is not pinned to the snapshot commit.`);
    }
  }
  const expectedSnapshotId = snapshotIdentifier(
    snapshot.repository.canonicalUrl,
    snapshot.commitSha,
    snapshot.evidence,
  );
  if (snapshot.id !== expectedSnapshotId) {
    errors.push("Snapshot identifier does not match its repository, commit, and evidence hashes.");
  }
  return { valid: errors.length === 0, errors };
}

export type EvidenceAudit = {
  valid: boolean;
  checkedClaims: number;
  checkedLinks: number;
  errors: string[];
};

export function auditManifestEvidence(
  manifestInput: CampaignManifest,
  snapshot: RepoSnapshot,
): EvidenceAudit {
  const manifest = CampaignManifestSchema.parse(manifestInput);
  const evidenceById = new Map(snapshot.evidence.map((item) => [item.id, item]));
  const errors: string[] = [];
  let checkedLinks = 0;

  const snapshotIntegrity = auditSnapshotIntegrity(snapshot);
  errors.push(...snapshotIntegrity.errors);

  if (manifest.source.snapshotId !== snapshot.id) {
    errors.push("Manifest snapshot ID does not match the supplied repository snapshot.");
  }
  if (manifest.source.commitSha !== snapshot.commitSha) {
    errors.push("Manifest commit SHA does not match the supplied repository snapshot.");
  }
  if (manifest.source.repositoryUrl !== snapshot.repository.canonicalUrl) {
    errors.push("Manifest repository URL does not match the supplied repository snapshot.");
  }

  const checkLinks = (label: string, evidenceIds: string[]) => {
    for (const id of evidenceIds) {
      checkedLinks += 1;
      const evidence = evidenceById.get(id);
      if (!evidence) {
        errors.push(`${label} references missing evidence ${id}.`);
        continue;
      }
      if (evidence.commitSha !== snapshot.commitSha) {
        errors.push(`Evidence ${id} is not pinned to ${snapshot.commitSha}.`);
      }
    }
  };

  for (const claim of manifest.claims) {
    checkLinks(`Claim ${claim.id}`, claim.evidenceIds);
    const firstEvidence = evidenceById.get(claim.evidenceIds[0] ?? "");
    if (firstEvidence && claim.evidenceExcerpt !== firstEvidence.excerpt) {
      errors.push(`Claim ${claim.id} excerpt differs from canonical evidence ${firstEvidence.id}.`);
    }
  }
  for (const section of manifest.sections) {
    checkLinks(`Campaign section ${section.id}`, section.evidenceIds);
  }
  for (const slide of manifest.carousel) {
    checkLinks(`Carousel slide ${slide.index}`, slide.evidenceIds);
  }
  for (const scene of manifest.video.scenes) {
    checkLinks(`Video scene ${scene.index}`, scene.evidenceIds);
  }
  checkLinks("Product brief", manifest.productBrief.evidenceIds);
  for (const [index, card] of manifest.socialCards.entries()) {
    checkLinks(`Social card ${index + 1}`, card.evidenceIds);
  }
  checkLinks("Channel copy", manifest.copy.evidenceIds);

  return {
    valid: errors.length === 0,
    checkedClaims: manifest.claims.length,
    checkedLinks,
    errors,
  };
}
