# Candidate 3 independent media acceptance

Verdict: **PASS**
Reviewed: 2026-07-15 Europe/Rome

## Scope

The independent read-only verifier inspected both production MP4s, the campaign manifest, capture provenance, asset index, video render metadata, production bundle report, every overview/intra-scene/transition/first-two-second/full-resolution frame sheet, SHA-256 values, and ZIP inventory.

## Findings

- Scene routing is semantic: evidence UI supports scenes 2–3; campaign preview and copy support scene 4; a dedicated verified export receipt supports scene 5.
- The full-resolution handoff frames visibly prove the microsite, social assets, five-slide carousel, channel copy, landscape and portrait masters, asset index plus SHA-256, and traversal-safe ZIP.
- No raw `visualDirection`, storyboard instruction, or other production direction appears on screen.
- Opening identity, audience captions, social-native portrait layout, transitions, and the final repository CTA are clear and safe.
- Motion remains continuous except for the intentional final CTA hold; independent black/freeze detection found no blocking interval.
- Both masters independently fully decode as 36-second, 1,080-frame, H.264 High, yuv420p/BT.709, 30 fps streams: 9.13 Mbps landscape and 10.77 Mbps portrait.
- Neither social master includes audio, matching the explicit `silentSocialMaster: true` brief. The separate Build Week demonstration remains required to have English narration and an audio stream.
- Video, capture, archive, and ZIP inventory checks match the bundle index and provenance records. The archive contains 29 entries and has SHA-256 `fde4380e466b8697ddadc09de52cb799926651e497e8b7a727979701f472e2fd`.

No candidate-3 media blockers remain. This acceptance applies only to the exact hashes recorded in `../bundle-verification.json`.
