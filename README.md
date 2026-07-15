# PitchFlow

> Ship the code. PitchFlow ships the story.

PitchFlow is a local-first, repo-native AI launch studio built from scratch for OpenAI Build Week in the **Developer Tools** category. Give it a canonical public GitHub repository URL. It pins one commit, gathers bounded evidence without cloning or executing the project, and asks **GPT-5.6 Sol through your authenticated local Codex workflow** to direct an evidence-linked campaign.

One validated `CampaignManifest` then drives:

- a responsive static microsite with real product UI captures;
- Open Graph, X, LinkedIn, and Instagram graphics at exact dimensions;
- a five-slide 1080x1350 carousel;
- X, LinkedIn, Product Hunt, email, headline, and CTA copy;
- reproducible 1920x1080 and 1080x1920 Remotion H.264 videos; and
- a checksummed asset index plus traversal-safe ZIP.

The public Vercel experience is the same product workspace, preloaded with an immutable no-login PitchFlow demo. For a fresh repository it pairs with a loopback-only companion started by the developer; the job runs on that machine and its new outputs replace the demo in Website, Images, Videos, Copy, and Export. No personal Codex OAuth or session is deployed as a backend.

## Judge path

Open the no-login production viewer: **<https://pitchflow-ten.vercel.app>**.

The workspace presents the complete PitchFlow dogfood campaign immediately. Judges can explore its website, copy, real product captures, social system, five-slide carousel, both Remotion masters, and complete ZIP without waiting for a model call. The detailed hashes, provenance, security boundary, and Build Week proof remain secondary under `/evidence`.

For fresh generation through your own Codex entitlement:

```bash
pnpm install --frozen-lockfile
pnpm pitchflow connect
```

`pnpm pitchflow connect` builds and starts the production companion on `127.0.0.1:3210`, waits until it is healthy, and opens the local approval workspace. Use `pnpm pitchflow connect --no-open` for a terminal-only launch or `--port 4321` for another loopback port. The hosted workspace can then request a short-lived pairing; the user approves the exact repository, direction, and capture digest locally before generation begins.

Then:

1. paste a canonical public URL such as `https://github.com/owner/repository`;
2. inspect the resolved commit and bounded evidence records;
3. adjust audience, positioning, tone, and channels;
4. acknowledge use of your local Codex entitlement and generate with GPT-5.6 Sol;
5. inspect or edit claims and explicitly approve supported inferences;
6. attach 2–4 real PNG/JPEG product screenshots with provenance; and
7. export the complete package. The browser downloads the ZIP only after both Remotion masters finish.

No OpenAI Platform API key is required or supported by the current product path.

## How Codex and GPT-5.6 built PitchFlow

Codex was the primary development partner across architecture, implementation, testing, media, and deployment. It accelerated the work by turning the finish line into executable contracts; implementing the evidence engine, local SDK boundary, export pipeline, browser workspace, launcher, and Remotion renderer; and tracing failures across unit, browser, media, security, and public-deployment gates.

The key product and engineering decisions remained explicit:

- keep the user's authenticated Codex session local and deploy no personal OAuth or generation proxy;
- pin and integrity-check repository evidence before any model turn;
- make GPT-5.6 Sol the schema-constrained cross-channel creative director, with no fallback model or accepted tool activity;
- keep public claims linked to exact source records and mark human edits as user-supplied;
- require real product UI captures and deterministic Remotion outputs; and
- reject technically valid work when independent content review shows weak proof, then repair and rerun the same gate.

The accepted real dogfood turn used `gpt-5.6-sol` through the official Codex SDK, required zero schema repairs, produced eight claims, and passed forty-nine evidence-link checks. See [docs/CODEX_COLLABORATION.md](docs/CODEX_COLLABORATION.md) for the exact runtime and collaboration boundary and [WORKLOG.md](WORKLOG.md) for the preserved repair history.

## Requirements

- Node.js `>=20.9 <27` (Node 24 is used in CI)
- pnpm 10.32.1 through Corepack or a local installation
- an authenticated Codex installation for fresh GPT-5.6 generation
- Chrome, Edge, or Chromium for Remotion and browser verification
- FFmpeg/FFprobe for independent production media verification
- macOS or Linux; the static public viewer works in current evergreen browsers

Check local Codex status without reading credential values:

```bash
pnpm --filter @pitchflow/codex exec codex login status
```

If needed, authenticate through the official local flow:

```bash
pnpm --filter @pitchflow/codex exec codex login
```

## Safety model

- Input must be a strict `https://github.com/{owner}/{repo}` URL with an optional supported ref.
- Intake uses fixed GitHub API/raw hosts, resolves a commit SHA, enforces file/byte/time limits, filters binary content, and redacts likely secrets.
- Repository content is untrusted data. PitchFlow never clones, installs, imports, builds, or executes submitted code.
- Snapshot IDs and evidence hashes are recomputed before model generation and again before export.
- Every factual campaign surface carries evidence IDs; unsupported metrics, testimonials, customers, and superlatives are prohibited.
- Codex runs from an isolated temporary directory with a small environment allowlist. Tool activity in the structured creative-director turn is a hard failure.
- Public deployment mode has no provider authority. Fresh generation is performed only by an explicitly paired loopback companion; legacy hosted mutation routes still reject before request payload processing.
- Product captures are validated locally and never included in the Codex prompt.
- Pairing uses exact origin/Host checks, high-entropy expiring in-memory tokens, one-time local approval challenges, replay-resistant request IDs, bounded inputs, and session-owned result access. Secrets and session tokens are never placed in URLs or persistent browser storage.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/CODEX_COLLABORATION.md](docs/CODEX_COLLABORATION.md), [docs/JUDGING.md](docs/JUDGING.md), [docs/PROVENANCE.md](docs/PROVENANCE.md), and [docs/DEVPOST.md](docs/DEVPOST.md) for the full judge, submission, and audit trail.

## Verification

```bash
pnpm check:all
```

The final aggregate gate covers formatting, zero-warning lint, strict TypeScript, unit/integration tests, a production build, Playwright happy/failure/mobile journeys, axe accessibility, media probes, secret/dependency/license/provenance checks, and submission completeness. The final release is accepted only after two consecutive clean-state passes with no source change.

Useful narrower commands:

```bash
pnpm test
pnpm test:e2e
pnpm smoke:github -- --repo https://github.com/owner/repository --output artifacts/verification/run/repo-snapshot.json
pnpm smoke:codex -- --snapshot artifacts/verification/run/repo-snapshot.json --output artifacts/verification/run/campaign-manifest.json
pnpm smoke:render -- --manifest path/to/manifest.json --snapshot path/to/snapshot.json --output artifacts/exports/run --capture path/to/ui-1.png --capture path/to/ui-2.png
pnpm verify:connected-engine -- --repo https://github.com/owner/repository --output artifacts/verification/fresh --capture path/to/ui-1.png --capture path/to/ui-2.png
pnpm verify:creative-output -- --bundle artifacts/verification/fresh --output artifacts/verification/fresh-inspection --expected-product ProductName
```

## Repository map

```text
apps/web           unified public/local workspace + secure loopback bridge
packages/core      schemas, GitHub intake, evidence, security, manifest logic
packages/codex     authenticated GPT-5.6 Sol orchestration
packages/export    static site, graphics, copy, bundle, ZIP
packages/remotion  deterministic dual-ratio motion renderer
packages/cli       one-command production companion and local launcher
scripts            real smoke and independent verification commands
docs               architecture, judging, provenance, submission material
```

## Provenance

PitchFlow is new work created during the Build Week submission period. The earlier `alemicali/cursor_meetup` repository is acknowledged only as product-concept research; no code, assets, prompts, or Git history from it were copied, adapted, or imported. Full asset ownership and third-party software disclosures live in [docs/PROVENANCE.md](docs/PROVENANCE.md).

## License

MIT. See [LICENSE](LICENSE).
