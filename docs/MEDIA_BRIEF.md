# Motion and capture brief

## Audience contract

PitchFlow motion scenes have two separate fields:

- `audienceCaption`: short, factual copy that may appear on screen;
- `visualDirection`: internal creative guidance that is never rendered.

The composition source has a regression test proving it does not reference `visualDirection`. Storyboard verbs such as “open on,” “cut to,” “animate,” “reveal,” and “return to” belong only in internal direction and are forbidden as visible lower-third copy.

## Real UI contract

Production render and export require 2–4 real local PNG/JPEG product captures. Each capture must include a truthful label, accessibility description, and creator-owned or authorized-use provenance. Remote URLs, HTML, SVG, generated fake interface art, and capture-free output are rejected.

The final immutable dogfood campaign uses newly captured PitchFlow UI. Earlier VibePalette captures are entrant-owned engineering evidence only and are not the public PitchFlow dogfood subject.

## Motion goals

- 25–40 seconds at 30 fps
- immediate identity and motion inside the first two seconds
- continuous purposeful motion without six-second static-card pacing
- landscape layout built for 1920x1080
- structurally distinct, social-native portrait layout built for 1080x1920
- every visual behavior must substantiate the adjacent audience caption
- closing must prominently show product name, canonical repository URL, and CTA
- safe areas for platform overlays and caption readability

## Encoding

- H.264 High, yuv420p, BT.709
- software encoding, x264 slow preset, concurrency 1
- 10 Mbps landscape target
- 12 Mbps portrait target
- independent FFprobe, full decode, bitrate, frame-sheet, transition, and full-resolution inspection

## Audio decision

PitchFlow's generated social masters are intentionally silent and caption-complete for muted autoplay contexts. This is an explicit product brief decision, not a missing render stream. The separate Build Week demonstration video must contain English narration and a valid audio stream.
