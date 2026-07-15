# Parent acceptance review — Build Week demo

Verdict: **PASS**

Reviewed files:

- Remotion master: `packages/remotion/artifacts/demo/pitchflow-build-week-demo.mp4`
- Public-repository delivery: `submission/demo/pitchflow-build-week-demo.mp4`

## Technical readback

- Master SHA-256: `be5099a8dc24afb6e7b842e896fd608882d8980cccdb81ca12a75ceb5d32a854`
- Delivery SHA-256: `ce868accdc0b15552b3dd3e9a8413177e6d64119724441f4155376f4d1fd9459`
- Delivery bytes: `85,845,793`
- Duration: `159.600` seconds; 4,788 frames
- Video: 1920x1080, 30 fps, H.264 High, yuv420p, BT.709, 4,104,871 bps
- Audio: AAC-LC stereo, 48 kHz, 189,969 bps
- Full delivery video and audio decode: pass, zero FFmpeg errors
- Audio level: mean `-18.4 dB`, peak `-4.5 dB`; no silence interval of two seconds or longer at `-45 dB`
- Black-frame detection: no intervals reported
- Delivery/master SSIM: `0.997849`

## Visual and content review

The parent independently inspected a dense 30-frame timeline sheet plus full-resolution local-workspace, export/copy, and closing frames. The video opens on PitchFlow within the first frame, uses real creator-owned PitchFlow UI for product claims, keeps explanatory architecture and repair diagrams visually distinct from product UI, shows the real export handoff, explains the local Codex/public read-only boundary, identifies GPT-5.6 Sol and its verified evidence counts, documents the rejected-media repair loop, and closes on the public viewer and repository URLs.

No storyboard directions, fake product UI, credential values, personal filesystem paths, third-party footage, or copyrighted music are visible. The static holds reported by freeze detection are intentional reading windows for product evidence and architecture diagrams; transitions and the complete dense timeline remain clean. Full-resolution delivery frames retain legible UI text and crisp URLs after the repository-sized transcode.

## Evidence hashes

- `timeline-30.jpg`: `bdc075069a247ccd661500b5e9055c9b8665210b9b75fb0c4a1d82ed562b17fb`
- `delivery-timeline-30.jpg`: `fed8471ead1ffea09c24fb8e6b51da8a36342c0e7cac8feecd453f95cd26f2b8`
- `delivery-ui-43s.png`: `6cddc84877903ab48a84645e481ad0837a9ad1a34b8f7fe4e24f4056502bf67f`
- `delivery-export-94s.png`: `c54b65cd6e2bc481f306e1f469b897debe9d8e30111c91dce8727299920a8a07`
- `delivery-close-155s.png`: `615aaf0a89441aa9f8939f8bacd608a0fb447dc2979032e279074387466f9a40`

The accepted delivery is ready for the separately gated YouTube publication step. Publication has not occurred in this review.
