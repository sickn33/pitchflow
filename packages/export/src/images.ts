import sharp from "sharp";

import type { CampaignManifest, CarouselSlide } from "@pitchflow/core";

import { escapeXml, wrapText } from "./text";

type ImageSpec = {
  width: number;
  height: number;
  title: string;
  eyebrow: string;
  body?: string;
  marker: string;
};

function textElements(
  lines: string[],
  startY: number,
  lineHeight: number,
  fontSize: number,
  color: string,
): string {
  return lines
    .map(
      (line, index) =>
        `<text x="8%" y="${startY + index * lineHeight}" fill="${color}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" letter-spacing="-2">${escapeXml(line)}</text>`,
    )
    .join("");
}

function imageSvg(manifest: CampaignManifest, spec: ImageSpec): string {
  const { width, height } = spec;
  const titleLines = wrapText(spec.title, width > height ? 28 : 20, width > height ? 3 : 5);
  const fontSize = Math.round(Math.min(width, height) * (width > height ? 0.105 : 0.082));
  const lineHeight = Math.round(fontSize * 0.92);
  const titleY = Math.round(height * 0.36);
  const body = spec.body ? wrapText(spec.body, width > height ? 52 : 34, 3) : [];
  const bodyStart = titleY + titleLines.length * lineHeight + Math.round(height * 0.05);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="glow" cx="78%" cy="18%" r="70%"><stop offset="0" stop-color="${manifest.design.accent}" stop-opacity=".45"/><stop offset="1" stop-color="${manifest.design.background}" stop-opacity="0"/></radialGradient>
    <linearGradient id="line" x1="0" x2="1"><stop stop-color="${manifest.design.accent}"/><stop offset="1" stop-color="${manifest.design.accentAlt}"/></linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="${manifest.design.background}"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  <g opacity=".12" stroke="${manifest.design.text}">${Array.from({ length: 13 }, (_, index) => `<path d="M0 ${index * (height / 12)}H${width}"/>`).join("")}${Array.from({ length: 18 }, (_, index) => `<path d="M${index * (width / 17)} 0V${height}"/>`).join("")}</g>
  <rect x="8%" y="9%" width="${Math.round(width * 0.12)}" height="5" rx="2.5" fill="url(#line)"/>
  <text x="8%" y="19%" fill="${manifest.design.accent}" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(Math.min(width, height) * 0.027)}" font-weight="700" letter-spacing="3">${escapeXml(spec.eyebrow.toUpperCase())}</text>
  ${textElements(titleLines, titleY, lineHeight, fontSize, manifest.design.text)}
  ${body.map((line, index) => `<text x="8%" y="${bodyStart + index * Math.round(fontSize * 0.5)}" fill="${manifest.design.muted}" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(fontSize * 0.34)}">${escapeXml(line)}</text>`).join("")}
  <text x="8%" y="91%" fill="${manifest.design.muted}" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(Math.min(width, height) * 0.022)}">${escapeXml(manifest.productBrief.productName)} · generated with PitchFlow</text>
  <text x="92%" y="91%" text-anchor="end" fill="${manifest.design.accent}" font-family="monospace" font-size="${Math.round(Math.min(width, height) * 0.022)}">${escapeXml(spec.marker)}</text>
</svg>`;
}

export async function renderCampaignImage(
  manifest: CampaignManifest,
  spec: ImageSpec,
  outputPath: string,
): Promise<void> {
  const svg = imageSvg(manifest, spec);
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 8, adaptiveFiltering: true, effort: 6 })
    .toFile(outputPath);
}

export type SocialImageDefinition = ImageSpec & { filename: string; channel: string };

export function socialImageDefinitions(manifest: CampaignManifest): SocialImageDefinition[] {
  const [first, second, third] = manifest.socialCards.map((card) => card.headline);
  return [
    {
      filename: "og-1200x630.png",
      channel: "Open Graph",
      width: 1200,
      height: 630,
      title: first ?? manifest.productBrief.oneLiner,
      eyebrow: "Repository-native launch",
      body: manifest.productBrief.positioning,
      marker: "1200×630",
    },
    {
      filename: "x-1600x900.png",
      channel: "X",
      width: 1600,
      height: 900,
      title: second ?? manifest.productBrief.oneLiner,
      eyebrow: "Evidence attached",
      body: manifest.claims[0]?.text ?? manifest.productBrief.problem,
      marker: "1600×900",
    },
    {
      filename: "linkedin-1200x627.png",
      channel: "LinkedIn",
      width: 1200,
      height: 627,
      title: third ?? manifest.productBrief.oneLiner,
      eyebrow: "Built from the source",
      body: manifest.productBrief.problem,
      marker: "1200×627",
    },
    {
      filename: "instagram-1080x1080.png",
      channel: "Instagram",
      width: 1080,
      height: 1080,
      title: first ?? manifest.productBrief.oneLiner,
      eyebrow: "Meet the project",
      body: manifest.productBrief.oneLiner,
      marker: "1080×1080",
    },
  ];
}

export function carouselImageDefinition(
  slide: CarouselSlide,
  productName: string,
): SocialImageDefinition {
  return {
    filename: `slide-${String(slide.index).padStart(2, "0")}-1080x1350.png`,
    channel: "Carousel",
    width: 1080,
    height: 1350,
    title: slide.headline,
    eyebrow: slide.eyebrow,
    body: slide.body,
    marker: `${String(slide.index).padStart(2, "0")}/05 · ${productName}`,
  };
}
