import type { CampaignManifest, RepoSnapshot } from "@pitchflow/core";

import { escapeHtml } from "./text";

export type MicrositeProductCapture = {
  filename: string;
  alt: string;
  caption: string;
};

export function renderMicrositeCss(manifest: CampaignManifest): string {
  const design = manifest.design;
  return `:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;--accent:${design.accent};--accent-alt:${design.accentAlt};--bg:${design.background};--surface:${design.surface};--text:${design.text};--muted:${design.muted};--radius:${design.radius}px}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:radial-gradient(circle at 80% 5%,color-mix(in srgb,var(--accent) 18%,transparent),transparent 34rem),var(--bg);color:var(--text)}a{color:inherit}a:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:4px}.nav{display:flex;justify-content:space-between;align-items:center;max-width:1240px;margin:auto;padding:1.5rem 2rem;border-bottom:1px solid color-mix(in srgb,var(--text) 12%,transparent)}.nav strong{letter-spacing:-.04em}.nav a{font:600 .72rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;text-decoration:none;color:var(--accent)}main{overflow:hidden}.hero{max-width:1240px;margin:auto;padding:9rem 2rem 8rem}.eyebrow,.label{font:600 .68rem/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}h1{max-width:1040px;margin:1.5rem 0 2rem;font-size:clamp(3.8rem,9vw,8.5rem);line-height:.88;letter-spacing:-.075em}.hero>p:last-child{max-width:720px;color:var(--muted);font-size:clamp(1.05rem,2vw,1.35rem);line-height:1.65}.capture-stage{max-width:1240px;margin:0 auto 6rem;padding:0 2rem}.capture-stage>div:first-child{display:flex;justify-content:space-between;gap:2rem;align-items:end;margin-bottom:1.4rem}.capture-stage h2{margin:.7rem 0 0;font-size:clamp(2rem,4vw,4.3rem);letter-spacing:-.055em}.capture-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}.capture-grid figure{margin:0;padding:.7rem;border:1px solid color-mix(in srgb,var(--text) 14%,transparent);border-radius:var(--radius);background:var(--surface)}.capture-grid img{display:block;width:100%;height:auto;max-height:680px;object-fit:contain;border-radius:calc(var(--radius) * .7);background:color-mix(in srgb,var(--bg) 70%,black)}.capture-grid figcaption{padding:.8rem .25rem .25rem;color:var(--muted);font-size:.78rem;line-height:1.5}.sections{border-top:1px solid color-mix(in srgb,var(--text) 12%,transparent)}.section{display:grid;grid-template-columns:minmax(180px,.4fr) minmax(0,1.6fr);gap:4rem;max-width:1240px;margin:auto;padding:6rem 2rem;border-bottom:1px solid color-mix(in srgb,var(--text) 12%,transparent)}.section h2{max-width:860px;margin:0;font-size:clamp(2.4rem,5vw,5.2rem);line-height:.98;letter-spacing:-.06em}.section p{max-width:720px;margin:1.5rem 0 0;color:var(--muted);font-size:1.02rem;line-height:1.7}.evidence{display:flex;flex-wrap:wrap;gap:.45rem;margin-top:2rem}.evidence a{border:1px solid color-mix(in srgb,var(--accent) 30%,transparent);border-radius:999px;padding:.55rem .7rem;color:var(--accent);font:500 .62rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;text-decoration:none}.claim-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));max-width:1240px;margin:0 auto;padding:6rem 2rem;gap:1rem}.claim{border:1px solid color-mix(in srgb,var(--text) 12%,transparent);border-radius:var(--radius);background:color-mix(in srgb,var(--surface) 92%,transparent);padding:1.5rem}.claim h3{margin:1rem 0;font-size:1.35rem;letter-spacing:-.035em}.claim p{color:var(--muted);font-size:.86rem;line-height:1.6}.claim a{color:var(--accent);font:500 .62rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;text-decoration:none}.cta{max-width:1200px;margin:6rem auto;padding:6rem 2rem;border-radius:calc(var(--radius) * 1.4);background:linear-gradient(125deg,color-mix(in srgb,var(--accent) 24%,var(--surface)),color-mix(in srgb,var(--accent-alt) 13%,var(--surface)))}.cta h2{max-width:850px;margin:0;font-size:clamp(3rem,7vw,7rem);line-height:.92;letter-spacing:-.07em}.cta a{display:inline-flex;margin-top:2rem;border-radius:999px;background:var(--text);color:var(--bg);padding:1rem 1.3rem;text-decoration:none;font-weight:750}.footer{display:flex;justify-content:space-between;gap:2rem;max-width:1240px;margin:auto;padding:2rem;color:var(--muted);font:500 .62rem/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase}@media(max-width:760px){.hero{padding-top:6rem}.capture-stage>div:first-child{align-items:start;flex-direction:column}.capture-grid{grid-template-columns:1fr}.section{grid-template-columns:1fr;gap:1.5rem;padding-block:4rem}.claim-grid{grid-template-columns:1fr}.cta{margin:2rem 1rem;padding:4rem 1.5rem}.footer{flex-direction:column}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}`;
}

export function renderMicrositeHtml(
  manifest: CampaignManifest,
  snapshot: RepoSnapshot,
  productCaptures: MicrositeProductCapture[],
): string {
  const evidence = new Map(snapshot.evidence.map((item) => [item.id, item]));
  const evidenceLinks = (ids: string[]) =>
    ids
      .map((id) => evidence.get(id))
      .filter((item): item is RepoSnapshot["evidence"][number] => Boolean(item))
      .map(
        (item) =>
          `<a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.id)} · ${escapeHtml(item.label)}</a>`,
      )
      .join("");

  const sections = manifest.sections
    .map(
      (section, index) => `<section class="section" aria-labelledby="section-${index}">
  <div><span class="label">${escapeHtml(section.eyebrow ?? `Chapter ${index + 1}`)}</span></div>
  <div><h2 id="section-${index}">${escapeHtml(section.heading)}</h2><p>${escapeHtml(section.body)}</p><div class="evidence" aria-label="Section evidence">${evidenceLinks(section.evidenceIds)}</div></div>
</section>`,
    )
    .join("\n");

  const claims = manifest.claims
    .map(
      (claim) => `<article class="claim">
  <span class="label">${escapeHtml(claim.classification.replaceAll("_", " "))} · ${Math.round(claim.confidence * 100)}%</span>
  <h3>${escapeHtml(claim.text)}</h3><p>${escapeHtml(claim.rationale)}</p>
  ${evidenceLinks(claim.evidenceIds)}
</article>`,
    )
    .join("\n");

  const captures = productCaptures
    .map(
      (capture) => `<figure>
  <img src="../${escapeHtml(capture.filename)}" alt="${escapeHtml(capture.alt)}" loading="lazy" decoding="async">
  <figcaption>${escapeHtml(capture.caption)}</figcaption>
</figure>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(manifest.productBrief.oneLiner)}">
  <meta property="og:title" content="${escapeHtml(manifest.productBrief.productName)}">
  <meta property="og:description" content="${escapeHtml(manifest.productBrief.oneLiner)}">
  <meta property="og:image" content="../images/og-1200x630.png">
  <meta name="twitter:card" content="summary_large_image">
  <title>${escapeHtml(manifest.productBrief.productName)} · generated with PitchFlow</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="nav"><strong>${escapeHtml(manifest.productBrief.productName)}</strong><a href="#evidence">Inspect the evidence</a></header>
  <main>
    <section class="hero"><span class="eyebrow">Generated from ${escapeHtml(manifest.source.commitSha.slice(0, 7))}</span><h1>${escapeHtml(manifest.productBrief.oneLiner)}</h1><p>${escapeHtml(manifest.productBrief.positioning)}</p></section>
    <section class="capture-stage" aria-labelledby="product-captures-heading">
      <div><div><span class="label">Real product UI</span><h2 id="product-captures-heading">See the product behind the claims.</h2></div><span class="label">Locally captured · provenance recorded</span></div>
      <div class="capture-grid">${captures}</div>
    </section>
    <div class="sections">${sections}</div>
    <section id="evidence" class="claim-grid" aria-label="Evidence-linked claims">${claims}</section>
    <section class="cta"><span class="label">Source before superlatives</span><h2>${escapeHtml(manifest.copy.headlineVariants[0] ?? manifest.productBrief.oneLiner)}</h2><a href="${escapeHtml(snapshot.repository.canonicalUrl)}/tree/${escapeHtml(snapshot.commitSha)}">Open the pinned repository ↗</a></section>
  </main>
  <footer class="footer"><span>Created with PitchFlow</span><span>Every factual claim links to commit-pinned evidence.</span></footer>
</body>
</html>`;
}
