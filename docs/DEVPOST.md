# PitchFlow — final Devpost submission copy

Status: **content complete; public YouTube publication, Devpost field edits, `/feedback`, and final submission remain explicit approval/manual gates.**

## Submission fields

- **Project name:** PitchFlow
- **Tagline:** Ship the code. PitchFlow ships the story.
- **Category:** Developer Tools
- **Public viewer:** <https://pitchflow-ten.vercel.app>
- **Public repository:** <https://github.com/sickn33/pitchflow>
- **YouTube demo:** insert the approved public URL after the finished local video passes verification
- **Primary `/feedback` Session ID:** insert after Nicco invokes `/feedback` in the primary build task

## Short description

PitchFlow is a local-first, repo-native AI launch studio. Give it a canonical public GitHub repository URL; it pins one commit, gathers bounded evidence without cloning or executing the project, and uses GPT-5.6 Sol through the developer's authenticated Codex workflow to direct one schema-validated, evidence-linked campaign. That manifest drives a microsite, social system, carousel, channel copy, dual-ratio Remotion video, checksums, and a safe ZIP.

## Inspiration

Small developer teams often finish the product before they can explain it. Launch work then becomes a scramble across generic AI copy, screenshots, ad hoc design files, and unverifiable claims. The missing tool was not another copy box. It was a creative production system that treats the repository as bounded evidence, makes every factual claim inspectable, and still produces a coherent campaign across channels.

## What it does

PitchFlow starts with a strict public GitHub repository URL and resolves an immutable commit SHA. It reads only bounded repository metadata, language data, tree records, selected documentation, manifests, and license evidence from fixed GitHub hosts. It never clones, installs, imports, builds, or executes submitted code, and it redacts likely secrets.

The developer adjusts audience, positioning, tone, and channels, then explicitly authorizes a local Codex turn. GPT-5.6 Sol acts as the material creative director through the official Codex SDK. Its response must satisfy a strict JSON schema and evidence contract. Every factual claim links to exact evidence records; unsupported metrics, customers, testimonials, and superlatives fail validation.

Creators can review or edit claims, explicitly approve supported inferences, attach two to four real product screenshots with ownership and provenance, and export one complete package:

- a responsive static microsite;
- exact-size Open Graph, X, LinkedIn, and Instagram graphics;
- five 1080×1350 carousel slides;
- X, LinkedIn, Product Hunt, email, headline, and CTA copy;
- reproducible 1920×1080 and 1080×1920 Remotion H.264 masters;
- campaign, evidence, capture, and render receipts;
- a SHA-256 asset index; and
- a traversal-safe ZIP.

The public Vercel deployment is intentionally an immutable, no-login judge viewer. Its analyze, generate, and export routes fail closed. Fresh Codex authentication and generation stay on the developer's machine; no personal OAuth session or API key is deployed.

## How we built it

PitchFlow is a TypeScript/pnpm monorepo with a Next.js workspace, strict Zod schemas, a bounded GitHub intake engine, an official Codex SDK adapter pinned to `gpt-5.6-sol`, deterministic Sharp exports, Remotion rendering, FFmpeg/FFprobe media verification, Vitest, Playwright, axe, Lighthouse, license/secret/dependency scanners, and Vercel for the public cached viewer.

The accepted dogfood campaign was generated from PitchFlow's own pinned public commit through a real authenticated Codex turn:

- model: `gpt-5.6-sol`;
- provider: official Codex SDK;
- prompt version: `creative-director-2026-07-15.2`;
- repair attempts: `0`;
- evidence-linked claims: `8`;
- checked claim-to-source links: `49`;
- Codex thread: `019f6446-a899-7ac0-9995-b6e936c03427`;
- personal credential values read or printed: `false`.

## How Codex accelerated the work

Codex was the primary development partner across architecture, implementation, testing, media, and deployment. It helped turn the design packet into executable schemas and adversarial finish-line checks; implement the evidence engine, SDK boundary, export pipeline, local launcher, browser workspace, and Remotion renderer; trace failures across unit, browser, media, and public-deployment layers; and preserve a durable repair log.

The collaboration was not one-shot generation. Key product and engineering decisions stayed explicit and reviewable: use the user's Codex entitlement instead of deploying personal OAuth; separate the public immutable viewer from local generation; pin source evidence before GPT runs; treat model tools as forbidden during the structured creative-director turn; and make failed verifiers start repair loops. Independent review rejected two technically valid video candidates because their visible product proof was insufficient. The content contract, captures, pacing, and export handoff were repaired and reverified rather than accepted as “good enough.”

## Challenges

The hardest problem was making creative output both compelling and falsifiable. It required one canonical manifest, exact evidence equality, explicit inference approval, and a renderer that could prove each visible claim with real product UI. The first media candidates passed codec and dimension checks but failed marketing acceptance. Another challenge was keeping fresh generation local while offering judges a complete no-login experience. The final split—local Codex orchestration plus an immutable cached dogfood viewer—solved both security and judge latency.

## Accomplishments

- A real local Codex/GPT-5.6 path with schema validation and no Platform API key.
- A self-dogfood package generated from a pinned public PitchFlow commit.
- Forty-nine checked evidence links across eight campaign claims.
- Real product capture provenance and scene-to-capture coverage.
- Deterministic, independently inspected dual-ratio Remotion masters.
- Twenty-five immutable public assets with byte-for-byte SHA-256 readback.
- Public mutation routes denied before parsing and no cloud Codex identity.
- A judge path that works without a live presentation or model wait.

## What we learned

Evidence cannot be a decorative citation badge; it has to constrain generation and survive every export surface. Technical video validity is also not marketing validity: real UI, semantic shot selection, audience-facing copy, pacing, and a truthful handoff require separate acceptance gates. Finally, local-first AI can still be easy to judge when the public surface is a verified, immutable artifact rather than a proxy for someone's private authentication.

## What's next

After Build Week, the next safe extensions are additional repository hosts, reusable campaign templates, opt-in team review, and an optional separately authorized Platform API adapter. The core boundary remains: public source evidence in, inspectable claims out, and private developer authentication stays local.

## Judge testing instructions

Fast path: open <https://pitchflow-ten.vercel.app> without signing in. Inspect Evidence, Preview, Copy, both videos, the social and carousel galleries, real product captures, SHA-256 values, and the downloadable ZIP. The public status endpoint reports generation disabled, and all mutation routes return `403 PUBLIC_VIEWER_READ_ONLY`.

Fresh local path on macOS or Linux:

```bash
pnpm install --frozen-lockfile
pnpm pitchflow
```

Requirements: Node.js `>=20.9 <27`, pnpm 10.32.1, Chrome/Edge/Chromium, FFmpeg/FFprobe for independent video inspection, and an authenticated Codex installation with GPT-5.6 Sol access. No OpenAI Platform API key is required. Full instructions and the five-minute judge path are in `README.md` and `docs/JUDGING.md`.

## Originality, pre-existing material, and licenses

PitchFlow is new work created during the Build Week submission period. The prior `alemicali/cursor_meetup` repository informed only high-level product research; no code, assets, prompts, or Git history from it were copied, adapted, or imported. Creator-owned real PitchFlow browser captures are used in the submission and videos. Standard open-source dependencies and Remotion's applicable license are inventoried in `docs/PROVENANCE.md`. The demo uses no copyrighted music or third-party footage.

## Submission media inventory

| Role               | File                                                |                   Dimensions | SHA-256                                                            |
| ------------------ | --------------------------------------------------- | ---------------------------: | ------------------------------------------------------------------ |
| Thumbnail / cover  | `submission/media/pitchflow-cover-1800x1200.png`    |                    1800×1200 | `aece40e4e081dde45f532f98c910b23a5334b7c12b19011333f3059d0eb1697a` |
| Gallery — evidence | `submission/media/pitchflow-evidence-1800x1200.png` |                    1800×1200 | `9a9c08e8172f3844707e2da50d675a9209ea9e9e2a003107fb821e2b066fde42` |
| Gallery — handoff  | `submission/media/pitchflow-handoff-1800x1200.png`  |                    1800×1200 | `6e15a8a0d208877e01634b2203573d8e268624df961dacaaba8874c4d49f5b77` |
| Narrated demo      | `submission/demo/pitchflow-build-week-demo.mp4`     | 1920×1080, under 3:00, audio | pending final render and verification                              |

The media manifest at `submission/media/manifest.json` records the real UI source hashes, creator ownership, deterministic composition method, and `fakeProductUi: false`.

## Remaining gated fields

Do not describe the project as submitted until all four are real:

1. finished local narrated demo passes media and visual review;
2. Nicco explicitly authorizes YouTube publication and the public URL is read back;
3. Nicco invokes `/feedback` in the primary task and supplies the Session ID;
4. Nicco explicitly authorizes Devpost field edits and final submission, followed by a public submission readback.
