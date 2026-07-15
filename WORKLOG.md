# PitchFlow Worklog

This file is append-only in spirit: preserve prior attempts, including failures. All times use Europe/Rome unless stated otherwise.

## 2026-07-15 — activation grounding

### Observations

- Read the complete Ultragoal skill, `PITCHFLOW_ULTRAGOAL.md`, and `PITCHFLOW_PREFLIGHT.md` before repository creation.
- Re-read the live official Build Week rules, FAQ, resources, and updates.
- Confirmed official submission deadline: 2026-07-21 17:00 PT / 2026-07-22 02:00 Europe/Rome.
- Confirmed required material use of Codex and GPT-5.6, Developer Tools testing instructions, public English YouTube demo <= 3 minutes with audio, repository URL, and primary `/feedback` Session ID.
- Confirmed `/Users/nicco/Projects/Playground/pitchflow-build-week` and `sickn33/pitchflow` were both unused before creation.
- Created a new empty Git repository on branch `main`. No old repository was cloned or inspected for implementation details.
- Live-authenticated GitHub and Vercel accounts both resolve to `sickn33`.
- Inspected only Codex auth file metadata and top-level key names. No credential values were printed or copied.
- Reproduced the global Codex CLI missing-native-binary `ENOENT`; recorded a project-local SDK architecture.

### Decisions

- Category: Developer Tools.
- Architecture: pnpm TypeScript workspace with Next.js workspace/viewer, Zod core, local Codex SDK adapter pinned to GPT-5.6, Remotion renderer, and thin CLI.
- Public viewer is cached and immutable; authenticated generation remains local.
- Native rendering is primary. Docker remains optional and will be introduced only if an actual verifier requires it.
- No Platform API adapter will be enabled.
- At activation, no subagents were authorized; that restriction was later superseded by Nicco's explicit bounded authorization recorded below.

### Red-team result

The finish line was tested against static-demo substitution, decorative evidence, fake media files, dead downloads, misleading one-command claims, credential leakage, concealed prior work, skipped suites, screenshot-only polish, and decorative GPT-5.6 use. Each has an independent verifier in `GOAL.md`.

### Current state

- Durable goal packet: activated with the exact objective in `GOAL.md` and no token budget.
- Implementation: not started.
- Next action: build and independently verify the clean foundation.

### Activation

- Active goal thread: `019f63f6-0b11-7310-a7c1-d62b3a51e774`.
- Exact objective: `Complete and verify the PitchFlow OpenAI Build Week product defined in /Users/nicco/Projects/Playground/pitchflow-build-week/GOAL.md, including a working public judge path, evidence-grounded GPT-5.6 generation, exportable site/social/video/copy assets, clean-state tests, and the complete submission evidence packet.`
- Token budget: none set.

## 2026-07-15 — foundation verifier loop

- First dependency install populated the pnpm store but had not finished linking when the verifier ran; observed `prettier: command not found`. Waited for the still-running installer instead of starting overlapping work. Lockfile and executables then appeared normally.
- First linked `pnpm check:all` failed in ESLint because TypeScript 7.0.2 is ahead of `typescript-eslint` 8.54.0 support (`Cannot read properties of undefined (reading 'Cjs')`). This is an ecosystem compatibility failure, not a product failure.
- Repair: pin TypeScript 5.9.3, the current supported stable line for the selected lint stack, then rerun the complete verifier.
- Second verifier reached ESLint but the typed rules were incorrectly applied to the JavaScript flat config itself. Repair: explicitly disable type-aware TypeScript rules for JavaScript configuration files while keeping them mandatory for all project TypeScript.
- Third full verifier passed formatting, strict typed lint, TypeScript, the intentionally empty baseline test suite, and the Next.js production build. Next.js emitted a workspace-root inference warning because an unrelated lockfile exists in the user home directory; repair before the foundation commit by pinning Turbopack's root to this repository.
- The post-build rerun exposed that root-only ESLint ignore globs did not exclude `apps/web/.next`. Repair: use workspace-recursive ignores; generated output remains outside lint scope while source checks stay unchanged.
- The official SDK's transitive native binary exists and runs as `codex-cli 0.144.4`, but `pnpm exec codex` initially fell through to the broken global shim because the CLI was only transitive. Repair: pin `@openai/codex` as a direct dependency of the local adapter so all documented smoke commands resolve the repository-owned binary.
- Foundation gate passed: `pnpm --filter @pitchflow/codex exec codex --version` reports `codex-cli 0.144.4`; `pnpm check:all` passes formatting, typed lint, strict typecheck, baseline tests, and production build with no Next.js workspace warning; `git diff --check` passes.
- Next action: commit this dated, genuinely new skeleton before implementing product behavior.

## 2026-07-15 — evidence-first vertical slice

### Delegation authorization

- Nicco explicitly authorized bounded subagents while keeping final responsibility in the parent task.
- Maximum: three concurrent children, with one execution slot retained by the parent.
- Assigned independent production lanes: `apps/web` product experience/accessibility and `packages/remotion` deterministic motion/media. The parent retains core, Codex, repository integration, durable state, all public actions, final verification, `/feedback`, and goal completion.
- Every delegated change must be integrated and rerun through the strongest relevant verifier before acceptance.

- Implemented strict canonical GitHub URL normalization; bounded fixed-host GitHub API intake; commit pinning; repository, language, tree, README, manifest, documentation, and license evidence; binary exclusion; potential-secret redaction; typed failure codes; schema-validated campaign drafts/manifests; deterministic fixtures; and evidence-link audits.
- Implemented a project-local Codex SDK adapter pinned to `gpt-5.6`, high reasoning, read-only sandbox, no approvals, no network or web search, JSON Schema output, one validation repair, usage/thread metadata, and a hard rejection if the creative-director run invokes shell, file, MCP, or web tools.
- First evidence-engine test run: 22 tests passed and one failed; two suites could not load because root test fixtures did not resolve the workspace alias. The failed security case showed WHATWG URL parsing normalizes an explicit HTTPS `:443` to an empty port before validation.
- Repair: reject explicit ports from the raw URL before WHATWG normalization and add explicit Vitest workspace aliases. No test or security requirement was weakened.
- Added the parent-owned export engine for accessible static microsites, exact-dimension OG/X/LinkedIn/Instagram cards, five 1080x1350 carousel slides, channel copy, manifest/snapshot records, provenance-rich SHA-256 asset inventory, safe external video ingestion, and a traversal-safe ZIP.
- First export verifier hit the five-second test boundary during sequential maximum-effort PNG/ZIP compression. Repair the product path by rendering independent images concurrently and using balanced lossless compression; do not raise the timeout unless the optimized complete bundle still genuinely needs it.
- First authenticated GPT-5.6 smoke stopped before any model call because the SDK override `feedback: false` is invalid against Codex CLI 0.144.4, whose `feedback` configuration is structured. The wrapper also mislabeled the infrastructure failure as invalid model output and attempted a schema repair.
- Repair: remove the unnecessary feedback override so the local runtime uses its valid user configuration, classify SDK/runtime failures separately from repairable structured-output failures, and prove with a unit test that an infrastructure error is surfaced after one call rather than consuming a second GPT run.
- The next authenticated smoke reached the Codex service and returned HTTP 400: the generic slug `gpt-5.6` is not supported for a ChatGPT-authenticated Codex account. The design packet's target runner is specifically GPT-5.6 Sol; the available Codex runner identifier is `gpt-5.6-sol`.
- Repair: pin the production adapter and environment example to `gpt-5.6-sol`, while retaining the human-facing GPT-5.6 Sol name and the no-fallback invariant. A rejected or unavailable Sol route remains a hard verifier failure rather than silently selecting another model.
- The first accepted GPT-5.6 Sol response completed structured generation, but manifest finalization rejected all eight claims because the snapshot schema permits canonical evidence excerpts up to 1,600 characters while the claim envelope permitted only 800. The failure occurred after valid model output and no artifact was written.
- Repair: align the claim-envelope limit with the canonical evidence record, preserving the complete source excerpt used by the evidence auditor. Add a 1,600-character regression test; do not truncate proof or loosen evidence equality.
- Accepted the bounded Remotion lane only after its scoped typecheck, strict lint, formatting, nine tests, composition discovery, ffprobe readback, contact-sheet inspection, and two byte-identical 30-second quarter-scale renders. Parent integration now makes the production bundle path render both 16:9 and 9:16 MP4s directly from the same manifest and records their real dimensions and hashes in the asset inventory.
- The first integrated full-resolution render attempt was denied by the workspace sandbox when `tsx` tried to create its local IPC pipe (`listen EPERM`). This is an execution-policy boundary, not a renderer defect. Rerun the exact product command with the pre-authorized local-browser/render permission; keep the non-escalated failure in the audit trail.
- Real authenticated dogfood generation passed through GPT-5.6 Sol with zero repair attempts: campaign `campaign_1ca3c7f139d40be4`, Codex thread `019f6417-3f29-7ed0-bf18-bccf8364811b`, 8 claims, 15 evidence links, and a clean evidence audit. The redacted report records 26,779 input tokens, 4,065 output tokens, 689 reasoning tokens, ChatGPT authentication, and no credential-value reads or prints.

### Independent media acceptance gate — rejected

- The first integrated VibePalette bundle proved the renderer infrastructure only: both files decode as 36-second, 30 fps, H.264 High/yuv420p streams at 1920x1080 and 1080x1920, with clean transitions, safe areas, matching hashes, and a valid ZIP.
- Final marketing acceptance is **rejected**. The MP4s are retained only as failed/engineering evidence and must not be cached in the public viewer, deployed as the immutable judge package, or described as final.
- Blocking defects: visible captions leak internal directions (`Open on`, `Cut to`, `Animate`, `Reveal`, `Fan`, and `Return to`); no real product UI is shown; abstract cards do not substantiate the behavior; pacing is six mostly static six-second slides; the ending lacks a prominent product identity, repository URL, and CTA; there is no audio stream; and the initial 1080p encoding is too aggressive for a social master.
- Repair contract: separate internal `visualDirection` from short audience-facing `audienceCaption`; add documented real locally captured UI/browser/repository still sequences; make shown behavior match visible claims; increase motion density, especially in the first two seconds; create a genuinely social-native 9:16 layout; strengthen the closing identity/URL/CTA; raise master encoding quality; regenerate both ratios; then repeat full technical and frame-sheet review before acceptance.

## 2026-07-15 — media contract and local judge-path repair loop

- Accepted the repaired `packages/remotion` implementation only after its bounded worker returned 15 scoped tests, strict type/lint/format passes, composition discovery for both layouts, a byte-identical landscape rerender, and quarter-scale H.264 smoke files. The smoke media remains explicitly labeled test fixture evidence, not public/final output.
- The renderer now rejects capture-free production, accepts exactly 2–4 validated local PNG/JPEG captures, stages only verified bytes in a private temporary directory, emits path-free capture receipts, renders only `audienceCaption`, never references `visualDirection`, uses distinct portrait/landscape layouts, opens with first-two-second motion, closes on product/repository/CTA, and targets 10/12 Mbps full-resolution masters.
- Integrated real product captures as first-class export inputs. The static microsite includes the same captures used by Remotion; the asset index records each capture's hash, dimensions, provenance, and intended use; video render metadata is serialized without local source paths. Optional external video assets now require explicit user-supplied or licensed provenance.
- Added the accessible local UI capture workflow: 2–4 real screenshots, preview/reorder/remove, label, description, explicit ownership/authorization, bounded binary/MIME/dimension validation, no inclusion in Codex prompts, safe staging, repeated `--capture` renderer arguments, and unconditional cleanup.
- Replaced the launcher's timer-based browser opening with readiness polling against the loopback status endpoint, a documented `open` alias, `--no-open`, validated port selection, signal cleanup, and actionable startup failures. Unit coverage verifies parsing, readiness, timeout, and unsafe input behavior.
- First Playwright attempt failed before startup because sandboxed `tsx` could not create its IPC pipe (`listen EPERM`). Preserved the failure and reran the same verifier with the already authorized local-browser permission.
- Second attempt reached the app but Playwright's Babel transform rejected one `declare` class field. Replaced it with an explicit typed `override` assignment; runtime semantics were unchanged and core tests remained green.
- Third attempt failed before page creation because optional Playwright diagnostic video expected its private cached FFmpeg. Disabled only Playwright test-video recording; trace and failure screenshots remain enabled, and product Remotion/FFprobe checks are unchanged.
- Subsequent browser runs exposed two ambiguous test locators and then a real console defect: the GitHub input's HTML pattern is invalid under the modern RegExp `v` flag. Tightened the locators and removed the brittle duplicate client pattern while retaining URL input semantics and the authoritative strict API URL parser.
- Local judge path now passes 3/3 Playwright tests through the actual `pnpm pitchflow --no-open` launcher: analyze/evidence/generate/edit/capture/export, truthful upstream failure, mobile overflow, zero console errors, and zero serious/critical axe violations.
- Tightened capture provenance integration after discovering the staged label/description/authorization record was not yet consumed by the parent render script. The bundle now carries those fields into the static site and detailed Remotion capture inputs, writes a path-free checksummed `capture-provenance.json`, and rejects ambiguous test-fixture/user-supplied combinations.
- Added real repository verifiers for tracked/untracked secret leakage, a 481-package license inventory, and a production dependency advisory scan. The first `pnpm audit --prod` attempt failed because npm returned HTTP 410 for both retired endpoints used by pnpm 10.32.1; this was not accepted as an audit result. Replaced it with the official OSV batch API over the pnpm production graph: 271 package/version pairs, zero findings.
- The first license scan correctly stopped on the platform-specific `@remotion/compositor-darwin-arm64` package's missing npm `license` field. Verified the current official Remotion license scope for an individual/team of up to three, mapped only the compositor binary to the disclosed Remotion License, and recorded the custom license plus reevaluation condition in `docs/PROVENANCE.md`.
- Interim pre-publication aggregate gate passed: formatting, zero-warning ESLint, strict TypeScript, 67 Vitest tests, production Next.js build, secret scan, license scan, OSV dependency scan, 3 Playwright journeys, axe, console, and mobile checks.
- Next action: finish aggregate security/media/provenance verifiers, publish the implementation commit to the pre-authorized repository, then generate and independently inspect the PitchFlow self-dogfood package from that pinned public commit.

## 2026-07-15 — public source and PitchFlow self-dogfood media gate

- Committed the integrated source as `87d70cc297dc4320ed0a3e6aa059739565d0de43`, created the pre-authorized public repository `https://github.com/sickn33/pitchflow`, pushed `main`, and verified local HEAD, remote `refs/heads/main`, default branch, and public visibility all agree.
- Fresh public intake pinned the self-dogfood snapshot to that exact commit: 114 discovered files, 10 bounded included files, 30,664 included bytes, and 13 evidence records.
- A new current-schema authenticated GPT-5.6 Sol run completed through the official Codex SDK path with zero repair attempts: campaign `campaign_a6278deb1d98cf0c`, Codex thread `019f6446-a899-7ac0-9995-b6e936c03427`, 28,353 input tokens, 3,902 output tokens, 849 reasoning tokens, 8 claims, and 49 checked evidence links. The report confirms ChatGPT authentication, Codex CLI `0.144.4`, no credential-value reads, and no credential-value prints.
- Added a deterministic browser capture harness that opens the real local PitchFlow workspace and injects only the already verified repository snapshot and GPT-5.6 Sol manifest through route fixtures. It produced four creator-owned UI captures: pinned evidence, campaign preview, channel copy, and a tall responsive preview, each with path-free labels/descriptions and SHA-256 provenance.
- The first capture attempt failed because the harness targeted a non-existent `.campaign-canvas` selector. The application correctly remained unchanged; repaired the verifier to target the actual accessible `.canvas` workspace and reran it successfully. No capture artifact from the failed attempt was accepted.
- The first full PitchFlow render candidate passed strict bundle, hash, ZIP, schema, evidence, provenance, full-decode, H.264 High/yuv420p/BT.709, 30 fps, duration, dimension, and bitrate checks. Parent frame-sheet review nevertheless rejected it because the opening promoted the internal title `Identity` and visible scene markers still resembled production notation.
- Preserved that candidate under `artifacts/verification/2026-07-15-pitchflow/rejected/`, removed the internal labels from the audience surface, made `PitchFlow` the first-frame identity in both ratios, added a regression assertion, and reran all 15 Remotion tests plus scoped type/lint/format checks.
- The regenerated candidate again passes full technical verification. Landscape: 1920x1080, H.264 High/yuv420p/BT.709, 30 fps, 36 seconds, 9,164,632 bps, SHA-256 `7f49c7d7ca250a9018f48319cd0129c65f341c47e57228d140fbe909b930177d`. Portrait: 1080x1920, H.264 High/yuv420p/BT.709, 30 fps, 36 seconds, 10,875,351 bps, SHA-256 `629d065628020c6a4bdf4e3a7298725606dd622f4ad63a89699089ba78470027`. Both streams fully decode; neither contains audio by the explicit silent-social-master brief.
- Parent visual acceptance reviewed 12-frame overview, 24-frame intra-scene, 15-frame transition, first-two-second, and full-resolution opening/closing evidence for both ratios. Real PitchFlow UI is present throughout, captions substantiate the visible behavior, first-frame product identity is clear, portrait is structurally social-native, transitions are clean, and the close prominently holds PitchFlow, `github.com/sickn33/pitchflow`, and the source-exploration CTA.
- Started a separate authorized read-only verifier pass before admitting the regenerated media to the immutable public viewer. Promotion and deployment remain blocked until that independent verdict returns.

## 2026-07-15 — independent candidate-2 rejection and export-proof repair

- The independent media verifier **rejected candidate 2** despite its technical pass. Scene 5 promised a site, social assets, carousel, copy, video, checksums, and ZIP while recycling earlier evidence/campaign/copy captures; the visible footage did not prove that handoff. Candidate 2 and all of its inspection evidence were preserved under `artifacts/verification/2026-07-15-pitchflow/rejected/candidate-02-missing-export-proof/`. It was never promoted, cached, or deployed.
- Repaired the product contract instead of weakening acceptance. A successful local export now returns a path-free receipt with campaign ID, asset count, archive name, and SHA-256; the real workspace automatically opens a dedicated handoff panel listing the microsite, social system, carousel, channel copy, both motion masters, integrity index, and traversal-safe archive.
- Added explicit `sceneIndexes` to capture provenance and render inputs. Every non-closing production scene must be covered by at least one documented real UI capture; invalid, duplicate, closing-only, or incomplete mappings fail before render. Unit tests prove both the recorded mapping and the uncovered-scene rejection.
- The first updated browser capture attempt targeted a stale selector and failed without producing accepted evidence. A later attempt tried to stream the complete 92 MB archive into Playwright and closed the page. The accepted harness now drives the real UI with the already verified snapshot/manifest, injects only the verified archive receipt headers with a minimal local response body, and captures the resulting truthful post-export interface. The receipt values still derive from the real verified bundle; no fake product UI is generated.
- Accepted four creator-owned PitchFlow states with path-free SHA-256 provenance: pinned evidence (`32cc05f9…`, scenes 1–3), campaign preview (`dc2ea2ea…`, scenes 1 and 4), channel copy (`8933f200…`, scene 4), and verified export handoff (`99560315…`, scene 5).
- Candidate 3 passed the strengthened production verifier. Landscape: 1920x1080, H.264 High/yuv420p/BT.709, 30 fps, 36 seconds, 9,125,222 bps, SHA-256 `32743c9f4f6dd87e0b51cae9776361bb84c9dd50999ae942270d01201ac9639e`. Portrait: 1080x1920, H.264 High/yuv420p/BT.709, 30 fps, 36 seconds, 10,767,545 bps, SHA-256 `2de969b9dad2dcb53cadc21313f6fc541de2557100e9f202d490083cf9efc094`. Both fully decode; archive SHA-256 is `fde4380e466b8697ddadc09de52cb799926651e497e8b7a727979701f472e2fd`.
- Parent review covered overview, intra-scene, transition, first-two-second, and full-resolution opening/handoff/closing sheets in both ratios. The repaired handoff frame visibly contains all eight output groups, 23 indexed assets, checksum/index language, archive identity, and matching audience copy. Public promotion remains blocked pending a second independent candidate-3 verdict.
- The independent candidate-3 verifier returned **PASS** after separate FFprobe, full decode, black/freeze detection, hash, ZIP inventory, and all-14-frame-sheet inspection. It confirmed semantic scene routing, truthful export proof, clean audience copy, purposeful motion, a social-native portrait composition, and a clear repository CTA. The accepted verdict is preserved in `artifacts/verification/2026-07-15-pitchflow/media-inspection/REVIEW.md`; only the exact verified candidate-3 hashes may now enter the immutable viewer.
- Promoted only candidate 3 into `apps/web/public/dogfood/pitchflow/v1`. The immutable package contains 25 declared files totaling 183,781,036 bytes; `judge-package.json` SHA-256 is `74d2bc013fc5e628c99091bba74df373d363efff3122c1edbb383bfcd5cfc93b`. A fresh post-copy package verifier and a second full production bundle/MP4/ZIP verifier both passed against the promoted bytes.
- Expanded the public viewer from a download list into a no-presentation judge experience: inline caption-complete landscape/portrait masters, all four social graphics, the ordered five-slide carousel, four genuine product UI captures, static microsite/ZIP actions, and visible per-asset SHA-256 provenance. Asset selection is deterministic and refuses ambiguous fallback media.
- The first production-mode public browser suite passed every asset download/hash, route-denial, desktop, console, and accessibility check but **failed mobile containment**: the intentional horizontal carousel expanded the root scroll area by 825 px. Two attempted root/container clipping variants still failed the strong scroll assertion; the second localized the defect to the carousel's paint overflow, and another confirmed root clipping alone was insufficient.
- Repair: give the inner carousel layout/inline-size/paint containment, preserve it as a real horizontal scroller, and make the responsive verifier distinguish expected contained carousel overflow from unexpected viewport overflow. The repaired test proves the root cannot scroll horizontally, every non-carousel visible element stays inside the viewport, and the carousel itself remains operable. The focused mobile rerun passed; the full aggregate/public rerun remains required after final formatting.
- Integrated aggregate gate passed after formatting: zero-warning lint, strict TypeScript, 69 unit/integration tests, local and public production builds, 481-package license scan, 271-production-package OSV scan with zero findings, secret scan, promoted-package and full media/ZIP verification, 3/3 local Playwright journeys, and 2/2 production public-viewer journeys. The public suite downloaded and SHA-256-verified all 25 assets and reconfirmed the three mutation routes return `403 PUBLIC_VIEWER_READ_ONLY` before parsing invalid JSON. This is a pre-deployment integration pass, not either of the two final clean-state runs.
