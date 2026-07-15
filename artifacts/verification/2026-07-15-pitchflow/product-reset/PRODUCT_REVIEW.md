# PitchFlow product-reset review

Reviewed: 2026-07-15 CEST
Candidate: local public-mode source before deployment
Verdict: **PASS as the deployment candidate; Nicco's live approval is still required.**

## Blunt product read

The rejected build looked like proof assembled for an auditor. This candidate reads as a developer product.

Within the first viewport at both 1440×1000 and 390×844, a first-time visitor can identify:

- the input: a public GitHub repository followed by 2–4 real captures and launch direction;
- the transformation: repository understanding plus GPT-5.6 creative direction through local Codex;
- the outputs: Website, Images, Videos, Copy, and Export;
- the first action: Analyze repository or Try the PitchFlow demo;
- the boundary: the complete PitchFlow dogfood campaign is public, while a fresh repository moves into the developer's loopback-only Codex workspace.

The page is no longer a disconnected landing page. Analyze and Direct use the actual repository snapshot, manifest, direction controls, and creator-owned captures. Generate exposes the real local boundary and repository-preserving handoff. Deliver reuses the actual campaign canvas and immutable dogfood files. Export exposes the real package link with one dominant download action. `/evidence` remains discoverable but secondary.

The strongest remaining concern is density: the complete mobile journey is intentionally long because it contains the real website preview and output workspace, not a decorative summary. The first viewport and tab system still make the journey legible, and there is no root horizontal overflow. This is not a blocker for the requested product gate.

## Acceptance evidence

- Browser report: `local-public-browser-qa.json`
- Desktop full page: `local-public-desktop-1440x1000-full.png` — 1440×3805
- Mobile full page: `local-public-mobile-390x844-full.png` — 390×8182
- Desktop first-viewport output strip ends at 997.91 px.
- Mobile first-viewport output strip ends at 791.78 px.
- Root overflow: 0 px at both viewports.
- Serious/critical axe violations: 0 at both viewports.
- Console errors: 0.
- Public mutation requests during arbitrary-repository handoff: 0.
- Preserved handoff: `http://127.0.0.1:3210/?repo=https%3A%2F%2Fgithub.com%2Fopenai%2Fcodex`.
- Public Playwright: 4/4 passed.
- Local Playwright: 3/3 passed.

## Concept fidelity ledger

| Comparison point | Accepted concept | Implemented candidate | Result |
| --- | --- | --- | --- |
| Visual system | Near-black, off-white, restrained mint, graphite dividers | Same code-native token system; no gradients, glass, or neon | Match |
| Hero promise | Repo input to launch-ready site, social kit, and video | Exact locked headline and support copy | Match |
| Primary actions | Analyze repository plus Try the PitchFlow demo | Both present and operable above the fold | Match |
| Journey | Analyze → Direct → Generate → Deliver → Export | Ordered five-stage stepper plus exact numbered section markers | Match |
| Output contract | Website, Images, Videos, Copy, Export | Above-fold output strip and matching delivery tabs | Match |
| Media | Real product/site/social/landscape/portrait montage | Existing verified PitchFlow dogfood assets only | Match |
| Direction | Audience, positioning, tone, channels, visual direction, captures | Same fields, with `visualDirection` separately schema-validated | Match |
| Public/local boundary | Interactive demo publicly; fresh generation in local Codex | No public mutation; copyable launcher plus repo-preserving loopback link | Match |
| Mobile | Stacked 390px journey with reachable controls | 390×844 first viewport passes; stepper keyboard-focusable and scrollable | Match |
| Deliver | Real outputs and one package CTA | Real CampaignCanvas tabs plus exact “Download complete launch package” CTA | Match |

## Above-fold copy diff

- Headline: exact match.
- Supporting transformation sentence: exact match.
- Input placeholder: exact match.
- Primary and secondary CTA labels: exact match.
- Added for product comprehension: explicit 2–4 capture/direction input contract, public/local truth line, five-stage stepper, and concrete output strip.
- Removed from the product path: cached-judge-viewer language, hashes, checksum cards, Build Week copy, and security/audit explanations.

## Deliberate deviations

- The concepts compress real outputs into illustrative compositions. The implementation uses the existing real campaign workspace and files, so the Deliver section is taller and operational rather than decorative.
- The desktop concept placed more of Direct inside the first viewport. The implementation reserves that viewport for the complete promise, repo action, real-output montage, five-stage journey, and exact output contract; the real Analyze/Direct workbench follows immediately.
- Evidence and checksum surfaces were not deleted. They moved to `/evidence`, preserving the prior verification contract without letting it dominate the homepage.
