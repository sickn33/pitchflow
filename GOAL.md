# PitchFlow Build Week Goal

Status: **ACTIVE**  
Prepared: 2026-07-15 06:11 CEST  
Internal submission-ready deadline: **2026-07-21 18:00 Europe/Rome**  
Official submission deadline: **2026-07-22 02:00 Europe/Rome** (2026-07-21 17:00 PT)  
Category: **Developer Tools**

## Active objective

Complete and verify the PitchFlow OpenAI Build Week product defined in `/Users/nicco/Projects/Playground/pitchflow-build-week/GOAL.md`, including a working public judge path, evidence-grounded GPT-5.6 generation, exportable site/social/video/copy assets, clean-state tests, and the complete submission evidence packet.

## Outcome

PitchFlow is a repo-native AI launch studio. From a canonical public GitHub repository URL, it gathers a bounded, commit-pinned evidence set and uses GPT-5.6 through the user's authenticated local Codex workflow to produce an editable, evidence-grounded `CampaignManifest`. That manifest reproducibly drives a responsive microsite, social graphics, a five-slide carousel, channel copy, and 16:9 plus 9:16 Remotion videos.

The finished entry must include both:

1. a one-command local workspace that performs real repository intake and Codex/GPT-5.6 generation without copying personal credentials; and
2. a no-login public Vercel viewer containing an immutable, complete PitchFlow dogfood campaign for judges.

Tagline: **Ship the code. PitchFlow ships the story.**

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

Repository input is untrusted. Intake uses GitHub APIs or bounded raw fetches and never checks out or executes submitted code. Local Codex authentication remains in the supported credential store and is never copied to source, logs, bundles, CI, or Vercel.

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

### Judge workspace and exports

- Let a user review evidence; edit audience, positioning, tone, channels, design tokens, and claims; generate; preview; regenerate; version; and export.
- Produce a responsive accessible microsite with hero, problem, evidence-backed features, workflow, real product capture, CTA, and provenance.
- Produce a 1200x630 Open Graph image, at least three exact-dimension social cards, and a five-slide carousel.
- Produce X, LinkedIn, Product Hunt, short email, CTA, and headline variants.
- Render one 25–40 second Remotion timeline as 1920x1080 and 1080x1920 H.264 MP4 with captions and safe zones.
- Produce JSON manifest, asset index, copy bundle, static microsite package, and ZIP with safe archive paths.
- Use real product UI captures only. Optional image generation may create supporting textures/art, never fake UI.
- Expose an immediate cached dogfood path in the public no-login viewer and an honest local-generation path.

## Primary verifier

From a clean checkout or equivalent isolated clean state:

1. Install and launch PitchFlow using the single documented command.
2. Confirm supported local Codex authentication without printing or copying credentials.
3. Open the local workspace and submit a public GitHub repository distinct from the cached dogfood campaign.
4. Confirm the pinned commit SHA and inspect at least three generated factual claims with working evidence links.
5. Generate a schema-valid campaign through a real GPT-5.6 Codex run.
6. Preview the responsive microsite and export the static site, image pack, five-slide carousel, both MP4s, copy pack, manifest, asset index, and ZIP.
7. Independently validate schemas, dimensions, hashes, ZIP safety, MP4 codec/dimensions/duration/playability, browser console, accessibility, and responsive states.
8. Open the public viewer unauthenticated, load the immutable PitchFlow dogfood example, and verify every cached export by URL and checksum.

Preserve the acceptance evidence under `artifacts/verification/{timestamp}/`.

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

| Failure mode                                      | How the words could be gamed                       | Non-gameable check                                                                                                    |
| ------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Static demo masquerades as generation             | Cached JSON alone could satisfy the visible viewer | Preserve a real Codex/GPT-5.6 generation report for a second repository with model and schema metadata                |
| Claims look sourced but evidence is broken        | Evidence IDs could be decorative                   | Audit every factual claim against the exact snapshot evidence set and pinned commit                                   |
| Video files exist but are invalid                 | Empty or mislabeled files could pass path checks   | FFprobe codec, dimensions, duration, streams, decode check, first/middle/last frame inspection                        |
| Public viewer looks complete but downloads fail   | UI buttons could be inert                          | Unauthenticated browser download plus checksum match for every required cached asset                                  |
| "One command" still requires rebuilding/debugging | A script name alone could be claimed               | Clean-profile install/launch proof and documented supported platform                                                  |
| Public app leaks local Codex authority            | Generation route could accidentally ship           | Deployment-mode assertion, route denial tests, secret scan, and public request proving live generation is unavailable |
| Old work is hidden in a new history               | Files could be copied without commits              | Provenance audit, clean initial commit, file similarity/manual review, and explicit zero-import statement             |
| Tests pass by skipping hard suites                | Aggregate script could omit required work          | Submission audit enumerates and asserts every mandated sub-verifier and two full logs are preserved                   |
| Screenshots hide broken interaction               | Static captures could look polished                | Playwright completes the real cached journey with zero console errors and verifies download responses                 |
| "GPT-5.6" is only documentation                   | Model could never run                              | Code-level model assertion plus redacted real run metadata from the authenticated Codex SDK path                      |

## Approval gates and authority

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
