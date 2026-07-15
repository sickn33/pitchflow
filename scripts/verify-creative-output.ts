import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import sharp from "sharp";

import { requiredArgument } from "./arguments";

const execFileAsync = promisify(execFile);
const root = resolve(process.cwd());
const bundle = resolve(requiredArgument("bundle"));
const output = resolve(requiredArgument("output"));
const expectedProduct = requiredArgument("expected-product");

for (const path of [bundle, output]) {
  if (!path.startsWith(`${root}${sep}`)) {
    throw new Error("Creative verification paths must remain inside the PitchFlow repository.");
  }
}
if (output.startsWith(`${bundle}${sep}`) || bundle.startsWith(`${output}${sep}`)) {
  throw new Error("Creative inspection evidence must remain separate from the immutable bundle.");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function record(value: unknown, label: string): Record<string, unknown> {
  assert(value !== null && typeof value === "object" && !Array.isArray(value), `${label} invalid.`);
  return value as Record<string, unknown>;
}

function normalized(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function freshDirectory(path: string): Promise<void> {
  try {
    assert((await readdir(path)).length === 0, `Refusing non-empty inspection directory: ${path}`);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      await mkdir(path, { recursive: true });
      return;
    }
    throw error;
  }
}

type SheetInput = { path: string; width: number; height: number; left: number; top: number };

async function contactSheet(
  inputs: SheetInput[],
  width: number,
  height: number,
  path: string,
): Promise<void> {
  const composites = await Promise.all(
    inputs.map(async (input) => ({
      input: await sharp(input.path)
        .resize(input.width, input.height, {
          fit: "contain",
          background: { r: 17, g: 17, b: 17, alpha: 1 },
        })
        .png()
        .toBuffer(),
      left: input.left,
      top: input.top,
    })),
  );
  await sharp({ create: { width, height, channels: 4, background: "#111111" } })
    .composite(composites)
    .png({ compressionLevel: 8 })
    .toFile(path);
}

async function probeVideo(path: string): Promise<Record<string, unknown>> {
  const { stdout } = await execFileAsync(process.env.FFPROBE_PATH ?? "ffprobe", [
    "-v",
    "error",
    "-show_streams",
    "-show_format",
    "-of",
    "json",
    path,
  ]);
  const probe: unknown = JSON.parse(stdout);
  const parsed = record(probe, basename(path));
  const streams = parsed.streams;
  assert(Array.isArray(streams), `${basename(path)} omitted streams.`);
  const video = streams
    .map((entry) => record(entry, "Video stream"))
    .find((entry) => entry.codec_type === "video");
  assert(video, `${basename(path)} omitted a video stream.`);
  return { format: parsed.format, video };
}

async function videoSheet(
  input: string,
  outputPath: string,
  scale: string,
  tile: string,
  frames: number,
  opening = false,
): Promise<void> {
  const filter = opening
    ? `fps=4,scale=${scale}:force_original_aspect_ratio=decrease,pad=${scale.replace(":", ":")}:0:0:#111111,tile=${tile}`
    : `fps=1/2,scale=${scale}:force_original_aspect_ratio=decrease,pad=${scale.replace(":", ":")}:0:0:#111111,tile=${tile}`;
  const args = ["-hide_banner", "-loglevel", "error", "-i", input];
  if (opening) args.push("-t", "2");
  args.push("-vf", filter, "-frames:v", "1", "-y", outputPath);
  await execFileAsync(process.env.FFMPEG_PATH ?? "ffmpeg", args, { maxBuffer: 4 * 1024 * 1024 });
  const metadata = await sharp(outputPath).metadata();
  assert(metadata.width && metadata.height, `${basename(outputPath)} was not rendered.`);
  assert(frames > 0, "Frame count contract invalid.");
}

await freshDirectory(output);

const manifest = record(
  JSON.parse(await readFile(join(bundle, "campaign-manifest.json"), "utf8")) as unknown,
  "Campaign manifest",
);
const productBrief = record(manifest.productBrief, "Product brief");
assert(productBrief.productName === expectedProduct, `Expected ${expectedProduct} output.`);

const candidateIndex = record(
  JSON.parse(await readFile(join(bundle, "asset-index.json"), "utf8")) as unknown,
  "Candidate asset index",
);
const dogfoodIndex = record(
  JSON.parse(
    await readFile(join(root, "apps/web/public/dogfood/pitchflow/v1/asset-index.json"), "utf8"),
  ) as unknown,
  "PitchFlow dogfood asset index",
);
assert(
  Array.isArray(candidateIndex.assets) && Array.isArray(dogfoodIndex.assets),
  "Asset indexes invalid.",
);
const dogfoodHashes = new Set(
  dogfoodIndex.assets.map((entry) => {
    const asset = record(entry, "Dogfood asset");
    assert(typeof asset.sha256 === "string", "Dogfood asset hash missing.");
    return asset.sha256;
  }),
);
const sharedDogfoodHashes = candidateIndex.assets.flatMap((entry) => {
  const asset = record(entry, "Candidate asset");
  return typeof asset.sha256 === "string" && dogfoodHashes.has(asset.sha256)
    ? [String(asset.filename)]
    : [];
});
assert(sharedDogfoodHashes.length === 0, "Candidate reuses PitchFlow dogfood asset bytes.");
const creativeCopy = JSON.stringify({
  productBrief: manifest.productBrief,
  claims: manifest.claims,
  socialCards: manifest.socialCards,
  carousel: manifest.carousel,
  copy: manifest.copy,
  video: manifest.video,
}).toLowerCase();
const blockedDogfoodCopy = [
  "pitchflow is",
  "repo-to-launch studio",
  "ship the code",
  "cached judge viewer",
  "openai build week",
];
const dogfoodCopyHits = blockedDogfoodCopy.filter((term) => creativeCopy.includes(term));
assert(dogfoodCopyHits.length === 0, "Candidate contains PitchFlow dogfood product copy.");

const provenance = record(
  JSON.parse(await readFile(join(bundle, "capture-provenance.json"), "utf8")) as unknown,
  "Capture provenance",
);
assert(
  Array.isArray(provenance.captures) && provenance.captures.length >= 2,
  "Two captures required.",
);
const captureFiles = new Set(
  provenance.captures.map((entry) => {
    const capture = record(entry, "Capture provenance entry");
    assert(typeof capture.filename === "string", "Capture filename missing.");
    assert(
      typeof capture.sha256 === "string" && /^[a-f0-9]{64}$/.test(capture.sha256),
      "Capture hash invalid.",
    );
    return capture.filename;
  }),
);

const receiptDocument = record(
  JSON.parse(await readFile(join(bundle, "creative-layout-receipts.json"), "utf8")) as unknown,
  "Creative receipts",
);
assert(Array.isArray(receiptDocument.assets), "Creative receipts omitted assets.");
assert(receiptDocument.assets.length === 9, "Expected four social and five carousel receipts.");

const expectedDimensions = new Map<string, [number, number]>([
  ["images/og-1200x630.png", [1200, 630]],
  ["images/x-1600x900.png", [1600, 900]],
  ["images/linkedin-1200x627.png", [1200, 627]],
  ["images/instagram-1080x1080.png", [1080, 1080]],
  ...Array.from(
    { length: 5 },
    (_, index) =>
      [
        `carousel/slide-${String(index + 1).padStart(2, "0")}-1080x1350.png`,
        [1080, 1350] as [number, number],
      ] as [string, [number, number]],
  ),
]);
const requiredStages = [
  "hook-problem",
  "capture-flow",
  "extracted-result",
  "export-share-outcome",
  "cta",
];
const observedLayouts = new Set<string>();
const observedStages: string[] = [];
const receiptSummary: Array<Record<string, unknown>> = [];

for (const raw of receiptDocument.assets) {
  const receipt = record(raw, "Creative receipt");
  assert(typeof receipt.filename === "string", "Receipt filename missing.");
  const dimensions = expectedDimensions.get(receipt.filename);
  assert(dimensions, `Unexpected creative receipt: ${receipt.filename}`);
  assert(
    receipt.width === dimensions[0] && receipt.height === dimensions[1],
    `${receipt.filename} receipt dimensions invalid.`,
  );
  const metadata = await sharp(join(bundle, receipt.filename)).metadata();
  assert(
    metadata.width === dimensions[0] && metadata.height === dimensions[1],
    `${receipt.filename} pixel dimensions invalid.`,
  );
  assert(
    typeof receipt.layoutId === "string" && receipt.layoutId.length > 5,
    `${receipt.filename} layout missing.`,
  );
  observedLayouts.add(receipt.layoutId);
  assert(
    Array.isArray(receipt.captureFilenames) && receipt.captureFilenames.length > 0,
    `${receipt.filename} is not capture-led.`,
  );
  for (const filename of receipt.captureFilenames) {
    assert(
      typeof filename === "string" && captureFiles.has(filename),
      `${receipt.filename} references an unproved capture.`,
    );
  }
  if (receipt.filename.startsWith("carousel/")) {
    assert(
      typeof receipt.narrativeStage === "string",
      `${receipt.filename} narrative stage missing.`,
    );
    observedStages.push(receipt.narrativeStage);
  } else {
    assert(
      receipt.narrativeStage === null,
      `${receipt.filename} should not claim a carousel stage.`,
    );
  }
  assert(
    Array.isArray(receipt.textBlocks) && receipt.textBlocks.length >= 4,
    `${receipt.filename} text receipts missing.`,
  );
  const textIds = new Set<string>();
  for (const rawText of receipt.textBlocks) {
    const text = record(rawText, `${receipt.filename} text block`);
    assert(
      typeof text.id === "string" && !textIds.has(text.id),
      `${receipt.filename} text id duplicated.`,
    );
    textIds.add(text.id);
    assert(
      text.fits === true && text.truncated === false,
      `${receipt.filename} contains truncated text.`,
    );
    assert(
      typeof text.original === "string" && typeof text.rendered === "string",
      `${receipt.filename} text receipt invalid.`,
    );
    assert(
      Array.isArray(text.lines) && text.lines.every((line) => typeof line === "string"),
      `${receipt.filename} lines invalid.`,
    );
    assert(
      normalized(text.original) === normalized(text.lines.join(" ")),
      `${receipt.filename} dropped or changed visible text.`,
    );
    assert(
      !text.rendered.includes("…") && !text.rendered.includes("..."),
      `${receipt.filename} contains visible ellipsis.`,
    );
    assert(
      typeof text.fontSize === "number" && text.fontSize >= 12,
      `${receipt.filename} font became unreadable.`,
    );
  }
  receiptSummary.push({
    filename: receipt.filename,
    layoutId: receipt.layoutId,
    narrativeStage: receipt.narrativeStage,
    captures: receipt.captureFilenames,
    textFit: true,
  });
  expectedDimensions.delete(receipt.filename);
}
assert(expectedDimensions.size === 0, "Creative receipts omitted required files.");
assert(
  observedLayouts.size === 9,
  "Every social/carousel asset must use a distinct reusable layout id.",
);
assert(
  JSON.stringify(observedStages) === JSON.stringify(requiredStages),
  "Carousel narrative arc is out of order.",
);

const social = [
  "images/og-1200x630.png",
  "images/x-1600x900.png",
  "images/linkedin-1200x627.png",
  "images/instagram-1080x1080.png",
].map((filename, index) => ({
  path: join(bundle, filename),
  width: 700,
  height: 500,
  left: (index % 2) * 724 + 12,
  top: Math.floor(index / 2) * 524 + 12,
}));
await contactSheet(social, 1448, 1048, join(output, "social-all-4.png"));

const carousel = Array.from({ length: 5 }, (_, index) => ({
  path: join(bundle, `carousel/slide-${String(index + 1).padStart(2, "0")}-1080x1350.png`),
  width: 324,
  height: 405,
  left: index * 340 + 8,
  top: 8,
}));
await contactSheet(carousel, 1700, 421, join(output, "carousel-all-5.png"));

const landscapePath = join(bundle, "videos/launch-landscape-1920x1080.mp4");
const portraitPath = join(bundle, "videos/launch-portrait-1080x1920.mp4");
const landscapeProbe = await probeVideo(landscapePath);
const portraitProbe = await probeVideo(portraitPath);
const landscapeVideo = record(landscapeProbe.video, "Landscape stream");
const portraitVideo = record(portraitProbe.video, "Portrait stream");
assert(
  landscapeVideo.width === 1920 && landscapeVideo.height === 1080,
  "Landscape master dimensions invalid.",
);
assert(
  portraitVideo.width === 1080 && portraitVideo.height === 1920,
  "Portrait master dimensions invalid.",
);

await videoSheet(landscapePath, join(output, "landscape-contact-18.png"), "320:180", "6x3", 18);
await videoSheet(portraitPath, join(output, "portrait-contact-18.png"), "180:320", "6x3", 18);
await videoSheet(landscapePath, join(output, "landscape-opening-8.png"), "480:270", "4x2", 8, true);
await videoSheet(portraitPath, join(output, "portrait-opening-8.png"), "270:480", "4x2", 8, true);

const evidenceFiles = await readdir(output);
const evidenceHashes = await Promise.all(
  evidenceFiles.sort().map(async (filename) => {
    const bytes = await readFile(join(output, filename));
    return { filename, bytes: bytes.byteLength, sha256: sha256(bytes) };
  }),
);
const report = {
  format: "pitchflow-creative-output-verification",
  version: 1,
  generatedAt: new Date().toISOString(),
  bundle: relative(root, bundle),
  expectedProduct,
  status: "objective-pass-visual-review-required",
  staticAssets: receiptSummary,
  narrativeStages: observedStages,
  distinctLayouts: observedLayouts.size,
  captures: [...captureFiles],
  productIsolation: {
    dogfoodAssetHashesCompared: dogfoodHashes.size,
    sharedDogfoodHashes,
    blockedDogfoodCopyHits: dogfoodCopyHits,
    pitchFlowGeneratorCreditAllowed: true,
  },
  videoProbes: { landscape: landscapeProbe, portrait: portraitProbe },
  evidenceFiles: evidenceHashes,
  assertions: {
    allNineCreativesPresent: true,
    dimensionsExact: true,
    captureLed: true,
    textFitsWithoutTruncation: true,
    distinctPlatformLayouts: true,
    carouselNarrativeComplete: true,
    videosPresentAtRequiredRatios: true,
    noPitchFlowDogfoodContentLeakage: true,
    parentVisualReviewRequired: true,
  },
};
await writeFile(
  join(output, "creative-output-verification.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  { flag: "wx" },
);

process.stdout.write(
  `${JSON.stringify({ status: report.status, output: relative(root, output), assertions: report.assertions }, null, 2)}\n`,
);
