# Judge guide

PitchFlow targets **Developer Tools**. The public viewer is designed to be understandable without a live presentation; the local path proves fresh generation through the judge's own supported Codex authentication.

## Five-minute public path

Open **<https://pitchflow-ten.vercel.app>**. No sign-in or test account is required.

1. Open the viewer without signing in.
2. Confirm the subject is `sickn33/pitchflow` and note the pinned commit.
3. Open **Evidence** and inspect at least three source records.
4. Open **Preview**, inspect the real PitchFlow UI captures, and follow claim evidence links.
5. Open **Copy** and compare the cross-channel launch voice.
6. Download the static site, images, carousel, two MP4s, copy, manifest, asset index, and ZIP.
7. Compare the displayed SHA-256 values with the downloaded bytes.
8. Observe that public analyze/generate/export routes are read-only and that the page directs fresh generation to the local tool.

The accepted cached campaign is pinned to PitchFlow commit `87d70cc297dc4320ed0a3e6aa059739565d0de43`. The deployment was independently read back on 2026-07-15: all 25 declared assets (183,781,036 bytes) matched their package SHA-256 values and immutable-cache contract.

## Fresh local path

### Supported setup

- macOS or Linux
- Node.js `>=20.9 <27`
- pnpm 10.32.1
- Chrome, Edge, or Chromium
- an authenticated Codex installation with access to GPT-5.6 Sol

### Launch

```bash
pnpm install --frozen-lockfile
pnpm pitchflow
```

The launcher prints and opens `http://127.0.0.1:3210` only after `/api/status` is healthy. It never binds to the LAN.

### Test

1. Submit a canonical public GitHub URL distinct from the cached PitchFlow campaign.
2. Confirm the resolved 40-character commit SHA.
3. Inspect the bounded evidence; submitted repository code is never cloned or executed.
4. Adjust the direction, acknowledge local Codex use, and generate.
5. Confirm the manifest records `gpt-5.6-sol`, Codex SDK provider, prompt/schema versions, and source commit.
6. Inspect at least three claims and their exact evidence records.
7. Edit one claim and observe it become `user_supplied`, or explicitly approve a supported inference.
8. Attach 2–4 real product screenshots with provenance, then export.
9. Inspect the microsite, four social formats, five carousel images, copy, both MP4s, render metadata, asset index, and ZIP.

The real Codex turn can take several minutes. The public viewer exists so judges never need to wait for generation to understand or score the product.

## Security checks

In public mode, these return `403 PUBLIC_VIEWER_READ_ONLY` without processing payloads:

```text
POST /api/analyze
POST /api/generate
POST /api/export
```

`GET /api/status` returns `codex: null` publicly. No Codex identity, token, or generation capability is deployed.

## Verification commands

```bash
pnpm check:all
pnpm test:e2e
```

Final machine-readable reports, clean-run logs, screenshots, asset checksums, FFprobe/decode output, Lighthouse results, and public readbacks are indexed in `RESULT.md`.

## Known deliberate choice

The generated 25–40 second social masters are silent-by-design for autoplay feeds and carry complete on-screen audience captions. The mandatory Build Week demonstration is a separate English narrated video with an audio stream and a maximum duration of three minutes.
