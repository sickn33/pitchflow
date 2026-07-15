# PitchFlow live product-reset review

Reviewed: 2026-07-15 CEST
Public URL: `https://pitchflow-ten.vercel.app`
Deployment: `dpl_FQEXvHu5WdACQANxEGNff9EEhtXx`
Deployed source: `96f7400da1e09917b997a9650a0080162211719f`
Verdict: **PASS as the live product candidate; Nicco's explicit product approval is still required.**

## Five-second product gate

The live first viewport passes at both native targets:

- input: public GitHub repository, followed by 2–4 real captures and creative direction;
- transformation: repository evidence becomes a GPT-5.6-directed launch campaign through the developer's local Codex sign-in;
- outputs: Website, Images, Videos, Copy, and Export;
- immediate trial: the real PitchFlow dogfood project is interactive without a presentation;
- honest boundary: arbitrary-repository analysis creates a repository-preserving loopback handoff and sends no public mutation request.

The product path contains no cached-viewer, checksum, Build Week, or audit language above the fold. Evidence remains available at `/evidence` and in the footer.

## Live browser evidence

- Readback: `live-public-readback-96f7400.json`
- Browser report: `live-96f7400-browser-qa.json`
- Desktop: `live-96f7400-desktop-1440x1000-full.png` — 1440×3805, SHA-256 `19b2233991dabfc25490f648ed9c53a8187639c6f3129af90820768fd9caf79e`
- Mobile: `live-96f7400-mobile-390x844-full.png` — 390×8182, SHA-256 `7317d526c93e65c0502d3b9fca4fb8d6f1723ecfeb9e40ca7d46247c1b2986e5`
- Output strip bottom: 997.91 px of 1000 desktop; 791.78 px of 844 mobile.
- Root overflow: 0 px at both viewports.
- Axe violations: 0 at both viewports.
- Console errors: 0.
- Public mutation requests: 0.
- Delivery tabs: Website, Images, Videos, Copy, Export.
- Preserved handoff: `http://127.0.0.1:3210/?repo=https%3A%2F%2Fgithub.com%2Fopenai%2Fcodex`.

The first live replay failed because the verifier treated a pre-existing heading as completion of the asynchronous demo reload. The product fetch was still running. The repaired verifier waits for both the canonical PitchFlow repository value and removal of the stale handoff; the same live deployment then passed. This strengthened synchronization and did not suppress or relax any assertion.

## Independent readback

Vercel inspection reports the exact production deployment and alias `READY`. Unauthenticated HTTPS readback rehashed all 25 immutable dogfood files (183,781,036 bytes), verified the real ZIP, confirmed `/evidence`, confirmed security headers, and proved `/api/analyze`, `/api/generate`, and `/api/export` each fail closed with `403 PUBLIC_VIEWER_READ_ONLY`. Public status exposes no Codex capability or credential.

The dogfood package's embedded evidence commit `87d70cc297dc4320ed0a3e6aa059739565d0de43` is package provenance, not the Vercel source commit. The production prebuilt was created from clean `HEAD == origin/main == 96f7400da1e09917b997a9650a0080162211719f`; no application file changed between build and deployment.

## Blunt visual review

The desktop and mobile captures read as one real repo-to-launch workspace, not an auditor dashboard or a decorative landing page. The hero promise, repo action, direction contract, five-stage journey, and output contract are visible before scrolling. The actual Analyze/Direct controls, creator-owned captures, local generation boundary, output tabs, videos, copy, and package download remain part of the same continuous page.

The mobile page is long because it exposes the real output workspace. This is dense but truthful, responsive, keyboard-reachable, and free of horizontal root overflow. No visual issue found in the full-page inspection blocks Nicco's live review.
