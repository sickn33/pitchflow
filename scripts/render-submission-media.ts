import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import sharp from "sharp";

import { parseDogfoodPackage } from "../apps/web/lib/dogfood";

const root = resolve(process.cwd());
const packageDirectory = join(root, "apps/web/public/dogfood/pitchflow/v1");
const outputDirectory = join(root, "submission/media");
const width = 1800;
const height = 1200;

type SourceCapture = {
  href: string;
  path: string;
  sha256: string;
  bytes: number;
};

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function background(accent: string): Buffer {
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#070909"/>
          <stop offset="0.62" stop-color="#0b1012"/>
          <stop offset="1" stop-color="#101a1e"/>
        </linearGradient>
        <radialGradient id="glow" cx="0.84" cy="0.16" r="0.78">
          <stop offset="0" stop-color="${accent}" stop-opacity="0.2"/>
          <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
        </radialGradient>
        <pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse">
          <path d="M 42 0 L 0 0 0 42" fill="none" stroke="#ffffff" stroke-opacity="0.035" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="1800" height="1200" fill="url(#bg)"/>
      <rect width="1800" height="1200" fill="url(#glow)"/>
      <rect width="1800" height="1200" fill="url(#grid)"/>
    </svg>
  `);
}

function chromeFrame(x: number, y: number, frameWidth: number, frameHeight: number): Buffer {
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${x - 2}" y="${y - 36}" width="${frameWidth + 4}" height="${frameHeight + 40}" rx="22" fill="#101416" stroke="#394147" stroke-width="2"/>
      <circle cx="${x + 22}" cy="${y - 16}" r="6" fill="#ff725e"/>
      <circle cx="${x + 44}" cy="${y - 16}" r="6" fill="#f6c85f"/>
      <circle cx="${x + 66}" cy="${y - 16}" r="6" fill="#69dc92"/>
      <rect x="${x}" y="${y}" width="${frameWidth}" height="${frameHeight}" rx="18" fill="none" stroke="#394147" stroke-width="2"/>
    </svg>
  `);
}

async function roundedCapture(
  source: SourceCapture,
  frameWidth: number,
  frameHeight: number,
): Promise<Buffer> {
  const mask = Buffer.from(`
    <svg width="${frameWidth}" height="${frameHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${frameWidth}" height="${frameHeight}" rx="18" fill="#fff"/>
    </svg>
  `);
  return sharp(source.path)
    .resize(frameWidth, frameHeight, { fit: "cover", position: "top" })
    .composite([{ input: mask, blend: "dest-in" }])
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toBuffer();
}

function brandHeader(rightLabel: string): string {
  return `
    <rect x="90" y="70" width="52" height="52" rx="14" fill="#10271c" stroke="#65f59a" stroke-opacity="0.7"/>
    <text x="116" y="104" text-anchor="middle" fill="#8bffb2" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700">PF</text>
    <text x="162" y="106" fill="#f5f3ee" font-family="Arial, Helvetica, sans-serif" font-size="29" font-weight="700">PitchFlow</text>
    <rect x="1390" y="76" width="320" height="42" rx="21" fill="#101517" stroke="#394147"/>
    <circle cx="1420" cy="97" r="6" fill="#65f59a"/>
    <text x="1440" y="104" fill="#bdc5c9" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" letter-spacing="1.3">${rightLabel}</text>
  `;
}

function typography(content: string): Buffer {
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${content}
    </svg>
  `);
}

async function renderCover(source: SourceCapture): Promise<Buffer> {
  const frame = { x: 90, y: 500, width: 1620, height: 610 };
  const capture = await roundedCapture(source, frame.width, frame.height);
  return sharp(background("#52d7e8"))
    .composite([
      {
        input: typography(`
          ${brandHeader("DEVELOPER TOOLS")}
          <text x="90" y="236" fill="#f7f5ef" font-family="Arial, Helvetica, sans-serif" font-size="92" font-weight="700" letter-spacing="-4">Ship the code.</text>
          <text x="90" y="330" fill="#f7f5ef" font-family="Arial, Helvetica, sans-serif" font-size="92" font-weight="700" letter-spacing="-4">PitchFlow ships the story.</text>
          <text x="94" y="408" fill="#b6c0c6" font-family="Arial, Helvetica, sans-serif" font-size="28">One pinned GitHub commit → one evidence-linked launch system.</text>
          <text x="94" y="450" fill="#75f1a5" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="700" letter-spacing="1.5">GPT-5.6 SOL · LOCAL CODEX · REMOTION · CHECKSUMMED EXPORTS</text>
        `),
      },
      { input: chromeFrame(frame.x, frame.y, frame.width, frame.height), blend: "over" },
      { input: capture, left: frame.x, top: frame.y, blend: "over" },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toBuffer();
}

async function renderEvidence(source: SourceCapture): Promise<Buffer> {
  const frame = { x: 90, y: 352, width: 1620, height: 770 };
  const capture = await roundedCapture(source, frame.width, frame.height);
  return sharp(background("#65f59a"))
    .composite([
      {
        input: typography(`
          ${brandHeader("EVIDENCE FIRST")}
          <text x="90" y="225" fill="#f7f5ef" font-family="Arial, Helvetica, sans-serif" font-size="74" font-weight="700" letter-spacing="-3">Pin one commit. Ground every claim.</text>
          <text x="94" y="288" fill="#b6c0c6" font-family="Arial, Helvetica, sans-serif" font-size="25">Bounded public evidence in; schema-validated, source-linked campaign out.</text>
          <rect x="1320" y="215" width="180" height="52" rx="26" fill="#10271c" stroke="#65f59a" stroke-opacity="0.65"/>
          <text x="1410" y="248" text-anchor="middle" fill="#8bffb2" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700">NO CLONING</text>
          <rect x="1518" y="215" width="192" height="52" rx="26" fill="#10271c" stroke="#65f59a" stroke-opacity="0.65"/>
          <text x="1614" y="248" text-anchor="middle" fill="#8bffb2" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700">NO EXECUTION</text>
        `),
      },
      { input: chromeFrame(frame.x, frame.y, frame.width, frame.height), blend: "over" },
      { input: capture, left: frame.x, top: frame.y, blend: "over" },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toBuffer();
}

async function renderHandoff(source: SourceCapture): Promise<Buffer> {
  const frame = { x: 550, y: 190, width: 1160, height: 755 };
  const capture = await roundedCapture(source, frame.width, frame.height);
  return sharp(background("#52d7e8"))
    .composite([
      {
        input: typography(`
          ${brandHeader("VERIFIED HANDOFF")}
          <text x="90" y="240" fill="#f7f5ef" font-family="Arial, Helvetica, sans-serif" font-size="70" font-weight="700" letter-spacing="-3">One manifest.</text>
          <text x="90" y="318" fill="#f7f5ef" font-family="Arial, Helvetica, sans-serif" font-size="70" font-weight="700" letter-spacing="-3">Every channel.</text>
          <text x="94" y="385" fill="#b6c0c6" font-family="Arial, Helvetica, sans-serif" font-size="23">A reproducible launch package,</text>
          <text x="94" y="420" fill="#b6c0c6" font-family="Arial, Helvetica, sans-serif" font-size="23">not a folder of disconnected drafts.</text>
          <text x="94" y="510" fill="#75f1a5" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" letter-spacing="1.5">01  MICROSITE</text>
          <text x="94" y="560" fill="#75f1a5" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" letter-spacing="1.5">02  SOCIAL SYSTEM</text>
          <text x="94" y="610" fill="#75f1a5" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" letter-spacing="1.5">03  5-SLIDE CAROUSEL</text>
          <text x="94" y="660" fill="#75f1a5" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" letter-spacing="1.5">04  CHANNEL COPY</text>
          <text x="94" y="710" fill="#75f1a5" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" letter-spacing="1.5">05  DUAL-RATIO VIDEO</text>
          <text x="94" y="760" fill="#75f1a5" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" letter-spacing="1.5">06  SHA-256 + SAFE ZIP</text>
          <rect x="90" y="1015" width="1620" height="92" rx="20" fill="#0e171a" stroke="#2f434a"/>
          <text x="126" y="1055" fill="#f7f5ef" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">Judge-ready without a live presentation.</text>
          <text x="126" y="1084" fill="#aeb8bd" font-family="Arial, Helvetica, sans-serif" font-size="17">Public immutable viewer + real local generation through the developer's Codex entitlement.</text>
          <text x="1668" y="1070" text-anchor="end" fill="#52d7e8" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="700">github.com/sickn33/pitchflow</text>
        `),
      },
      { input: chromeFrame(frame.x, frame.y, frame.width, frame.height), blend: "over" },
      { input: capture, left: frame.x, top: frame.y, blend: "over" },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toBuffer();
}

const packageData = await readFile(join(packageDirectory, "judge-package.json"));
const dogfood = parseDogfoodPackage(JSON.parse(packageData.toString("utf8")));

async function sourceCapture(filename: string): Promise<SourceCapture> {
  const href = `/dogfood/pitchflow/v1/images/${filename}`;
  const asset = dogfood.assets.find((candidate) => candidate.href === href);
  if (!asset) throw new Error(`Judge package is missing real UI capture ${href}.`);
  const path = join(packageDirectory, "images", filename);
  const data = await readFile(path);
  if (data.byteLength !== asset.bytes || sha256(data) !== asset.sha256) {
    throw new Error(`Submission source capture no longer matches the judge package: ${href}`);
  }
  const metadata = await sharp(data).metadata();
  if (!metadata.width || !metadata.height || metadata.width < 1_200 || metadata.height < 750) {
    throw new Error(`Submission source capture is too small: ${href}`);
  }
  return { href, path, sha256: asset.sha256, bytes: asset.bytes };
}

const sources = {
  preview: await sourceCapture("product-capture-02.png"),
  evidence: await sourceCapture("product-capture-01.png"),
  handoff: await sourceCapture("product-capture-04.png"),
};

await mkdir(outputDirectory, { recursive: true });
const rendered = [
  { filename: "pitchflow-cover-1800x1200.png", data: await renderCover(sources.preview) },
  {
    filename: "pitchflow-evidence-1800x1200.png",
    data: await renderEvidence(sources.evidence),
  },
  {
    filename: "pitchflow-handoff-1800x1200.png",
    data: await renderHandoff(sources.handoff),
  },
];

const outputs = [];
for (const item of rendered) {
  const path = join(outputDirectory, item.filename);
  await writeFile(path, item.data);
  const metadata = await sharp(item.data).metadata();
  if (metadata.width !== width || metadata.height !== height || metadata.format !== "png") {
    throw new Error(`Submission media has unexpected dimensions or format: ${item.filename}`);
  }
  outputs.push({
    filename: item.filename,
    mediaType: "image/png",
    width,
    height,
    aspectRatio: "3:2",
    bytes: item.data.byteLength,
    sha256: sha256(item.data),
  });
}

const manifest = {
  format: "pitchflow-submission-media",
  version: 1,
  introductionDate: "2026-07-15",
  owner: "Nicco Lucioli",
  license: "Creator-owned; submitted for OpenAI Build Week judging",
  generation: "Deterministic Sharp composition using real locally captured PitchFlow UI",
  fakeProductUi: false,
  sourceJudgePackageSha256: sha256(packageData),
  sources: Object.values(sources).map((source) => ({
    href: source.href,
    bytes: source.bytes,
    sha256: source.sha256,
    provenance: "Creator-owned real PitchFlow browser capture",
  })),
  outputs,
};
await writeFile(join(outputDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      status: "ok",
      output: relative(root, outputDirectory),
      sourceJudgePackageSha256: manifest.sourceJudgePackageSha256,
      outputs,
    },
    null,
    2,
  ),
);
