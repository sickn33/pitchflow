import { describe, expect, it } from "vitest";

import {
  approveCampaignClaim,
  buildLocalWorkspaceDeepLink,
  canonicalGitHubRepositoryUrl,
  editCampaignClaim,
  evidenceAnchorId,
  evidenceAnchorsForClaim,
  pendingClaimCount,
} from "./product-flow";

const pendingClaim = {
  id: "claim_pending",
  text: "PitchFlow can save launch teams a week.",
  classification: "supported_inference" as const,
  confidence: 0.72,
  evidenceIds: ["ev_0123456789ab", "ev_abcdef012345"],
  evidencePath: "README.md",
  evidenceExcerpt: "PitchFlow creates the complete launch package.",
  approvalRequired: true,
  rationale: "The time saving is an inference that needs a human decision.",
};

describe("product flow contracts", () => {
  it("keeps evidence route anchors stable for every claim source", () => {
    expect(evidenceAnchorId("ev_0123456789ab")).toBe("evidence-ev_0123456789ab");
    expect(evidenceAnchorsForClaim(pendingClaim)).toEqual([
      "evidence-ev_0123456789ab",
      "evidence-ev_abcdef012345",
    ]);
  });

  it("turns a reviewed inference into an exportable user-approved claim", () => {
    const campaign = { claims: [pendingClaim] };

    expect(pendingClaimCount(campaign)).toBe(1);
    const approved = approveCampaignClaim(campaign, pendingClaim.id);

    expect(pendingClaimCount(approved)).toBe(0);
    expect(approved.claims[0]).toMatchObject({
      approvalRequired: false,
      classification: "user_supplied",
      confidence: 1,
      rationale: "Reviewed and approved by the local user after generation.",
    });
  });

  it("does not mutate unrelated or already-reviewed claims", () => {
    const reviewed = { ...pendingClaim, approvalRequired: false };
    const campaign = { claims: [pendingClaim, reviewed] };

    const approved = approveCampaignClaim(campaign, "missing_claim");

    expect(approved.claims).toEqual(campaign.claims);
  });

  it("keeps every claim editable and records the local user as its source", () => {
    const fact = { ...pendingClaim, classification: "fact" as const, approvalRequired: false };
    const edited = editCampaignClaim({ claims: [fact] }, fact.id, "A tighter launch claim.");

    expect(edited.claims[0]).toMatchObject({
      text: "A tighter launch claim.",
      classification: "user_supplied",
      confidence: 1,
      approvalRequired: false,
    });
  });

  it("preserves a canonical public repository in the encoded local deep-link", () => {
    const repositoryUrl = "https://github.com/sickn33/pitchflow";
    const deepLink = new URL(buildLocalWorkspaceDeepLink(repositoryUrl));

    expect(deepLink.origin).toBe("http://127.0.0.1:3210");
    expect(deepLink.searchParams.get("repo")).toBe(repositoryUrl);
    expect(canonicalGitHubRepositoryUrl(repositoryUrl)).toBe(repositoryUrl);
  });

  it("rejects non-canonical or request-controlled repository URLs", () => {
    expect(() => buildLocalWorkspaceDeepLink("https://evil.example/sickn33/pitchflow")).toThrow(
      /canonical public GitHub/i,
    );
    expect(() =>
      buildLocalWorkspaceDeepLink("https://github.com/sickn33/pitchflow/issues/1"),
    ).toThrow(/canonical public GitHub/i);
  });
});
