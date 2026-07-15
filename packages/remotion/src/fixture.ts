import type { CampaignManifest } from "@pitchflow/core";

import type { CaptureInput } from "./contracts";

const commitSha = "0123456789abcdef0123456789abcdef01234567";
const evidenceIds = ["ev_0123456789ab", "ev_123456789abc", "ev_23456789abcd"] as const;

export const DEFAULT_CAMPAIGN_MANIFEST: CampaignManifest = {
  schemaVersion: "1.1.0",
  id: "campaign_pitchflow_demo",
  version: 1,
  source: {
    snapshotId: "snapshot_pitchflow_demo",
    repositoryUrl: "https://github.com/sickn33/pitchflow",
    commitSha,
  },
  generation: {
    provider: "deterministic-fixture",
    model: "deterministic-fixture",
    promptVersion: "creative-director-2026-07-15.2",
    generatedAt: "2026-07-15T12:00:00.000Z",
    threadId: null,
    repairAttempts: 0,
    usage: null,
  },
  productBrief: {
    productName: "PitchFlow",
    oneLiner: "Turn a repository into an evidence-linked launch story.",
    problem: "Strong developer products often ship without a clear, verifiable launch narrative.",
    audience: ["Developer tool teams", "Open-source maintainers"],
    positioning: "A local-first creative workspace grounded in commit-pinned repository evidence.",
    tone: "precise",
    differentiators: ["Evidence-linked claims", "One reproducible campaign manifest"],
    evidenceIds: [...evidenceIds],
  },
  claims: evidenceIds.map((id, index) => ({
    id: `claim_pitchflow_${index}`,
    text: [
      "PitchFlow grounds campaign claims in repository evidence.",
      "One manifest drives every launch surface.",
      "The motion package is reproducible at 30 frames per second.",
    ][index]!,
    classification: "fact" as const,
    confidence: 0.95,
    evidenceIds: [id],
    evidencePath: index === 0 ? "README.md" : "packages/core/src/schema.ts",
    evidenceExcerpt: "Commit-pinned project evidence.",
    approvalRequired: false,
    rationale: "Supported by the analyzed repository snapshot.",
  })),
  design: {
    accent: "#A8FF78",
    accentAlt: "#FFB86B",
    background: "#090A0C",
    surface: "#17191E",
    text: "#F7F7F2",
    muted: "#9EA3AD",
    radius: 20,
    displayFont: "system-sans",
  },
  sections: [
    {
      id: "hero",
      eyebrow: "Repo-native launch",
      heading: "PitchFlow",
      body: "Evidence in. Launch story out.",
      evidenceIds: [evidenceIds[0]],
    },
    {
      id: "problem",
      eyebrow: "The problem",
      heading: "Code does not explain itself.",
      body: "PitchFlow finds the proof before shaping the message.",
      evidenceIds: [evidenceIds[0]],
    },
    {
      id: "evidence",
      eyebrow: "The method",
      heading: "Keep every claim attached.",
      body: "Review the source record behind the narrative.",
      evidenceIds: [evidenceIds[1]],
    },
    {
      id: "campaign",
      eyebrow: "One system",
      heading: "Direct the whole campaign.",
      body: "A single manifest coordinates copy, design, and motion.",
      evidenceIds: [evidenceIds[1]],
    },
    {
      id: "export",
      eyebrow: "Reproducible outputs",
      heading: "Render once. Adapt everywhere.",
      body: "Landscape and portrait share one verified timeline.",
      evidenceIds: [evidenceIds[2]],
    },
  ],
  socialCards: ["Evidence in", "Narrative aligned", "Launch ready"].map((headline, index) => ({
    headline,
    evidenceIds: [evidenceIds[index]!],
  })),
  carousel: Array.from({ length: 5 }, (_, index) => ({
    index: index + 1,
    eyebrow: `Step ${index + 1}`,
    headline: ["Inspect", "Prove", "Position", "Direct", "Ship"][index]!,
    body: "A source-linked step in the launch workflow.",
    evidenceIds: [evidenceIds[index % evidenceIds.length]!],
  })),
  copy: {
    x: "PitchFlow turns repository evidence into a coherent launch system.",
    linkedIn:
      "Meet PitchFlow: a local-first, source-grounded campaign workspace for developer tools.",
    productHunt: {
      name: "PitchFlow",
      tagline: "Ship the code. Ship the story.",
      description: "A repository-native launch studio with evidence-linked claims.",
      firstComment: "We built PitchFlow so the launch narrative stays connected to its source.",
    },
    email: { subject: "Meet PitchFlow", body: "Evidence in. Launch story out." },
    headlineVariants: ["Ship the story", "Launch from source", "Proof before promotion"],
    ctaVariants: ["Inspect the evidence", "Open the workspace", "Build the launch"],
    evidenceIds: [...evidenceIds],
  },
  video: {
    fps: 30,
    durationSeconds: 30,
    scenes: [
      {
        index: 1,
        startFrame: 0,
        durationFrames: 150,
        title: "PitchFlow",
        audienceCaption: "Evidence in. Launch story out.",
        visualDirection: "Internal test direction: kinetic title over a labeled fixture capture.",
        evidenceIds: [evidenceIds[0]],
        visual: "opening",
      },
      {
        index: 2,
        startFrame: 150,
        durationFrames: 150,
        title: "Start at the source",
        audienceCaption: "Read a public repository at one pinned commit.",
        visualDirection: "Internal test direction: advance the fixture capture with a source cue.",
        evidenceIds: [evidenceIds[0]],
        visual: "repository",
      },
      {
        index: 3,
        startFrame: 300,
        durationFrames: 150,
        title: "Keep the proof attached",
        audienceCaption: "Every factual claim points back to evidence.",
        visualDirection: "Internal test direction: emphasize the evidence rail on the fixture.",
        evidenceIds: [evidenceIds[1]],
        visual: "evidence",
      },
      {
        index: 4,
        startFrame: 450,
        durationFrames: 150,
        title: "Direct one campaign",
        audienceCaption: "Positioning, scenes, and channel copy move together.",
        visualDirection: "Internal test direction: pan across the labeled fixture capture.",
        evidenceIds: [evidenceIds[1]],
        visual: "workspace",
      },
      {
        index: 5,
        startFrame: 600,
        durationFrames: 150,
        title: "Adapt every format",
        audienceCaption: "One timeline renders landscape and portrait.",
        visualDirection: "Internal test direction: show the fixture inside format-safe framing.",
        evidenceIds: [evidenceIds[2]],
        visual: "exports",
      },
      {
        index: 6,
        startFrame: 750,
        durationFrames: 150,
        title: "Ship the code. Ship the story.",
        audienceCaption: "Build the launch from inspectable source evidence.",
        visualDirection: "Internal test direction: close on product name, canonical URL, and CTA.",
        evidenceIds: [evidenceIds[2]],
        visual: "closing",
      },
    ],
  },
};

export const TEST_FIXTURE_CAPTURE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

export function createTestFixtureCaptures(
  manifest: CampaignManifest = DEFAULT_CAMPAIGN_MANIFEST,
): CaptureInput[] {
  return manifest.video.scenes
    .filter((scene) => scene.visual !== "closing")
    .map((scene) => ({
      id: `test_fixture_scene_${scene.index}`,
      sceneIndex: scene.index,
      order: 0,
      alt: `TEST FIXTURE — NOT A PRODUCT CAPTURE · scene ${scene.index}`,
      source: { kind: "data-url" as const, dataUrl: TEST_FIXTURE_CAPTURE_DATA_URL },
    }));
}
