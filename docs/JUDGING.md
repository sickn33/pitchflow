# Judge guide

PitchFlow targets **Developer Tools**. The public product workspace is designed to be understandable without a live presentation; its immutable demo is immediate, while the local companion proves fresh generation through the judge's own supported Codex authentication.

## Five-minute public path

Open **<https://pitchflow-ten.vercel.app>**. No sign-in or test account is required.

1. Answer the product promise from the first screen: repository plus captures/direction in; GPT-5.6-directed launch system; Website, Images, Videos, Copy, and Export out.
2. Choose **Try the PitchFlow demo** without signing in.
3. Explore **Website**, **Images**, **Videos**, **Copy**, and **Export** as one generated project.
4. Inspect real PitchFlow UI captures, four distinct social graphics, five carousel slides, and both video ratios.
5. Download the immutable complete package and compare its displayed SHA-256 with the downloaded bytes.
6. Open the secondary **Evidence** route and inspect source records, provenance, security boundaries, and verification proof.
7. Enter a different public repository URL and observe the honest engine state: a connected local engine starts a real job; the disconnected state gives the exact companion command and never simulates completion.

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
git clone https://github.com/sickn33/pitchflow.git
cd pitchflow
corepack pnpm install --frozen-lockfile
pnpm pitchflow connect
```

The launcher prints and opens `http://127.0.0.1:3210` only after `/api/status` is healthy. It never binds to the LAN.

### Test

1. Enter a canonical public GitHub URL distinct from the immutable PitchFlow demo.
2. Add audience, positioning, tone, channels, visual direction, and 2–4 real creator-owned captures.
3. Confirm the resolved 40-character commit SHA and inspect bounded evidence; submitted repository code is never cloned or executed.
4. Approve the one-time local pairing and Codex job. Pairing tokens are short-lived and remain out of URLs, browser storage, logs, and deployed state.
5. Watch real stages: evidence fetch, product understanding, creative direction, Website/Images/Videos/Copy rendering, validation, and packaging.
6. Confirm the manifest records `gpt-5.6-sol`, Codex SDK provider, prompt/schema versions, and source commit.
7. Inspect claims and exact evidence records, then review the capture-led social and motion assets.
8. Download the new repository's ZIP from **Export** and verify the microsite, four social formats, five carousel images, copy, both MP4s, render metadata, asset index, and package ownership.

The real Codex turn and Remotion renders can take several minutes. The public demo exists so judges never need to wait for generation to understand or score the product.

## Security checks

Legacy hosted mutation routes return `403 PUBLIC_VIEWER_READ_ONLY` without processing payloads:

```text
POST /api/analyze
POST /api/generate
POST /api/export
```

`GET /api/status` returns `codex: null` publicly. Fresh generation reaches only the explicitly approved loopback companion or opens the same workspace locally when browser policy blocks direct HTTPS-to-loopback access. No Codex identity, token, API key, or paid generation capability is deployed.

## Verification commands

```bash
pnpm check:all
pnpm test:e2e
```

Final machine-readable reports, clean-run logs, screenshots, asset checksums, FFprobe/decode output, Lighthouse results, and public readbacks are indexed in `RESULT.md`.

## Known deliberate choice

The generated 25–40 second social masters are silent-by-design for autoplay feeds and carry complete on-screen audience captions. The mandatory Build Week demonstration is a separate English narrated video with an audio stream and a maximum duration of three minutes.
