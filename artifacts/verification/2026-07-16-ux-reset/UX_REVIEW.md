# PitchFlow UX reset — blunt local review

Date: 2026-07-16  
Viewports: 1440×1000 and 390×844  
Browser: Microsoft Edge through Playwright. The in-app browser capability was not available in this execution surface; Edge was required by the acceptance contract, so the verifier used the installed Edge binary directly.

## Verdict

Pass as a deployment candidate. Not final approval. Nicco must review the exact live deployment before YouTube, Devpost, the two final clean-state runs, or goal completion may resume.

The rejected candidate mixed marketing, direction, bridge setup, workflow, demo, and results in one page. The repaired source has three mutually exclusive surfaces: a first-viewport entry, a four-step project wizard, and a dedicated results workspace. The demo skips the wizard and says `Read-only demo`; a fresh project cannot inherit demo ownership.

## Five-second contract

- Input is explicit: one GitHub repository field; direction and real captures are named in the one-line explanation.
- Transformation is explicit: PitchFlow creates the kit with the developer's local Codex engine.
- Outputs are visible together: Website, Images, Videos, Copy, ZIP.
- Primary action is unambiguous: `Generate launch kit`; the demo is a subordinate text action.
- The public/local boundary appears only at the Engine step. After a loopback-policy failure, `Open local workspace with this project` is the only mint primary; `Check connection` becomes an outline secondary.

## Native screenshot inspection

- Entry: `final-local/entry-desktop-1440x1000.png`, `final-local/entry-mobile-390x844.png`.
- Direction: `final-local/direction-desktop-1440x1000.png`, `final-local/direction-mobile-390x844.png`.
- Engine fallback: `final-proof/engine-single-primary-1440x1000.png`.
- Demo results: `implementation/demo-results-desktop-1440x1000.png`, `implementation/demo-results-mobile-390x844.png`.
- Decoded image and video surfaces: `final-proof/images-decoded-1440x1000.png`, `final-proof/videos-decoded-1440x1000.png`.
- Compact Export: `final-proof/export-compact-1440x1000.png`.

No root overflow or console/page errors were observed at either viewport. Serious/critical axe findings are zero. The generated full-page captures can repeat fixed development overlays during stitching; acceptance is based on production-mode viewport screenshots and browser assertions, not those development-only repetitions.

## Failed gates and repairs

1. The first local E2E run used stale selectors from the rejected information architecture. The test was rewritten around Entry → Repository → Direction → Engine → Generate → Results, capture persistence, real request progress, result ownership, and ZIP ownership.
2. Axe found a 4.29:1 footer label and 2.98:1 output indices. The shared tertiary token is now `#7c857e`; both public and local accessibility gates pass without exclusions.
3. Export inherited a generic 620px deliverable minimum, producing unjustified dead space. All Results tabs were compared at 1440×1000. Website, Images, Videos, and Copy use real content height; Export now uses its natural 278px panel height and keeps the action above the fold.
4. The first Results Images screenshot was invalid: the media files were complete and correctly sized, but the screenshot ran before lazy image paint. The public verifier now scrolls every preview into view, awaits `decode()`, waits two animation frames, and samples actual canvas pixels. It applies the equivalent loaded-data/seek/paint proof to both videos.

## Visible-pixel proof

All 13 image previews decoded with their declared natural dimensions. Their sampled luminance ranges are 231.8–251.1 and standard deviations are 29.1–57.0, comfortably above the fail-closed thresholds of range >100 and standard deviation >20.

Both 36-second videos produced real decoded frames at 1 second:

- Landscape 1920×1080: luminance range 240.1, standard deviation 64.9.
- Portrait 1080×1920: luminance range 251.1, standard deviation 31.0.

The strengthened production public suite attaches the per-preview JSON measurements and a post-decode screenshot. File hashes and metadata remain supporting evidence, never substitutes for visible pixels.

## Concept fidelity ledger

1. Preserved: asymmetric entry hierarchy, compact five-output rail, and one repository action.
2. Preserved: quiet four-step shell with active/complete/upcoming state and no technical prose before Engine.
3. Preserved: Direction uses defaults, a collapsed advanced disclosure, and real capture provenance instead of a wall of controls.
4. Preserved: Results uses large previews, minimal chrome, and explicit demo/fresh ownership.
5. Preserved: off-black, warm white, flat muted mint, hairline borders, square-edged studio surfaces, and no gradient/glow/bento treatment.
6. Intentional deviation: concept placeholder UI never ships. Results render verified campaign content and assets; the Website tab links the exact generated microsite rather than faking browser content.

## Remaining gate

Deploy this exact source, verify the live alias at both viewports with the same decoded-media protocol, preserve the reports/screenshots, and ask Nicco for visual approval. Publication remains frozen.
