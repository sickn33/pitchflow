# PitchFlow Build Week Goal

Status: **ACTIVE**  
Prepared: 2026-07-15 06:11 CEST  
Internal submission-ready deadline: **2026-07-21 18:00 Europe/Rome**  
Official submission deadline: **2026-07-22 02:00 Europe/Rome** (2026-07-21 17:00 PT)  
Category: **Developer Tools**

## Active objective

Complete and verify the PitchFlow OpenAI Build Week product defined in `/Users/nicco/Projects/Playground/pitchflow-build-week/GOAL.md`: a live product-first repo-to-launch workspace whose public experience securely pairs with a user-owned loopback companion, performs real fresh-repository Codex + GPT-5.6 generation and rendering, returns a repository-specific complete package, keeps proof secondary under `/evidence`, passes all existing functional/security contracts, and receives Nicco's explicit approval before any YouTube or Devpost work resumes.

## Outcome

PitchFlow is a repo-to-launch studio for developers. A developer provides a canonical public GitHub repository, 2–4 real product captures, and creative direction. PitchFlow gathers a bounded, commit-pinned evidence set, understands the real product, and uses GPT-5.6 through the user's authenticated local Codex workflow to direct an editable, evidence-grounded launch campaign. One validated `CampaignManifest` reproducibly drives a responsive launch website, social graphics, a five-slide carousel, channel copy, and 16:9 plus 9:16 Remotion videos.

The finished entry must include both:

1. a one-command local workspace that performs real repository intake and Codex/GPT-5.6 generation without copying personal credentials; and
2. the same product-first workspace on public Vercel, preloaded with an immutable, complete PitchFlow dogfood campaign that visitors can explore without login and able to pair with a user-owned loopback companion for real fresh-repository generation without deploying the user's credentials.

Tagline: **Ship the code. PitchFlow ships the story.**

## Product-reset finish line

Nicco rejected the earlier audit-first cached viewer as the wrong product surface. The active finish line is now a live first-time-user comprehension gate, not the mere existence of a judge package.

At both 1440px desktop and a real 390px mobile viewport, the live homepage must make the following clear within five seconds and without documentation:

1. **Input:** a public GitHub repository plus 2–4 real product captures and creative direction.
2. **Transformation:** PitchFlow understands the repository from pinned evidence and uses GPT-5.6 through the developer's local Codex entitlement to direct a coherent launch system.
3. **Outputs:** Website, Images, Videos, Copy, and Export, culminating in one complete downloadable launch package.
4. **How to try it:** the public site provides a complete interactive PitchFlow dogfood demo; a fresh arbitrary repository pairs with or opens the user-owned local companion, preserves the project inputs, runs the real Codex workflow after explicit local confirmation, and returns the new repository's actual outputs.

The main route is the product workspace. Audit terminology, checksums, immutable-package details, security proofs, and Build Week material remain secondary under `/evidence` and may be linked quietly from the product UI. The public route must never simulate fresh generation, call a hosted provider with Nicco's authority, expose personal Codex authority, or imply Platform API billing.

## Connected-engine completion finish line

Nicco approved the product-first surface on 2026-07-15 but rejected the remaining explanatory handoff as incomplete product behavior. This section supersedes any earlier finish-line language that allowed an arbitrary repository to stop at a local link.

The mandatory fresh-repository path is:

1. `pitchflow connect` starts the existing workspace and execution engine on loopback only.
2. The public workspace detects the companion when the browser permits HTTPS-to-loopback communication, establishes a user-initiated pairing with exact origin validation, and waits for explicit approval on the local machine.
3. If browser private-network or mixed-content policy blocks direct communication, the public workspace opens the same product UI locally without claiming hosted generation; repository URL, direction, captures, and pending pairing state are transferred without putting credentials or tokens in URLs or persistent browser storage.
4. The companion uses a short-lived high-entropy in-memory session, rejects expired or replayed mutations, bounds every job input, and exposes no LAN listener, wildcard CORS, long-lived secret, or public provider credential.
5. A real job reports evidence fetching, product understanding, GPT-5.6 creative direction, asset/video rendering, validation, and packaging from actual operation boundaries. Errors, cancellation, and retry remain truthful.
6. Completion replaces the demo campaign with the new repository's Website, Images, Videos, Copy, and Export in the same workspace. The download is that job's real ZIP and results remain isolated to the paired session.

Codex is the required/default provider and uses the locally authenticated Codex entitlement with GPT-5.6 Sol. Optional Claude Code capability detection may be exposed only when a local authenticated client exists; it may not replace the Codex proof. No API-key adapter is required, and none may be enabled or paid from Nicco's Platform account without separate approval.

The mandatory second-repository verifier targets `https://github.com/sickn33/VibePalette`, a separate small public repository owned by Nicco. Its generated package must be based on a newly pinned commit and creator-owned VibePalette captures, must contain the full website/image/carousel/landscape-video/portrait-video/copy/manifest/index/ZIP set, and must contain no PitchFlow dogfood campaign IDs, claims, media hashes, or product copy.

File validity alone does not satisfy this verifier. When valid product captures exist, the reusable generator must make them the primary visual evidence in platform-specific social graphics, a five-slide narrative carousel, and both Remotion formats. Every visible line must fit without ellipsis or clipping; machine-readable layout receipts must prove that fitting and capture use. The carousel must progress from hook/problem through product flow and concrete result to export/share outcome and CTA. Both videos must use capture-specific motion, zoom, or highlights that substantiate the narration. Acceptance requires parent inspection of all four social graphics, all five carousel slides, and dense contact sheets for both video ratios. A visually generic, text-template, capture-light, or merely technically valid package fails closed and starts a repair loop.

## Grounded baseline

Observed on 2026-07-15 before activation:

- The target directory and Git repository were created new during the Build Week submission period. It began with no source files or history.
- `sickn33/pitchflow` did not exist and is the pre-authorized public GitHub destination.
- The prior `alemicali/cursor_meetup` repository is product research only. No code, prompts, assets, or history may be imported.
- GitHub CLI live authentication was verified as `sickn33` with `repo`, `workflow`, `read:org`, and `gist` scopes.
- Vercel CLI live authentication was verified as `sickn33`.
- The local Codex credential file exists with mode `0600`. Only key names and file metadata were inspected; credential values were not read or copied.
- The globally installed Codex CLI is unusable because its architecture package is missing the native binary (`ENOENT`). This task itself runs in authenticated Codex Desktop. PitchFlow will pin a project-local Codex SDK/runtime and will not depend on that broken global executable.
- Node.js 26.5.0, npm 11.17.0, pnpm 10.32.1, Bun 1.3.13, Git 2.50.1, GitHub CLI 2.96.0, Vercel CLI 50.35.0, FFmpeg 8.1.2, and FFprobe 8.1.2 are installed. Approximately 63 GiB was free.
- Nicco requested the Build Week Codex credit grant, but award/activation was not independently verified. Platform API billing is not authorized.

## Live rules snapshot

The following primary pages were read on 2026-07-15 and must be re-read before submission:

- Official rules: <https://openai.devpost.com/rules>
- FAQ: <https://openai.devpost.com/details/faqs>
- Resources: <https://openai.devpost.com/resources>
- Updates: <https://openai.devpost.com/updates>

The currently observed mandatory submission facts are:

- Build with Codex and GPT-5.6; both must be material rather than incidental.
- Submit in one track. PitchFlow targets Developer Tools.
- Provide a working and consistently runnable project, a repository URL, English text, and clear judge testing instructions.
- Provide a public YouTube demonstration video no longer than three minutes, with audio explaining the product, Codex collaboration, and GPT-5.6 use.
- Provide the `/feedback` Codex Session ID from the primary build task.
- For a developer tool, include installation instructions, supported platforms, and a test path that does not require judges to rebuild from scratch.
- New work is judged within the submission period; pre-existing and third-party materials require transparent disclosure and valid rights.
- Keep the judge-accessible product available free of charge through the judging period ending 2026-08-05 17:00 PT (2026-08-06 02:00 Europe/Rome).

## Chosen architecture

Use a small pnpm TypeScript workspace with deliberately few runtime boundaries:

- `apps/web`: Next.js/React local workspace and public cached viewer. Local-only generation routes are hard-disabled in public viewer mode.
- `packages/core`: Zod schemas, GitHub URL normalization, bounded ingestion, evidence records, claim rules, campaign versioning, export inventory, and deterministic fixtures.
- `packages/codex`: project-local Codex SDK adapter pinned to GPT-5.6, schema validation, repair loop, prompt/version metadata, and safe auth preflight.
- `packages/remotion`: one manifest-driven 25–40 second composition rendered reproducibly in 1920x1080 and 1080x1920 H.264 MP4.
- `packages/cli`: one-command launcher that starts the local web workspace and opens it when requested.
- `artifacts/dogfood`: immutable PitchFlow campaign manifest and all public judge exports.
- `artifacts/verification`: timestamped machine-readable checks, screenshots, media probes, audit reports, and clean-run summaries.

`packages/cli` also owns `connect`, which binds only to `127.0.0.1`, passes the exact allowed public origin to the local runtime, and never prints pairing/session material. `apps/web` owns the in-memory bridge protocol, companion APIs, job orchestration, and the shared public/local product UI. Repository input is untrusted. Intake uses GitHub APIs or bounded raw fetches and never checks out or executes submitted code. Local Codex authentication remains in the supported credential store and is never copied to source, logs, bundles, CI, or Vercel.

## Required product behavior

### Repository intake

- Accept canonical public `github.com/{owner}/{repo}` URLs with an optional supported ref.
- Normalize owner, repository, and ref; reject ambiguous hosts, embedded credentials, unsafe paths, fragments, and unsupported URL shapes.
- Resolve and persist the analyzed commit SHA.
- Fetch metadata, README, license, languages, selected manifests/docs, and a bounded source tree.
- Enforce file-count, per-file byte, total-byte, timeout, binary, path, and secret-pattern limits.
- Never run repository code and never render untrusted HTML unsanitized.
- Explain private, missing, empty, oversized, rate-limited, and unsupported failures.

### Evidence and generation

- Runtime-validate `RepoSnapshot`, `EvidenceItem`, `FeatureClaim`, `ProductBrief`, `CampaignManifest`, `CreativeAsset`, and `RenderJob`.
- Require every factual `FeatureClaim` to reference valid evidence IDs, the pinned commit, a source path or normalized repository fact, an excerpt/fact, confidence, and classification.
- Allow only `fact`, `supported_inference`, or `user_supplied` classifications; user approval is visible for inferences.
- Refuse fabricated usage metrics, testimonials, customers, integrations, performance claims, and unsupported superlatives.
- Use GPT-5.6 as creative director through the authenticated local Codex SDK/workflow.
- Record model, prompt version, schema version, generation time, source commit, errors, and repair attempts without secrets.
- Include deterministic fixture mode for automated tests, plus a preserved real GPT-5.6 smoke proof.

### Product workspace and exports

- Let a user review evidence; edit audience, positioning, tone, channels, design tokens, and claims; generate; preview; regenerate; version; and export.
- Produce a responsive accessible microsite with hero, problem, evidence-backed features, workflow, real product capture, CTA, and provenance.
- Produce a 1200x630 Open Graph image, at least three exact-dimension social cards, and a five-slide carousel.
- Produce X, LinkedIn, Product Hunt, short email, CTA, and headline variants.
- Render one 25–40 second Remotion timeline as 1920x1080 and 1080x1920 H.264 MP4 with captions and safe zones.
- Produce JSON manifest, asset index, copy bundle, static microsite package, and ZIP with safe archive paths.
- Use real product UI captures only. Optional image generation may create supporting textures/art, never fake UI.
- Expose an immediate cached dogfood path in the public no-login viewer and an honest local-generation path.
- Expose an engine state that distinguishes disconnected, awaiting local approval, connected, authentication required, rate-limited, and failed conditions without inventing readiness.
- Preserve repository URL, direction fields, and 2–4 bounded captures through pairing or the local-open fallback.
- Report real job stages, cancellation, retry, failure, and completion; never timer-simulate work.
- Keep each generated campaign and every asset/ZIP isolated to its paired short-lived session.

## Primary verifier

Against the exact deployed public SHA and without relying on README or spoken explanation, a first-time-user review at 1440px desktop and an actual 390px mobile viewport must answer correctly within five seconds:

1. What do I provide? A GitHub repository plus real product captures and direction.
2. What does PitchFlow do? Understands the product from repository evidence and directs a launch campaign with GPT-5.6 through local Codex.
3. What do I receive? Website, Images, Videos, Copy, and one complete Export package.
4. How do I try it? Explore the complete public dogfood demo immediately; start `pitchflow connect`, pair the user-owned engine, and run a real fresh-repository job without sending provider credentials to Vercel.

The verifier must then interact with the same continuous Analyze → Direct → Generate → Deliver → Export journey, explore every real dogfood output, exercise the immutable download, pair an actual loopback companion from the HTTPS deployment in Edge or Chrome, and run the second-repository proof through the user-owned Codex engine. It must assert exact screenshot dimensions, zero root horizontal overflow, operable controls and delivery tabs, zero console errors, and no serious or critical accessibility violations. A blunt product review must explicitly fail the gate if the interface reads as an auditor dashboard, a disconnected landing page, a decorative mock, or a hosted-generation claim whose work actually occurs only after an unexplained redirect.

Acceptance evidence belongs under `artifacts/verification/{timestamp}/product-reset/` and must include full-page desktop/mobile screenshots, interaction/readback results, the exact deployed SHA, and Nicco's explicit approval of the redesigned live experience.

## Supporting verifiers

The repository must expose `pnpm check:all` covering:

- formatting and lint;
- strict TypeScript checking;
- unit and integration tests;
- production build;
- deterministic Playwright happy and failure paths;
- automated accessibility checks with no serious violations;
- schema, evidence-link, image-dimension, ZIP, and asset-index checks;
- Remotion composition and render smoke;
- FFprobe validation of both production MP4s;
- secret, dependency, license, and provenance audits;
- public links and submission completeness.

Additional required commands:

- a guarded real Codex/GPT-5.6 smoke command;
- clean install/build/test verification;
- production smoke against GitHub and Vercel;
- Lighthouse or equivalent public-path evidence targeting accessibility >= 90;
- final `pnpm check:all` twice consecutively with no source changes.

Focused bridge checks must cover pairing entropy, exact origin allowlists, browser preflight/private-network behavior, token expiry, replay rejection, secret redaction, provider detection, bounded job input, lifecycle transitions, cancellation, retry, progress provenance, result isolation, safe asset reads, and ZIP ownership.

The earlier functional, clean-state, media, schema, evidence, export, security, provenance, and immutable-package checks remain mandatory supporting gates. They may not replace or weaken the live comprehension gate.

## Iteration loop

For each slice:

1. Inspect the strongest current failure or missing proof.
2. Change one coherent behavior or verifier.
3. Run the narrowest strong test, then the applicable aggregate check.
4. Record command, result, evidence path, and decision in `WORKLOG.md`.
5. If a verifier fails, diagnose and repair; never delete, skip, relabel, or weaken it.
6. Continue while a safe relevant action remains.

## Anti-cheating rules

- Do not copy, adapt, or conceal code, assets, prompts, or history from `alemicali/cursor_meetup`.
- Do not fake generation, progress, product screenshots, claims, outputs, media probes, public readbacks, or clean-state tests.
- Fixtures may support tests and the cached judge example, but cannot replace real GitHub ingestion and a real GPT-5.6 proof.
- Do not hard-code a success response for the live path.
- Do not weaken scope, thresholds, tests, or evidence requirements after a failure.
- Do not expose personal Codex OAuth/session state publicly or use it as a multi-tenant backend.
- Do not use general OpenAI Platform API spend without separate approval.
- Do not add third-party media, marks, voices, repositories, or screenshots without documented rights.
- Do not declare completion while any mandatory proof is missing, simulated, inaccessible, stale, or contradicted by the running product.

## Red-team of the finish line

| Failure mode                                      | How the words could be gamed                       | Non-gameable check                                                                                                      |
| ------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Static demo masquerades as generation             | Cached JSON alone could satisfy the visible viewer | Preserve a real Codex/GPT-5.6 generation report for a second repository with model and schema metadata                  |
| Claims look sourced but evidence is broken        | Evidence IDs could be decorative                   | Audit every factual claim against the exact snapshot evidence set and pinned commit                                     |
| Video files exist but are invalid                 | Empty or mislabeled files could pass path checks   | FFprobe codec, dimensions, duration, streams, decode check, first/middle/last frame inspection                          |
| Public viewer looks complete but downloads fail   | UI buttons could be inert                          | Unauthenticated browser download plus checksum match for every required cached asset                                    |
| "One command" still requires rebuilding/debugging | A script name alone could be claimed               | Clean-profile install/launch proof and documented supported platform                                                    |
| Public app leaks local Codex authority            | Generation route could accidentally ship           | Deployment-mode assertion, route denial tests, secret scan, and public request proving live generation is unavailable   |
| Old work is hidden in a new history               | Files could be copied without commits              | Provenance audit, clean initial commit, file similarity/manual review, and explicit zero-import statement               |
| Tests pass by skipping hard suites                | Aggregate script could omit required work          | Submission audit enumerates and asserts every mandated sub-verifier and two full logs are preserved                     |
| Screenshots hide broken interaction               | Static captures could look polished                | Playwright completes the real cached journey with zero console errors and verifies download responses                   |
| "GPT-5.6" is only documentation                   | Model could never run                              | Code-level model assertion plus redacted real run metadata from the authenticated Codex SDK path                        |
| Pairing token becomes a bearer leak               | A URL or log could expose local job authority      | Scan URLs, console, storage, logs, reports, commits, and deployment env; accept tokens only in memory and auth headers  |
| Timers impersonate generation                     | UI stages could advance without real work          | Stage timestamps must be emitted by the intake, Codex, renderer, validator, and packager boundaries                     |
| One session reads another result                  | Guessable job IDs could expose media or ZIP        | Cross-session job/status/asset/download requests must fail; asset paths remain traversal-safe                           |
| Second repo quietly reuses dogfood                | PitchFlow assets could be relabeled as a fresh run | Hash/copy/campaign audit rejects every PitchFlow dogfood identifier, hash, claim, and media asset in VibePalette output |

## Approval gates and authority

### Bounded delegation authorization

Nicco explicitly authorized bounded subagents on 2026-07-15 after activation. This authorization does not relax the finish line, provenance, security, approval, or anti-cheating rules.

- Use at most three concurrent child agents so the parent retains one execution slot.
- Each child receives a concrete objective, explicit non-overlapping file ownership, non-goals, verifier, stop condition, and evidence-return requirement.
- Children must preserve concurrent edits, may not rewrite shared history, and must adapt to other work in the repository.
- Preferred independent lanes are `apps/web` product/accessibility, `packages/remotion` media rendering, and read-only or test-only independent verification.
- The parent retains `packages/core`, `packages/codex`, repository integration, durable goal files, Git/GitHub/Vercel operations, primary GPT-5.6 proof, public actions, final synthesis, final clean-state verification, `/feedback` provenance, and `update_goal` completion unless it assigns a narrower non-overlapping subset.
- Children may not create goals or further agents, enable Platform API spend, access credentials, publish or deploy, touch Devpost or YouTube, inspect/copy the old implementation, weaken tests, or mark the goal complete.
- The parent must integrate each result and rerun the strongest relevant verifier before accepting it.

Already authorized:

- create and push public `sickn33/pitchflow`;
- create and deploy the public Vercel viewer under authenticated `sickn33`;
- install local dependencies, run browsers and renderers, use eligible Codex credits, and make local/public Git changes within this goal.

Still requires Nicco's explicit confirmation:

- publish the demonstration video to YouTube;
- edit any public Devpost fields;
- perform the final Devpost submission;
- enable or spend OpenAI Platform API billing;
- provision paid cloud/video services;
- use any uncertain third-party copyrighted or trademarked material;
- delete or rewrite external repositories, deployments, or user data.

YouTube publication and every Devpost edit/submission are frozen until the redesigned live product has passed the primary verifier and Nicco explicitly approves that exact live experience. Earlier broad publication approval was superseded by the product reset and does not authorize publication of the rejected surface.

The gated YouTube URL and Devpost submission are mandatory for the actual competition entry. Until approved, completion proof must contain the finished local video and final Devpost copy/media inventory, and `RESULT.md` must identify publication/submission as the remaining explicit gate rather than claim the entry was submitted.

## Provenance policy

- This repository starts from scratch during the submission window.
- Standard open-source packages are allowed only under compatible licenses and are inventoried.
- Every non-code creative asset records source, owner, license/permission, introduction date, and transformation.
- `docs/PROVENANCE.md` is the canonical ledger.
- If ownership or license is uncertain, do not import the material.

## Blocker standard

Difficulty, slow rendering, a failed install, an unfamiliar API, or a first failed deployment is not a blocker. A blocker requires the same external condition to recur for at least three goal turns, no safe useful work to remain, and `WORKLOG.md` to record the exact error, three attempts/readbacks, failed alternatives, preserved artifacts, and smallest external action needed.

## Completion proof

Before `update_goal(status="complete")`, `RESULT.md` must contain all of the following:

- public demo URL and timestamped unauthenticated readback;
- public repository URL and final commit SHA;
- exact deployed product-reset SHA and full-page 1440px plus genuine 390px screenshots whose pixel dimensions were independently checked;
- first-time-user comprehension evidence covering input, transformation, outputs, public demo, and repository-preserving local handoff;
- live Edge/Chrome proof from the HTTPS deployment covering disconnected detection, pairing or the policy-driven local-open fallback, exact-origin enforcement, and explicit local approval;
- pairing/session security evidence covering entropy, expiry, replay, redaction, bounded inputs, cancellation/retry, result isolation, and absence of token material from URLs/storage/logs/reports;
- a real VibePalette Codex/GPT-5.6 generation report and complete repository-specific package with visually inspected images and both videos and a no-dogfood-leakage audit;
- Nicco's explicit approval of the redesigned live experience;
- one-command install/launch path and clean-profile proof;
- Codex SDK/local-auth proof without credential disclosure;
- exact clean install/build/test commands and two consecutive full-pass logs;
- redacted real GPT-5.6 smoke evidence;
- complete evidence-link audit;
- paths and SHA-256 checksums for site, images, carousel, both MP4s, copy, manifest, asset index, and ZIP;
- FFprobe and decode validation for both MP4s;
- responsive screenshots, accessibility/Lighthouse evidence, and browser report/trace locations;
- secret, dependency, license, and provenance audit results;
- README and five-minute judge-path readback;
- final demo video path and, after approval, public YouTube URL;
- final English Devpost copy and media inventory;
- primary task `/feedback` Session ID, or an explicit manual invocation gate if the interface requires Nicco to run it;
- a truthful residual-risk list;
- proof that all public claims match the running product;
- two consecutive final green runs without intervening source changes.

Completion is forbidden while any mandatory product or evidence item is broken, fake, or absent. If the only missing items are gated public actions, the goal remains active unless Nicco explicitly changes the finish line or authorizes those actions.
