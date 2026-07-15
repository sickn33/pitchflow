import type { CampaignManifest } from "@pitchflow/core";

type CampaignClaim = CampaignManifest["claims"][number];
type ReviewableCampaign = { claims: CampaignClaim[] };

export function evidenceAnchorId(evidenceId: string): `evidence-${string}` {
  return `evidence-${evidenceId}`;
}

export function evidenceAnchorsForClaim(claim: CampaignClaim): string[] {
  return claim.evidenceIds.map(evidenceAnchorId);
}

export function pendingClaimCount(campaign: ReviewableCampaign | null): number {
  return campaign?.claims.filter((claim) => claim.approvalRequired).length ?? 0;
}

export function approveCampaignClaim<T extends ReviewableCampaign>(
  campaign: T,
  claimId: string,
): T {
  return {
    ...campaign,
    claims: campaign.claims.map((claim) =>
      claim.id === claimId && claim.approvalRequired
        ? {
            ...claim,
            classification: "user_supplied" as const,
            confidence: 1,
            approvalRequired: false,
            rationale: "Reviewed and approved by the local user after generation.",
          }
        : claim,
    ),
  };
}

export function editCampaignClaim<T extends ReviewableCampaign>(
  campaign: T,
  claimId: string,
  text: string,
): T {
  if (text.trim().length === 0) return campaign;
  return {
    ...campaign,
    claims: campaign.claims.map((claim) =>
      claim.id === claimId
        ? {
            ...claim,
            text,
            classification: "user_supplied" as const,
            confidence: 1,
            approvalRequired: false,
            rationale: "Edited by the local user after generation; verify before publishing.",
          }
        : claim,
    ),
  };
}

export function canonicalGitHubRepositoryUrl(input: string): string {
  const url = new URL(input.trim());
  const segments = url.pathname.split("/").filter(Boolean);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    segments.length !== 2 ||
    !/^[A-Za-z0-9-]{1,39}$/.test(segments[0] ?? "") ||
    !/^[A-Za-z0-9._-]{1,100}$/.test(segments[1] ?? "")
  ) {
    throw new Error("Enter a canonical public GitHub repository URL.");
  }
  return `https://github.com/${segments[0]}/${segments[1]}`;
}

export function buildLocalWorkspaceDeepLink(repositoryUrl: string): string {
  const canonical = canonicalGitHubRepositoryUrl(repositoryUrl);
  const local = new URL("http://127.0.0.1:3210/");
  local.searchParams.set("repo", canonical);
  return local.href;
}
