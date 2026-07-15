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
