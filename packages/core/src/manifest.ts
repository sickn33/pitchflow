import { createHash } from "node:crypto";

import {
  CampaignDraftSchema,
  CampaignManifestSchema,
  PITCHFLOW_PROMPT_VERSION,
  PITCHFLOW_SCHEMA_VERSION,
  type CampaignDraft,
  type CampaignManifest,
  type RepoSnapshot,
} from "./schema";

export type ManifestGeneration = CampaignManifest["generation"];

export function finalizeCampaignManifest(
  draftInput: CampaignDraft,
  snapshot: RepoSnapshot,
  generation: ManifestGeneration,
  version = 1,
): CampaignManifest {
  const draft = CampaignDraftSchema.parse(draftInput);
  const evidenceById = new Map(snapshot.evidence.map((item) => [item.id, item]));
  const assertEvidenceIds = (label: string, ids: string[]) => {
    for (const id of ids) {
      if (!evidenceById.has(id)) throw new Error(`${label} references missing evidence ${id}.`);
    }
  };
  const claims = draft.claims.map((claim) => {
    const firstEvidence = evidenceById.get(claim.evidenceIds[0] ?? "");
    if (!firstEvidence) {
      throw new Error(`Claim ${claim.id} references missing evidence.`);
    }
    assertEvidenceIds(`Claim ${claim.id}`, claim.evidenceIds);
    return {
      ...claim,
      evidencePath: firstEvidence.path,
      evidenceExcerpt: firstEvidence.excerpt,
      approvalRequired: claim.classification === "supported_inference",
    };
  });

  const sceneCount = draft.videoScenes.length;
  const durationSeconds = Math.min(40, Math.max(25, sceneCount * 6));
  const totalFrames = durationSeconds * 30;
  const baseFrames = Math.floor(totalFrames / sceneCount);
  let cursor = 0;
  const scenes = draft.videoScenes.map((scene, index) => {
    assertEvidenceIds(`Video scene ${index + 1}`, scene.evidenceIds);
    const durationFrames = index === sceneCount - 1 ? totalFrames - cursor : baseFrames;
    const result = { ...scene, index: index + 1, startFrame: cursor, durationFrames };
    cursor += durationFrames;
    return result;
  });

  const identity = createHash("sha256")
    .update(JSON.stringify([snapshot.id, version, draft.productBrief.oneLiner]))
    .digest("hex")
    .slice(0, 16);

  for (const section of draft.sections) {
    assertEvidenceIds(`Campaign section ${section.id}`, section.evidenceIds);
  }
  for (const slide of draft.carousel) {
    assertEvidenceIds(`Carousel slide ${slide.index}`, slide.evidenceIds);
  }
  assertEvidenceIds("Product brief", draft.productBrief.evidenceIds);
  for (const [index, card] of draft.socialCards.entries()) {
    assertEvidenceIds(`Social card ${index + 1}`, card.evidenceIds);
  }
  assertEvidenceIds("Channel copy", draft.copy.evidenceIds);

  return CampaignManifestSchema.parse({
    schemaVersion: PITCHFLOW_SCHEMA_VERSION,
    id: `campaign_${identity}`,
    version,
    source: {
      snapshotId: snapshot.id,
      repositoryUrl: snapshot.repository.canonicalUrl,
      commitSha: snapshot.commitSha,
    },
    generation: {
      ...generation,
      promptVersion: PITCHFLOW_PROMPT_VERSION,
    },
    productBrief: draft.productBrief,
    claims,
    design: draft.design,
    sections: draft.sections,
    socialCards: draft.socialCards,
    carousel: draft.carousel,
    copy: draft.copy,
    video: { fps: 30, durationSeconds, scenes },
  });
}

function firstEvidence(snapshot: RepoSnapshot, kind?: RepoSnapshot["evidence"][number]["kind"]) {
  return snapshot.evidence.find((item) => !kind || item.kind === kind) ?? snapshot.evidence[0];
}

export function createDeterministicCampaignDraft(snapshot: RepoSnapshot): CampaignDraft {
  const metadata = firstEvidence(snapshot, "repository_metadata");
  const readme = firstEvidence(snapshot, "readme") ?? metadata;
  const tree = firstEvidence(snapshot, "source_tree") ?? metadata;
  if (!metadata || !readme || !tree) throw new Error("The snapshot has insufficient evidence.");

  const productName = snapshot.repository.name;
  const description =
    snapshot.repository.description ?? `An open-source project named ${productName}`;
  const claimInputs = [
    { evidence: metadata, text: description, id: "claim_repo_purpose" },
    {
      evidence: readme,
      text: `The repository documents ${productName} in ${readme.path ?? "its project metadata"}.`,
      id: "claim_documented_project",
    },
    {
      evidence: tree,
      text: `PitchFlow analyzed ${snapshot.limits.discoveredFiles} commit-pinned repository files without executing them.`,
      id: "claim_bounded_analysis",
    },
  ];

  const claims = claimInputs.map(({ evidence, text, id }) => ({
    id,
    text,
    classification: "fact" as const,
    confidence: 0.9,
    evidenceIds: [evidence.id],
    rationale: `Directly supported by ${evidence.label}.`,
  }));

  const evidenceIds = claims.map((claim) => claim.evidenceIds[0]);
  return CampaignDraftSchema.parse({
    productBrief: {
      productName,
      oneLiner: description.slice(0, 180),
      problem: `${productName} addresses the problem described by its maintainers, presented here without unsupported claims.`,
      audience: ["Developers evaluating the repository", "Open-source maintainers"],
      positioning: `A repository-grounded introduction to ${productName}, pinned to commit ${snapshot.commitSha.slice(0, 7)}.`,
      tone: "precise",
      differentiators: ["Commit-pinned evidence", "Transparent source links"],
      evidenceIds: [metadata.id, readme.id],
    },
    claims,
    design: {
      accent: "#9CFFB8",
      accentAlt: "#FFB86B",
      background: "#0A0A0B",
      surface: "#17181B",
      text: "#F5F4EF",
      muted: "#9B9DA4",
      radius: 18,
      displayFont: "system-sans",
    },
    sections: [
      {
        id: "hero",
        eyebrow: "Repository-native launch",
        heading: description,
        body: `Pinned to ${snapshot.commitSha.slice(0, 7)}.`,
        evidenceIds: [metadata.id],
      },
      {
        id: "problem",
        eyebrow: "The problem",
        heading: "Good software still needs a clear story.",
        body: `This campaign stays inside the evidence published by ${snapshot.repository.owner}.`,
        evidenceIds: [readme.id],
      },
      {
        id: "features",
        eyebrow: "What the repo proves",
        heading: claims[0]?.text ?? description,
        body: claims[1]?.text ?? description,
        evidenceIds: evidenceIds.filter(Boolean),
      },
      {
        id: "workflow",
        eyebrow: "Evidence flow",
        heading: "Repository to source-linked narrative.",
        body: "Every factual claim carries its supporting repository record.",
        evidenceIds: [tree.id],
      },
      {
        id: "cta",
        eyebrow: "Explore the source",
        heading: `See ${productName} at the analyzed commit.`,
        body: "Review the evidence before adopting the message.",
        evidenceIds: [metadata.id],
      },
    ],
    socialCards: [
      { headline: description, evidenceIds: [metadata.id] },
      { headline: `Pinned to ${snapshot.commitSha.slice(0, 7)}`, evidenceIds: [metadata.id] },
      { headline: "Claims you can inspect", evidenceIds: [readme.id] },
    ],
    carousel: Array.from({ length: 5 }, (_, index) => ({
      index: index + 1,
      eyebrow: index === 0 ? "Meet the project" : `Evidence ${index}`,
      headline:
        index === 0 ? productName : (claims[(index - 1) % claims.length]?.text ?? description),
      body: index === 4 ? "Open the repository. Inspect the proof." : description,
      evidenceIds: [snapshot.evidence[index % snapshot.evidence.length]?.id ?? metadata.id],
    })),
    copy: {
      x: `${productName}: ${description}\n\nA source-linked launch story pinned to ${snapshot.commitSha.slice(0, 7)}.`,
      linkedIn: `Introducing ${productName}.\n\n${description}\n\nThis launch package was derived from public, commit-pinned repository evidence.`,
      productHunt: {
        name: productName.slice(0, 60),
        tagline: description.slice(0, 60),
        description,
        firstComment: `We built this launch story from the repository at ${snapshot.commitSha.slice(0, 7)} and kept every factual claim linked to evidence.`,
      },
      email: {
        subject: `Meet ${productName}`,
        body: `${description}\n\nExplore the repository and its evidence-linked story.`,
      },
      headlineVariants: [
        description.slice(0, 120),
        `Meet ${productName}`,
        `${productName}, grounded in its source`,
      ],
      ctaVariants: ["Inspect the evidence", "Explore the repository", "See the source"],
      evidenceIds: evidenceIds.filter((id): id is string => Boolean(id)),
    },
    videoScenes: [
      {
        title: productName,
        audienceCaption: description,
        visualDirection: "Open quickly on the product identity and its real interface capture.",
        evidenceIds: [metadata.id],
        visual: "opening",
      },
      {
        title: "Start with the repository",
        audienceCaption: `Source truth pinned to ${snapshot.commitSha.slice(0, 7)}.`,
        visualDirection: "Show the real repository capture and highlight the pinned commit.",
        evidenceIds: [metadata.id],
        visual: "repository",
      },
      {
        title: "Keep the proof attached",
        audienceCaption: claims[0]?.text ?? description,
        visualDirection: "Pair the factual claim with its visible evidence record.",
        evidenceIds: [readme.id],
        visual: "evidence",
      },
      {
        title: "Shape the launch",
        audienceCaption: "Review positioning, claims, visuals, and channel copy.",
        visualDirection: "Move through the real campaign workspace controls and preview.",
        evidenceIds: [tree.id],
        visual: "workspace",
      },
      {
        title: "Export the whole story",
        audienceCaption: "Site, social, carousel, video, and copy from one manifest.",
        visualDirection: "Show real generated outputs moving into their destination formats.",
        evidenceIds: [metadata.id],
        visual: "exports",
      },
      {
        title: "Ship the code. Ship the story.",
        audienceCaption: `Explore ${productName} in the source repository.`,
        visualDirection: "Close on product name, canonical repository URL, and a clear CTA.",
        evidenceIds: [metadata.id],
        visual: "closing",
      },
    ],
  });
}
