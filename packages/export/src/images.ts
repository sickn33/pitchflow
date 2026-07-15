import sharp from "sharp";

import type { CampaignManifest, CarouselSlide } from "@pitchflow/core";

import { escapeXml, fitText, type FittedText } from "./text";

export type CreativeCapture = {
  filename: string;
  data: Buffer;
  mediaType: "image/png" | "image/jpeg";
  width: number;
  height: number;
};

export type NarrativeStage =
  | "hook-problem"
  | "capture-flow"
  | "extracted-result"
  | "export-share-outcome"
  | "cta";

export type LayoutBounds = { x: number; y: number; width: number; height: number };

export type CreativeTextReceipt = FittedText & { id: string; bounds: LayoutBounds };

export type CreativeLayoutReceipt = {
  filename: string;
  layoutId: string;
  narrativeStage: NarrativeStage | null;
  width: number;
  height: number;
  captureFilenames: string[];
  textBlocks: CreativeTextReceipt[];
  reservedRegions: Array<{ id: string; bounds: LayoutBounds }>;
};

type ImageSpec = {
  width: number;
  height: number;
  title: string;
  eyebrow: string;
  body: string;
  marker: string;
  filename: string;
  channel: string;
  layoutId: string;
  narrativeStage: NarrativeStage | null;
  captureIndexes: number[];
};

function textLines(
  fit: FittedText,
  x: number,
  y: number,
  color: string,
  weight: number,
  anchor: "start" | "middle" | "end" = "start",
): string {
  return fit.lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * fit.lineHeight}" text-anchor="${anchor}" fill="${color}" font-family="Arial, Helvetica, sans-serif" font-size="${fit.fontSize}" font-weight="${weight}" letter-spacing="${weight >= 700 ? -1.2 : 0}">${escapeXml(line)}</text>`,
    )
    .join("");
}

function captureDataUrl(capture: CreativeCapture): string {
  return `data:${capture.mediaType};base64,${capture.data.toString("base64")}`;
}

function captureFrame(
  capture: CreativeCapture,
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  accent: string,
  rotation = 0,
): string {
  const transform = rotation
    ? ` transform="rotate(${rotation} ${x + width / 2} ${y + height / 2})"`
    : "";
  return `<g${transform}>
    <rect x="${x - 3}" y="${y - 3}" width="${width + 6}" height="${height + 6}" rx="${radius + 3}" fill="${accent}" opacity=".72" filter="url(#shadow)"/>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="#10151d"/>
    <image href="${captureDataUrl(capture)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${id})"/>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="none" stroke="#ffffff" stroke-opacity=".26" stroke-width="2"/>
  </g>`;
}

function defs(manifest: CampaignManifest, captureClips: string): string {
  return `<defs>
    <radialGradient id="glow" cx="82%" cy="12%" r="82%"><stop offset="0" stop-color="${manifest.design.accent}" stop-opacity=".5"/><stop offset="1" stop-color="${manifest.design.background}" stop-opacity="0"/></radialGradient>
    <linearGradient id="accentLine" x1="0" x2="1"><stop stop-color="${manifest.design.accent}"/><stop offset="1" stop-color="${manifest.design.accentAlt}"/></linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#000000" flood-opacity=".42"/></filter>
    ${captureClips}
  </defs>`;
}

function fitBlock(
  id: string,
  value: string,
  maximumWidth: number,
  maximumHeight: number,
  maximumFontSize: number,
  minimumFontSize: number,
  maximumLines: number,
  placement: {
    x: number;
    baseline: number;
    width: number;
    anchor?: "start" | "middle" | "end";
  },
): CreativeTextReceipt {
  const fitted = fitText(value, {
    maximumWidth,
    maximumHeight,
    maximumFontSize,
    minimumFontSize,
    maximumLines,
  });
  const anchor = placement.anchor ?? "start";
  const x =
    anchor === "middle"
      ? placement.x - placement.width / 2
      : anchor === "end"
        ? placement.x - placement.width
        : placement.x;
  return {
    id,
    ...fitted,
    bounds: {
      x,
      y: placement.baseline - fitted.fontSize,
      width: placement.width,
      height: fitted.fontSize + (fitted.lines.length - 1) * fitted.lineHeight,
    },
  };
}

function renderWideSplit(
  manifest: CampaignManifest,
  spec: ImageSpec,
  captures: CreativeCapture[],
): { content: string; textBlocks: CreativeTextReceipt[] } {
  const title = fitBlock("title", spec.title, 500, 228, 72, 38, 4, {
    x: 70,
    baseline: 208,
    width: 500,
  });
  const body = fitBlock("body", spec.body, 500, 118, 30, 20, 4, {
    x: 70,
    baseline: 480,
    width: 500,
  });
  const capture = captures[0]!;
  return {
    textBlocks: [title, body],
    content: `<rect x="0" y="0" width="1200" height="630" fill="url(#glow)"/>
      <rect x="70" y="70" width="74" height="6" rx="3" fill="url(#accentLine)"/>
      <text x="70" y="125" fill="${manifest.design.accent}" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" letter-spacing="2.4">${escapeXml(spec.eyebrow.toUpperCase())}</text>
      ${textLines(title, 70, 208, manifest.design.text, 760)}
      ${textLines(body, 70, 480, manifest.design.muted, 450)}
      ${captureFrame(capture, "capture-0", 640, 84, 510, 410, 25, manifest.design.accent, -1.5)}
      <rect x="720" y="470" width="370" height="66" rx="33" fill="${manifest.design.accent}"/>
      <text x="905" y="512" text-anchor="middle" fill="${manifest.design.background}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="750">REAL PRODUCT · REAL LAUNCH</text>`,
  };
}

function renderXFeature(
  manifest: CampaignManifest,
  spec: ImageSpec,
  captures: CreativeCapture[],
): { content: string; textBlocks: CreativeTextReceipt[] } {
  const title = fitBlock("title", spec.title, 650, 170, 66, 36, 3, {
    x: 112,
    baseline: 270,
    width: 650,
  });
  const body = fitBlock("body", spec.body, 650, 104, 29, 19, 4, {
    x: 112,
    baseline: 510,
    width: 650,
  });
  return {
    textBlocks: [title, body],
    content: `<rect x="0" y="0" width="1600" height="900" fill="url(#glow)"/>
      ${captureFrame(captures[0]!, "capture-0", 655, 58, 885, 660, 32, manifest.design.accent)}
      <rect x="60" y="92" width="740" height="650" rx="38" fill="${manifest.design.background}" fill-opacity=".94" stroke="${manifest.design.accent}" stroke-opacity=".3"/>
      <text x="112" y="165" fill="${manifest.design.accent}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" letter-spacing="3">${escapeXml(spec.eyebrow.toUpperCase())}</text>
      ${textLines(title, 112, 270, manifest.design.text, 760)}
      ${textLines(body, 112, 510, manifest.design.muted, 450)}
      <rect x="112" y="665" width="156" height="8" rx="4" fill="url(#accentLine)"/>
      <circle cx="1470" cy="780" r="52" fill="${manifest.design.accent}"/>
      <path d="M1448 780h44m-18-18 18 18-18 18" stroke="${manifest.design.background}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  };
}

function renderLinkedInEditorial(
  manifest: CampaignManifest,
  spec: ImageSpec,
  captures: CreativeCapture[],
): { content: string; textBlocks: CreativeTextReceipt[] } {
  const title = fitBlock("title", spec.title, 410, 145, 52, 31, 3, {
    x: 668,
    baseline: 235,
    width: 410,
  });
  const body = fitBlock("body", spec.body, 410, 66, 23, 15, 3, {
    x: 668,
    baseline: 407,
    width: 410,
  });
  return {
    textBlocks: [title, body],
    content: `<rect x="0" y="0" width="1200" height="627" fill="url(#glow)"/>
      ${captureFrame(captures[0]!, "capture-0", 56, 62, 600, 480, 24, manifest.design.accentAlt)}
      <rect x="616" y="96" width="528" height="436" rx="30" fill="${manifest.design.background}" fill-opacity=".96" stroke="${manifest.design.accentAlt}" stroke-opacity=".36"/>
      <text x="668" y="158" fill="${manifest.design.accentAlt}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" letter-spacing="2.5">${escapeXml(spec.eyebrow.toUpperCase())}</text>
      ${textLines(title, 668, 235, manifest.design.text, 760)}
      ${textLines(body, 668, 407, manifest.design.muted, 450)}
      <text x="668" y="505" fill="${manifest.design.accent}" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="700">PRODUCT EVIDENCE INCLUDED →</text>`,
  };
}

function renderInstagramStack(
  manifest: CampaignManifest,
  spec: ImageSpec,
  captures: CreativeCapture[],
): { content: string; textBlocks: CreativeTextReceipt[] } {
  const title = fitBlock("title", spec.title, 880, 156, 60, 34, 3, {
    x: 100,
    baseline: 700,
    width: 880,
  });
  const body = fitBlock("body", spec.body, 760, 86, 27, 18, 3, {
    x: 100,
    baseline: 890,
    width: 760,
  });
  const second = captures[1] ?? captures[0]!;
  return {
    textBlocks: [title, body],
    content: `<rect x="0" y="0" width="1080" height="1080" fill="url(#glow)"/>
      <text x="540" y="76" text-anchor="middle" fill="${manifest.design.accent}" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" letter-spacing="3">${escapeXml(spec.eyebrow.toUpperCase())}</text>
      ${captureFrame(captures[0]!, "capture-0", 74, 112, 676, 450, 28, manifest.design.accent, -2)}
      ${captureFrame(second, "capture-1", 662, 182, 344, 390, 25, manifest.design.accentAlt, 2)}
      ${textLines(title, 100, 700, manifest.design.text, 760)}
      ${textLines(body, 100, 890, manifest.design.muted, 450)}
      <rect x="100" y="976" width="880" height="3" fill="url(#accentLine)"/>`,
  };
}

function renderCarousel(
  manifest: CampaignManifest,
  spec: ImageSpec,
  captures: CreativeCapture[],
): { content: string; textBlocks: CreativeTextReceipt[] } {
  const stage = spec.narrativeStage!;
  const title = fitBlock(
    "title",
    spec.title,
    880,
    stage === "hook-problem" ? 220 : 150,
    65,
    34,
    4,
    { x: 90, baseline: 190, width: 880 },
  );
  const first = captures[0]!;
  const second = captures[1] ?? first;
  const eyebrow = `<text x="90" y="106" fill="${manifest.design.accent}" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="700" letter-spacing="3">${escapeXml(spec.eyebrow.toUpperCase())}</text>`;
  const titleSvg = textLines(title, 90, 190, manifest.design.text, 760);
  const bodyY = stage === "hook-problem" ? 430 : 1178;
  const body = fitBlock("body", spec.body, 840, 120, 29, 18, 4, {
    x: 90,
    baseline: bodyY,
    width: 840,
  });
  const bodySvg = textLines(body, 90, bodyY, manifest.design.muted, 450);

  if (stage === "hook-problem") {
    return {
      textBlocks: [title, body],
      content: `${eyebrow}${titleSvg}${bodySvg}
        <rect x="60" y="540" width="960" height="730" rx="42" fill="${manifest.design.accent}" opacity=".1"/>
        ${captureFrame(first, "capture-0", 105, 590, 870, 580, 32, manifest.design.accent, -1)}
        <circle cx="892" cy="1130" r="64" fill="${manifest.design.accent}"/><path d="M862 1130h60m-24-24 24 24-24 24" stroke="${manifest.design.background}" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    };
  }
  if (stage === "capture-flow") {
    return {
      textBlocks: [title, body],
      content: `${eyebrow}${titleSvg}
        ${captureFrame(first, "capture-0", 78, 390, 924, 650, 34, manifest.design.accent)}
        <rect x="112" y="960" width="460" height="68" rx="34" fill="${manifest.design.accent}"/><text x="342" y="1004" text-anchor="middle" fill="${manifest.design.background}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="760">01 · WORK IN THE PRODUCT</text>
        ${bodySvg}`,
    };
  }
  if (stage === "extracted-result") {
    return {
      textBlocks: [title, body],
      content: `${eyebrow}${titleSvg}
        ${captureFrame(first, "capture-0", 62, 342, 956, 700, 34, manifest.design.accentAlt)}
        <rect x="690" y="292" width="300" height="92" rx="46" fill="${manifest.design.accentAlt}"/><text x="840" y="350" text-anchor="middle" fill="${manifest.design.background}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="760">RESULT, EXTRACTED</text>
        <circle cx="155" cy="950" r="66" fill="none" stroke="${manifest.design.accent}" stroke-width="8"/><path d="M126 950l21 21 40-47" stroke="${manifest.design.accent}" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        ${bodySvg}`,
    };
  }
  if (stage === "export-share-outcome") {
    return {
      textBlocks: [title, body],
      content: `${eyebrow}${titleSvg}
        ${captureFrame(first, "capture-0", 110, 360, 780, 610, 34, manifest.design.accentAlt, -2)}
        <rect x="650" y="860" width="340" height="144" rx="30" fill="${manifest.design.accent}" filter="url(#shadow)"/><text x="820" y="920" text-anchor="middle" fill="${manifest.design.background}" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="760">EXPORT</text><text x="820" y="958" text-anchor="middle" fill="${manifest.design.background}" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="800">READY TO SHARE</text>
        ${bodySvg}`,
    };
  }
  const cta = fitBlock(
    "cta",
    `TRY ${manifest.productBrief.productName.toUpperCase()} →`,
    760,
    42,
    31,
    20,
    1,
    { x: 540, baseline: 1080, width: 760, anchor: "middle" },
  );
  return {
    textBlocks: [title, body, cta],
    content: `${eyebrow}${titleSvg}
      ${captureFrame(first, "capture-0", 72, 360, 580, 500, 30, manifest.design.accent, -3)}
      ${captureFrame(second, "capture-1", 502, 440, 510, 500, 30, manifest.design.accentAlt, 3)}
      <rect x="90" y="1010" width="900" height="110" rx="55" fill="url(#accentLine)"/>${textLines(cta, 540, 1080, manifest.design.background, 800, "middle")}
      ${bodySvg}`,
  };
}

export async function renderCampaignImage(
  manifest: CampaignManifest,
  spec: ImageSpec,
  outputPath: string,
  availableCaptures: CreativeCapture[],
): Promise<CreativeLayoutReceipt> {
  const captures = spec.captureIndexes
    .map((index) => availableCaptures[index])
    .filter((capture): capture is CreativeCapture => capture !== undefined);
  if (captures.length !== spec.captureIndexes.length || captures.length === 0) {
    throw new Error(`${spec.filename} requires documented product captures for its layout.`);
  }
  const clipGeometry =
    spec.layoutId === "carousel-hook-problem"
      ? [[105, 590, 870, 580, 32]]
      : spec.layoutId === "carousel-capture-flow"
        ? [[78, 390, 924, 650, 34]]
        : spec.layoutId === "carousel-extracted-result"
          ? [[62, 342, 956, 700, 34]]
          : spec.layoutId === "carousel-export-share-outcome"
            ? [[110, 360, 780, 610, 34]]
            : spec.layoutId === "carousel-cta"
              ? [
                  [72, 360, 580, 500, 30],
                  [502, 440, 510, 500, 30],
                ]
              : spec.layoutId === "social-og-wide-split"
                ? [[640, 84, 510, 410, 25]]
                : spec.layoutId === "social-x-feature-overlay"
                  ? [[655, 58, 885, 660, 32]]
                  : spec.layoutId === "social-linkedin-editorial"
                    ? [[56, 62, 600, 480, 24]]
                    : spec.layoutId === "social-instagram-product-stack"
                      ? [
                          [74, 112, 676, 450, 28],
                          [662, 182, 344, 390, 25],
                        ]
                      : [];
  if (clipGeometry.length !== captures.length) {
    throw new Error(`${spec.filename} has an unsupported capture-led layout contract.`);
  }
  const clips = clipGeometry
    .map(
      ([x, y, width, height, radius], index) =>
        `<clipPath id="capture-${index}"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}"/></clipPath>`,
    )
    .join("");

  const rendered = spec.layoutId.startsWith("carousel-")
    ? renderCarousel(manifest, spec, captures)
    : spec.layoutId === "social-og-wide-split"
      ? renderWideSplit(manifest, spec, captures)
      : spec.layoutId === "social-x-feature-overlay"
        ? renderXFeature(manifest, spec, captures)
        : spec.layoutId === "social-linkedin-editorial"
          ? renderLinkedInEditorial(manifest, spec, captures)
          : renderInstagramStack(manifest, spec, captures);
  const eyebrowFontSize =
    spec.layoutId === "social-linkedin-editorial"
      ? 18
      : spec.width > 1400
        ? 22
        : spec.layoutId.startsWith("carousel-")
          ? 21
          : 20;
  const eyebrowPlacement = spec.layoutId.startsWith("carousel-")
    ? { x: 90, baseline: 106, width: 900 as number }
    : spec.layoutId === "social-og-wide-split"
      ? { x: 70, baseline: 125, width: 500 as number }
      : spec.layoutId === "social-x-feature-overlay"
        ? { x: 112, baseline: 165, width: 650 as number }
        : spec.layoutId === "social-linkedin-editorial"
          ? { x: 668, baseline: 158, width: 410 as number }
          : { x: 540, baseline: 76, width: 880 as number, anchor: "middle" as const };
  const eyebrow = fitBlock(
    "eyebrow",
    spec.eyebrow.toUpperCase(),
    spec.width * 0.72,
    eyebrowFontSize * 1.2,
    eyebrowFontSize,
    eyebrowFontSize,
    1,
    eyebrowPlacement,
  );
  const footerX = Math.round(spec.width * 0.055);
  const footerY = Math.round(spec.height * 0.966);
  const footerWidth = spec.width * 0.5;
  const footer = fitBlock(
    "footer",
    `${manifest.productBrief.productName} · generated with PitchFlow`,
    footerWidth,
    spec.height * 0.04,
    Math.round(Math.min(spec.width, spec.height) * 0.022),
    12,
    1,
    { x: footerX, baseline: footerY, width: footerWidth },
  );
  const markerFontSize = Math.round(Math.min(spec.width, spec.height) * 0.021);
  const markerX = Math.round(spec.width * 0.945);
  const markerWidth = spec.width * 0.3;
  const marker = fitBlock(
    "marker",
    spec.marker,
    spec.width * 0.34,
    markerFontSize * 1.2,
    markerFontSize,
    12,
    1,
    { x: markerX, baseline: footerY, width: markerWidth, anchor: "end" },
  );
  const reservedRegions =
    spec.layoutId === "social-linkedin-editorial"
      ? [
          {
            id: "product-evidence-callout",
            bounds: { x: 668, y: 478, width: 410, height: 30 },
          },
        ]
      : [];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${spec.width}" height="${spec.height}" viewBox="0 0 ${spec.width} ${spec.height}">
    ${defs(manifest, clips)}
    <rect width="100%" height="100%" fill="${manifest.design.background}"/>
    <g opacity=".055" stroke="${manifest.design.text}">${Array.from({ length: 12 }, (_, index) => `<path d="M0 ${index * (spec.height / 11)}H${spec.width}"/>`).join("")}</g>
    ${rendered.content}
    ${textLines(footer, footerX, footerY, manifest.design.muted, 450)}
    ${textLines(marker, markerX, footerY, manifest.design.accent, 450, "end")}
  </svg>`;
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 8, adaptiveFiltering: true, effort: 6 })
    .toFile(outputPath);

  return {
    filename: spec.filename,
    layoutId: spec.layoutId,
    narrativeStage: spec.narrativeStage,
    width: spec.width,
    height: spec.height,
    captureFilenames: captures.map((capture) => capture.filename),
    textBlocks: [eyebrow, ...rendered.textBlocks, footer, marker],
    reservedRegions,
  };
}

export type SocialImageDefinition = ImageSpec;

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
      layoutId: "social-og-wide-split",
      narrativeStage: null,
      captureIndexes: [0],
    },
    {
      filename: "x-1600x900.png",
      channel: "X",
      width: 1600,
      height: 900,
      title: second ?? manifest.productBrief.oneLiner,
      eyebrow: "See the product in action",
      body: manifest.claims[0]?.text ?? manifest.productBrief.problem,
      marker: "1600×900",
      layoutId: "social-x-feature-overlay",
      narrativeStage: null,
      captureIndexes: [0],
    },
    {
      filename: "linkedin-1200x627.png",
      channel: "LinkedIn",
      width: 1200,
      height: 627,
      title: third ?? manifest.productBrief.oneLiner,
      eyebrow: "Built from product evidence",
      body: manifest.productBrief.problem,
      marker: "1200×627",
      layoutId: "social-linkedin-editorial",
      narrativeStage: null,
      captureIndexes: [1],
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
      layoutId: "social-instagram-product-stack",
      narrativeStage: null,
      captureIndexes: [0, 1],
    },
  ];
}

const CAROUSEL_STAGES: Record<number, NarrativeStage> = {
  1: "hook-problem",
  2: "capture-flow",
  3: "extracted-result",
  4: "export-share-outcome",
  5: "cta",
};

const CAROUSEL_CAPTURES: Record<number, number[]> = {
  1: [0],
  2: [0],
  3: [0],
  4: [1],
  5: [0, 1],
};

export function carouselImageDefinition(
  slide: CarouselSlide,
  productName: string,
): SocialImageDefinition {
  const narrativeStage = CAROUSEL_STAGES[slide.index];
  const captureIndexes = CAROUSEL_CAPTURES[slide.index];
  if (!narrativeStage || !captureIndexes) {
    throw new Error(`Carousel slide ${slide.index} does not map to the five-stage launch story.`);
  }
  return {
    filename: `slide-${String(slide.index).padStart(2, "0")}-1080x1350.png`,
    channel: "Carousel",
    width: 1080,
    height: 1350,
    title: slide.headline,
    eyebrow: slide.eyebrow,
    body: slide.body,
    marker: `${String(slide.index).padStart(2, "0")}/05 · ${productName}`,
    layoutId: `carousel-${narrativeStage}`,
    narrativeStage,
    captureIndexes,
  };
}
