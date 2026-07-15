# Architecture

## System boundary

PitchFlow has two deliberately different runtime modes.

### Local companion

`pnpm pitchflow connect` builds and starts Next.js on `127.0.0.1` only. The developer submits a public GitHub URL, 2–4 captures, and direction in the unified workspace. A pairing request is bound to the canonical project digest and requires a one-time local approval challenge before a short-lived in-memory session is issued. Repository intake, the GPT-5.6 Sol turn through the official local Codex SDK/CLI installation, capture processing, Remotion rendering, and packaging remain on that machine.

### Public workspace

The Vercel build sets `PITCHFLOW_PUBLIC_VIEWER=1`. It serves the product workspace with a versioned immutable PitchFlow demo under `apps/web/public/dogfood/pitchflow/`. For fresh generation, the browser talks directly to the developer-started loopback companion after the browser's Local Network Access permission and local project approval. The deployment has no Codex credential, Platform API key, long-lived pairing token, generation proxy, or paid provider authority. Legacy hosted analyze/generate/export routes remain fail-closed.

The companion accepts only its configured exact HTTPS public origin (or an explicit loopback development origin), exact loopback Host, bounded streaming request bodies, unique mutation IDs, and bearer sessions owned by one approved project digest. Public code cannot approve pairings. Local approval requires same-origin loopback fetch metadata plus a one-time local token. Expiry cancels owned work; result reads require the same session, job, and indexed asset path.

## Data flow

1. `packages/core` strictly normalizes a GitHub URL and resolves a commit through fixed GitHub endpoints.
2. Bounded intake reads metadata, languages, tree entries, README, license, selected manifests, and documentation. It does not clone or execute the target.
3. Each normalized fact or excerpt becomes an `EvidenceItem` with commit, source URL, content hash, and deterministic ID. The full `RepoSnapshot` receives a deterministic integrity ID.
4. `packages/codex` re-audits the snapshot, creates an isolated temporary working directory, passes an explicit environment allowlist, and requests JSON Schema output from exactly `gpt-5.6-sol` at high reasoning effort.
5. A single structured-output repair is permitted for schema errors. Infrastructure failures, tool activity, wrong models, invalid evidence references, and a second invalid response fail closed.
6. `packages/core` envelopes the draft in a versioned `CampaignManifest`; every factual surface is evidence-linked and the complete manifest is audited.
7. The user may edit public copy. Edited claims become visibly `user_supplied`; supported inferences require explicit approval before export.
8. The user supplies 2–4 locally captured real product screens with label, description, and ownership/authorization. The capture bytes are not sent to Codex.
9. `packages/export` re-audits the snapshot and campaign, validates the captures, renders four distinct capture-led social layouts and a five-stage capture-led carousel, and emits deterministic text-fit/layout receipts.
10. `packages/remotion` applies scene-specific capture focus, zoom, pan, and highlights in both ratios while keeping internal `visualDirection` non-renderable.
11. Each output is hashed and inventoried before a traversal-safe ZIP is returned through the session-owned bridge result.

## Package responsibilities

| Package             | Responsibility                                                   | Important fail-closed boundary                                         |
| ------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `apps/web`          | Unified public/local workspace and loopback pairing/job bridge   | Exact origin/Host, local approval, expiry/replay and result ownership  |
| `packages/core`     | Schemas, URL parsing, intake, evidence integrity, manifest audit | Untrusted repository data is bounded, redacted, and never executed     |
| `packages/codex`    | Local authenticated creative-director turn                       | Exact model, isolated cwd, environment allowlist, no accepted tool use |
| `packages/export`   | Site, capture-led graphics, copy, receipts, checksums, ZIP       | Full evidence, capture, fit and overlap validation before output       |
| `packages/remotion` | Capture-directed landscape/portrait H.264 masters                | Internal direction is not renderable; capture-free render is rejected  |
| `packages/cli`      | Production companion build, launch and health readiness          | Filtered environment and validated loopback-only origin/port           |

## Evidence model

`RepoSnapshot` and `CampaignManifest` are runtime-validated Zod contracts. Evidence IDs are derived from their normalized content and source metadata, not assigned decoratively. The snapshot ID includes the canonical repository URL, pinned commit, and complete evidence set. A change to an excerpt, content hash, evidence ID, source commit, or snapshot ID causes generation/export validation to fail.

The mechanical campaign audit covers:

- product brief;
- every feature claim;
- all microsite sections;
- every social card;
- all five carousel slides;
- channel copy; and
- every motion scene.

## Media determinism

One 30 fps timeline renders both layouts. Full-resolution software H.264 uses concurrency 1, yuv420p/BT.709, a slow x264 preset, and explicit 10 Mbps landscape / 12 Mbps portrait targets. Capture inputs are signature/dimension/size validated, copied into a private temporary Remotion public directory, and deleted after rendering. Receipts keep only hash, dimensions, media type, sequence, and accessibility text—never the original path or data URL.

## Deployment invariants

- Vercel contains the workspace and cached demo but no generation authority.
- No personal OAuth/session material is copied into environment variables, repository files, build output, or browser responses.
- No general OpenAI Platform API spend is used.
- The local server binds to `127.0.0.1`, not a network interface.
- Public package generation happens before deployment and is byte-verified after deployment.
