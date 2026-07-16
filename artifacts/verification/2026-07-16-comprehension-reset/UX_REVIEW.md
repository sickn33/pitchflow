# PitchFlow second comprehension reset — blunt UX review

Date: 2026-07-16 (Europe/Rome)  
Browser: Microsoft Edge 150.0.4078.65, headless, reduced motion  
Viewports: 1440×1000 and 390×844  
Verdict: **PASS as a deployment candidate; Nicco's live approval remains mandatory.**

## Baseline rejection

The prior homepage was visually clean but semantically weak. “Paste your repo. Get the whole launch kit.” required the visitor to infer what PitchFlow was, who it served, and what “launch kit” meant. The output pictograms named files but did not explain the transformation or the local Codex/GPT-5.6 boundary.

The prior `/evidence` page failed harder. It placed Build Week language, safety architecture, a loading viewer, evidence cards, galleries, campaign site, and full asset inventory in one long sequence. The stable baseline screenshot is `baseline/evidence-stable-1440x1000.png`; the first automated capture (`baseline/evidence-1440x1000.png`) was rejected because it still showed the viewer loading.

## Reviewed flow

1. **Homepage, desktop — healthy.** `local/homepage-desktop-1440x1000.png`
   - The product proposition names the input and four human deliverables in the largest type.
   - Audience, screenshot truth, GPT-5.6, local Codex, and the credential boundary are visible without scrolling.
   - One repository input and `Create marketing assets` form the only primary action. The demo remains text-only and secondary.
   - The right-hand Input → Process → Outputs chain explains the relationship without extending the page.

2. **Homepage, mobile — healthy but intentionally dense.** `local/homepage-mobile-390x844.png`
   - All required comprehension strings, the input, both actions, and the complete relationship chain fit inside 390×844.
   - The hierarchy remains proposition → truth → repository action → demo → process chain.
   - No text truncates, no root overflow appears, and all five outputs remain readable. The density is near the upper acceptable limit, but removing any of these truths would recreate the rejected ambiguity.

3. **Evidence overview, desktop — healthy.** `local/evidence-overview-desktop-1440x1000.png`
   - Purpose and project summary lead, followed by four meaningful numbers.
   - The 3-minute judge path is visible in the same viewport and provides three direct actions.
   - Navigation names the four proof categories in plain language; technical receipts do not lead.

4. **Evidence overview, mobile — healthy.** `local/evidence-overview-mobile-390x844.png`
   - Purpose, product summary, and four meaningful numbers remain legible before the judge path.
   - The judge-path heading begins at the bottom edge, correctly signaling continuation without mixing raw receipts into the overview.
   - The compact header drops secondary section navigation instead of compressing it into unreadable links; the sticky section outline appears when the proof sections begin.

5. **Expanded raw evidence — healthy and intentionally utilitarian.** `local/evidence-raw-expanded-desktop-1440x1000.png` and `local/evidence-raw-expanded-mobile-390x844.png`
   - Four native disclosures begin closed. Opening the immutable inventory exposes all 25 files.
   - The raw table scrolls inside its own bounded region; it does not create root overflow.
   - Hashes and paths are secondary audit material rather than the page's narrative.

## Five-second rubric

| Question | Visible answer |
| --- | --- |
| What is PitchFlow? | A repo-to-marketing product that creates a website, social images, product videos, and copy. |
| What do I provide? | A GitHub repository; screenshots and direction are optional inputs. |
| What is generated? | Website, Social images, Product videos, Copy, and ZIP. |
| How is it powered? | GPT-5.6 through the developer's local Codex account; credentials stay local. |
| Who is it for? | Developers and open-source maintainers. |

Machine-readable bounds in `local/comprehension-browser-qa.json` prove every homepage contract element finishes inside both first viewports. The same report proves one primary repository CTA, four Evidence sections, four `Why this matters` explanations, four collapsed raw disclosures, 25 asset rows after expansion, zero root overflow, zero browser console errors, and zero serious/critical axe findings.

## Required fidelity surfaces

- Typography: the existing Geist/code-native pairing is preserved. Longer explicit copy wraps cleanly at both native sizes; there is no ellipsis or clipping.
- Spacing and rhythm: desktop uses an asymmetrical proposition/process split; mobile compresses the same hierarchy into one continuous reading order. Evidence uses open sections and hairlines rather than a wall of bordered cards.
- Color and tokens: off-black, warm white, restrained mint, and existing semantic danger colors remain unchanged. Contrast passed axe at both sizes.
- Image quality: the Evidence proof uses the original immutable generated social asset, not recreated UI or CSS art. Existing Results media decode and visible-pixel checks remain green.
- Copy: marketing shorthand was removed from the entry proposition. Technical language appears only where necessary and raw audit detail stays collapsed.

## Residual observations

- The empty repository state correctly disables the primary button, so it appears muted until a URL is entered. Its label still communicates the result; no competing action gains more visual weight.
- The mobile homepage uses most of the 844px viewport. This is an explicit trade-off to keep all five comprehension answers visible; it introduces no overflow and does not extend into a long landing page.
- Screenshot review alone cannot prove keyboard behavior, downloads, media decode, or bridge state. Those are covered separately by the 3/3 local and 4/4 public Playwright suites plus the unchanged security/media verifiers.

Final result: **passed**. No actionable P0, P1, or P2 visual/comprehension finding remains in the local candidate.

An independent full-resolution review reached the same PASS verdict for semantic comprehension, Evidence hierarchy, and collapsed raw traceability before the source was admitted to deployment.
