# Testing and acceptance

## Aggregate gate

```bash
pnpm check:all
```

The release gate is intended to fail closed. A failed verifier starts a repair loop; required suites are not skipped or relabeled.

## Core suites

- strict GitHub URL/ref normalization and typed upstream failures;
- byte/file/tree limits, binary exclusion, secret redaction, and no execution;
- evidence/content/snapshot integrity tamper detection;
- complete campaign evidence-link audit;
- exact GPT-5.6 Sol model and schema repair policy;
- isolated Codex environment and tool-activity rejection;
- exact image dimensions, deterministic image hashes, HTML escaping, ZIP safety;
- capture MIME/signature/dimension/count/order/provenance validation;
- four distinct capture-led social layouts, five ordered carousel stages, text-fit receipts, and no ellipsis/overlap fallback;
- Remotion timeline, safe areas, audience/internal-copy separation, and deterministic smoke;
- project-bound pairing, exact origin/Host, local-only approval, expiry/replay, bounded streaming bodies, cancellation/retry, result isolation, and secret redaction;
- Playwright happy, failure, keyboard/mobile, console, and axe accessibility checks.

## Real smoke commands

```bash
pnpm smoke:github -- --repo https://github.com/owner/repository --output artifacts/verification/run/repo-snapshot.json
pnpm smoke:codex -- --snapshot artifacts/verification/run/repo-snapshot.json --output artifacts/verification/run/campaign-manifest.json
pnpm smoke:render -- --manifest artifacts/verification/run/campaign-manifest.json --snapshot artifacts/verification/run/repo-snapshot.json --output artifacts/exports/run --capture artifacts/verification/run/ui-1.png --capture artifacts/verification/run/ui-2.png
pnpm verify:connected-engine -- --repo https://github.com/owner/repository --output artifacts/verification/fresh --capture path/to/ui-1.png --capture path/to/ui-2.png
pnpm verify:creative-output -- --bundle artifacts/verification/fresh --output artifacts/verification/fresh-inspection --expected-product ProductName
```

Real Codex smoke uses the current local authenticated entitlement and may consume eligible Codex credits. It does not use a Platform API key.

## Final media acceptance

For both production MP4s:

- exact width/height and 30 fps;
- H.264 High, yuv420p, valid 25–40 second duration;
- target bitrate appropriate for the master;
- full decode with no error;
- first/middle/last and dense contact sheets;
- intra-scene and transition inspection;
- real UI visible and claims visually substantiated;
- closing identity, repository URL, and CTA readable;
- no internal production directions on screen.

## Final clean-state rule

After all source, documentation, dogfood, and deployment evidence is fixed, run the complete clean-state suite twice consecutively with no source or configuration change between runs. Preserve both logs and the tested commit SHA in `RESULT.md`.
