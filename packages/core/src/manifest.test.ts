import { describe, expect, it } from "vitest";

import { createTestSnapshot } from "../../../tests/helpers/snapshot";
import { auditManifestEvidence, createEvidenceItem, snapshotIdentifier } from "./evidence";
import { createDeterministicCampaignDraft, finalizeCampaignManifest } from "./manifest";
import { PITCHFLOW_PROMPT_VERSION } from "./schema";

describe("campaign manifest", () => {
  it("finalizes a typed deterministic draft with canonical evidence excerpts", () => {
    const snapshot = createTestSnapshot();
    const draft = createDeterministicCampaignDraft(snapshot);
    const manifest = finalizeCampaignManifest(draft, snapshot, {
      provider: "deterministic-fixture",
      model: "fixture-v1",
      promptVersion: PITCHFLOW_PROMPT_VERSION,
      generatedAt: "2026-07-15T04:30:00.000Z",
      threadId: null,
      repairAttempts: 0,
      usage: null,
    });

    expect(manifest.claims).toHaveLength(3);
    expect(manifest.carousel).toHaveLength(5);
    expect(manifest.video.durationSeconds).toBeGreaterThanOrEqual(25);
    expect(manifest.video.scenes.at(-1)?.startFrame).toBeGreaterThan(0);
    expect(auditManifestEvidence(manifest, snapshot)).toMatchObject({ valid: true });
  });

  it("rejects a draft that references nonexistent evidence", () => {
    const snapshot = createTestSnapshot();
    const draft = createDeterministicCampaignDraft(snapshot);
    draft.claims[0]!.evidenceIds = ["ev_000000000000"];
    expect(() =>
      finalizeCampaignManifest(draft, snapshot, {
        provider: "deterministic-fixture",
        model: "fixture-v1",
        promptVersion: PITCHFLOW_PROMPT_VERSION,
        generatedAt: "2026-07-15T04:30:00.000Z",
        threadId: null,
        repairAttempts: 0,
        usage: null,
      }),
    ).toThrow(/missing evidence/i);
  });

  it("rejects missing evidence in non-claim campaign surfaces", () => {
    const snapshot = createTestSnapshot();
    const draft = createDeterministicCampaignDraft(snapshot);
    draft.carousel[0]!.evidenceIds = ["ev_000000000000"];
    expect(() =>
      finalizeCampaignManifest(draft, snapshot, {
        provider: "deterministic-fixture",
        model: "fixture-v1",
        promptVersion: PITCHFLOW_PROMPT_VERSION,
        generatedAt: "2026-07-15T04:30:00.000Z",
        threadId: null,
        repairAttempts: 0,
        usage: null,
      }),
    ).toThrow(/Carousel slide 1 references missing evidence/i);
  });

  it("audits evidence links across sections, carousel slides, and video scenes", () => {
    const snapshot = createTestSnapshot();
    const manifest = finalizeCampaignManifest(
      createDeterministicCampaignDraft(snapshot),
      snapshot,
      {
        provider: "deterministic-fixture",
        model: "fixture-v1",
        promptVersion: PITCHFLOW_PROMPT_VERSION,
        generatedAt: "2026-07-15T04:30:00.000Z",
        threadId: null,
        repairAttempts: 0,
        usage: null,
      },
    );
    manifest.sections[0]!.evidenceIds = ["ev_000000000000"];

    expect(auditManifestEvidence(manifest, snapshot)).toMatchObject({
      valid: false,
      errors: [expect.stringMatching(/Campaign section hero references missing evidence/)],
    });
  });

  it("rejects snapshot evidence whose excerpt was changed without recomputing provenance", () => {
    const snapshot = createTestSnapshot();
    const manifest = finalizeCampaignManifest(
      createDeterministicCampaignDraft(snapshot),
      snapshot,
      {
        provider: "deterministic-fixture",
        model: "fixture-v1",
        promptVersion: PITCHFLOW_PROMPT_VERSION,
        generatedAt: "2026-07-15T04:30:00.000Z",
        threadId: null,
        repairAttempts: 0,
        usage: null,
      },
    );
    snapshot.evidence[0]!.excerpt = "Tampered after capture";

    const audit = auditManifestEvidence(manifest, snapshot);
    expect(audit.valid).toBe(false);
    expect(
      audit.errors.some((error) => /content hash does not match its excerpt/i.test(error)),
    ).toBe(true);
  });

  it("preserves the complete canonical evidence excerpt allowed by the snapshot schema", () => {
    const snapshot = createTestSnapshot();
    const evidence = snapshot.evidence[0]!;
    snapshot.evidence[0] = createEvidenceItem({
      kind: evidence.kind,
      label: evidence.label,
      path: evidence.path,
      excerpt: "A".repeat(1600),
      normalizedFact: evidence.normalizedFact,
      sourceUrl: evidence.sourceUrl,
      commitSha: evidence.commitSha,
    });
    snapshot.id = snapshotIdentifier(
      snapshot.repository.canonicalUrl,
      snapshot.commitSha,
      snapshot.evidence,
    );
    const draft = createDeterministicCampaignDraft(snapshot);
    const manifest = finalizeCampaignManifest(draft, snapshot, {
      provider: "deterministic-fixture",
      model: "fixture-v1",
      promptVersion: PITCHFLOW_PROMPT_VERSION,
      generatedAt: "2026-07-15T04:30:00.000Z",
      threadId: null,
      repairAttempts: 0,
      usage: null,
    });

    expect(manifest.claims[0]?.evidenceExcerpt).toHaveLength(1600);
    expect(auditManifestEvidence(manifest, snapshot)).toMatchObject({ valid: true });
  });
});
