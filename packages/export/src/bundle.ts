import { lstat, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";

import {
  CampaignManifestSchema,
  CreativeAssetSchema,
  RepoSnapshotSchema,
  auditManifestEvidence,
  assertSafeArchivePath,
  sha256,
  type CampaignManifest,
  type CreativeAsset,
  type RepoSnapshot,
} from "@pitchflow/core";
import {
  VIDEO_LAYOUTS,
  renderCampaignVideo,
  type CaptureInput,
  type PitchFlowRenderProgress,
  type VideoLayout,
} from "@pitchflow/remotion";
import JSZip from "jszip";
import sharp from "sharp";

import { renderCopyMarkdown } from "./copy";
import {
  carouselImageDefinition,
  renderCampaignImage,
  socialImageDefinitions,
  type CreativeLayoutReceipt,
  type SocialImageDefinition,
} from "./images";
import { renderMicrositeCss, renderMicrositeHtml } from "./site";

export type ExternalAsset = {
  sourcePath: string;
  filename: string;
  mediaType: string;
  width: number | null;
  height: number | null;
  intendedChannel: string;
  provenance: Extract<CreativeAsset["provenance"], "user-supplied" | "licensed-third-party">;
};

export type ProductCapture = {
  sourcePath: string;
  alt: string;
  caption: string;
  provenance: Extract<CreativeAsset["provenance"], "pitchflow-generated" | "user-supplied">;
  declaration: "creator-owned" | "authorized-use" | "test-fixture";
  sceneIndexes?: number[];
};

export type RenderBundleOptions = {
  productCaptures: ProductCapture[];
  externalAssets?: ExternalAsset[];
  renderVideos?: {
    layouts?: VideoLayout[];
    browserExecutable?: string;
    scale?: number;
    onProgress?: (layout: VideoLayout, event: PitchFlowRenderProgress) => void;
  };
  onStage?: (stage: RenderBundleStage) => void;
};

export type RenderBundleStage =
  | "writing-core"
  | "rendering-images"
  | "rendering-videos"
  | "indexing"
  | "packaging"
  | "complete";

type StagedProductCapture = Omit<ProductCapture, "sourcePath" | "sceneIndexes"> & {
  filename: string;
  data: Buffer;
  mediaType: "image/png" | "image/jpeg";
  width: number;
  height: number;
  sceneIndexes: number[];
};

const MAX_CAPTURE_BYTES = 12 * 1024 * 1024;
const MAX_CAPTURE_DIMENSION = 7680;

function assertCaptureText(value: string, label: string, maximum: number): void {
  const containsControlCharacter = [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return (
      (code >= 0 && code <= 8) ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127
    );
  });
  if (value.length < 3 || value.length > maximum || containsControlCharacter) {
    throw new Error(`${label} must be 3–${maximum} printable characters.`);
  }
}

async function validateProductCaptures(
  captures: ProductCapture[],
  manifest: CampaignManifest,
): Promise<StagedProductCapture[]> {
  if (captures.length < 2 || captures.length > 4) {
    throw new Error("Campaign export requires 2–4 real product UI captures.");
  }

  const renderableSceneIndexes = manifest.video.scenes
    .filter((scene) => scene.visual !== "closing")
    .map((scene) => scene.index);
  const renderableSceneSet = new Set(renderableSceneIndexes);
  const validated = await Promise.all(
    captures.map(async (capture, index) => {
      assertCaptureText(capture.alt, `Capture ${index + 1} alt text`, 180);
      assertCaptureText(capture.caption, `Capture ${index + 1} caption`, 100);
      if (
        (capture.declaration === "test-fixture") !==
        (capture.provenance === "pitchflow-generated")
      ) {
        throw new Error(
          "Only explicit test fixtures may use pitchflow-generated product-capture provenance.",
        );
      }
      const sceneIndexes = capture.sceneIndexes
        ? [...new Set(capture.sceneIndexes)].sort((left, right) => left - right)
        : [...renderableSceneIndexes];
      if (
        sceneIndexes.length === 0 ||
        sceneIndexes.length !== (capture.sceneIndexes?.length ?? renderableSceneIndexes.length) ||
        sceneIndexes.some(
          (sceneIndex) => !Number.isInteger(sceneIndex) || !renderableSceneSet.has(sceneIndex),
        )
      ) {
        throw new Error(
          `Product capture ${index + 1} must target unique non-closing scene indexes from this manifest.`,
        );
      }
      const sourcePath = resolve(capture.sourcePath);
      const sourceStat = await lstat(sourcePath);
      if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) {
        throw new Error(`Product capture must be a regular local file: ${sourcePath}`);
      }
      if (sourceStat.size <= 0 || sourceStat.size > MAX_CAPTURE_BYTES) {
        throw new Error(`Product capture must be between 1 byte and 12 MiB: ${sourcePath}`);
      }
      const data = await readFile(sourcePath);
      const metadata = await sharp(data, { failOn: "error" }).metadata();
      if (
        (metadata.format !== "png" && metadata.format !== "jpeg") ||
        !metadata.width ||
        !metadata.height ||
        metadata.width > MAX_CAPTURE_DIMENSION ||
        metadata.height > MAX_CAPTURE_DIMENSION
      ) {
        throw new Error(
          `Product capture must be a valid PNG/JPEG no larger than ${MAX_CAPTURE_DIMENSION}px per side: ${sourcePath}`,
        );
      }
      const extension = metadata.format === "png" ? "png" : "jpg";
      return {
        alt: capture.alt,
        caption: capture.caption,
        provenance: capture.provenance,
        declaration: capture.declaration,
        sceneIndexes,
        filename: `images/product-capture-${String(index + 1).padStart(2, "0")}.${extension}`,
        data,
        mediaType: metadata.format === "png" ? ("image/png" as const) : ("image/jpeg" as const),
        width: metadata.width,
        height: metadata.height,
      };
    }),
  );
  for (const sceneIndex of renderableSceneIndexes) {
    if (!validated.some((capture) => capture.sceneIndexes.includes(sceneIndex))) {
      throw new Error(`Production scene ${sceneIndex} has no documented real product capture.`);
    }
  }
  return validated;
}

export type RenderedBundle = {
  outputDirectory: string;
  assets: CreativeAsset[];
  assetIndexPath: string;
  archivePath: string;
};

function ensureOutputBoundary(outputDirectory: string): string {
  const absolute = resolve(outputDirectory);
  const cwd = resolve(process.cwd());
  if (absolute === cwd || !absolute.startsWith(`${cwd}${sep}`)) {
    throw new Error("Export output must be a child directory of the current PitchFlow workspace.");
  }
  return absolute;
}

async function assertFreshDirectory(path: string): Promise<void> {
  try {
    const entries = await readdir(path);
    if (entries.length > 0) {
      throw new Error(`Refusing to overwrite non-empty export directory: ${path}`);
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
}

async function writeUtf8(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

function assetKindFor(filename: string): CreativeAsset["kind"] {
  if (filename.startsWith("site/")) return "microsite";
  if (filename.startsWith("images/")) return "image";
  if (filename.startsWith("carousel/")) return "carousel";
  if (filename.startsWith("videos/")) return "video";
  if (filename.startsWith("copy/")) return "copy";
  if (filename.endsWith(".json")) return "manifest";
  return "archive";
}

async function inspectAsset(
  outputDirectory: string,
  filename: string,
  intendedChannel: string,
  provenance: CreativeAsset["provenance"] = "pitchflow-generated",
  knownMedia?: Pick<ExternalAsset, "mediaType" | "width" | "height">,
): Promise<CreativeAsset> {
  assertSafeArchivePath(filename);
  const path = join(outputDirectory, filename);
  const data = await readFile(path);
  let width: number | null = knownMedia?.width ?? null;
  let height: number | null = knownMedia?.height ?? null;
  let mediaType = knownMedia?.mediaType ?? "application/octet-stream";
  if (filename.endsWith(".png")) {
    const metadata = await sharp(data).metadata();
    width = metadata.width ?? null;
    height = metadata.height ?? null;
    mediaType = "image/png";
  } else if (filename.endsWith(".html")) mediaType = "text/html";
  else if (filename.endsWith(".css")) mediaType = "text/css";
  else if (filename.endsWith(".md")) mediaType = "text/markdown";
  else if (filename.endsWith(".json")) mediaType = "application/json";
  else if (filename.endsWith(".mp4")) mediaType = "video/mp4";
  else if (filename.endsWith(".zip")) mediaType = "application/zip";
  return CreativeAssetSchema.parse({
    id: `asset_${sha256(filename).slice(0, 12)}`,
    kind: assetKindFor(filename),
    filename,
    mediaType,
    width,
    height,
    bytes: data.byteLength,
    sha256: sha256(data),
    provenance,
    intendedChannel,
  });
}

async function assertImageDimensions(
  path: string,
  definition: SocialImageDefinition,
): Promise<void> {
  const metadata = await sharp(path).metadata();
  if (metadata.width !== definition.width || metadata.height !== definition.height) {
    throw new Error(
      `${definition.filename} has ${metadata.width ?? "?"}x${metadata.height ?? "?"}; expected ${definition.width}x${definition.height}.`,
    );
  }
}

export async function renderCampaignBundle(
  manifestInput: CampaignManifest,
  snapshotInput: RepoSnapshot,
  outputDirectoryInput: string,
  options: RenderBundleOptions,
): Promise<RenderedBundle> {
  const manifest = CampaignManifestSchema.parse(manifestInput);
  const snapshot = RepoSnapshotSchema.parse(snapshotInput);
  if (
    manifest.source.snapshotId !== snapshot.id ||
    manifest.source.commitSha !== snapshot.commitSha
  ) {
    throw new Error("Manifest and repository snapshot provenance do not match.");
  }
  const evidenceAudit = auditManifestEvidence(manifest, snapshot);
  if (!evidenceAudit.valid) {
    throw new Error(`Manifest evidence audit failed: ${evidenceAudit.errors[0]}`);
  }
  const productCaptures = await validateProductCaptures(options.productCaptures, manifest);
  const outputDirectory = ensureOutputBoundary(outputDirectoryInput);
  await assertFreshDirectory(outputDirectory);
  await Promise.all(
    ["site", "images", "carousel", "copy", "videos"].map((directory) =>
      mkdir(join(outputDirectory, directory), { recursive: true }),
    ),
  );

  options.onStage?.("writing-core");
  await Promise.all([
    writeUtf8(
      join(outputDirectory, "site/index.html"),
      renderMicrositeHtml(
        manifest,
        snapshot,
        productCaptures.map(({ filename, alt, caption }) => ({ filename, alt, caption })),
      ),
    ),
    writeUtf8(join(outputDirectory, "site/styles.css"), renderMicrositeCss(manifest)),
    writeUtf8(
      join(outputDirectory, "copy/campaign.json"),
      `${JSON.stringify(manifest.copy, null, 2)}\n`,
    ),
    writeUtf8(join(outputDirectory, "copy/campaign.md"), renderCopyMarkdown(manifest)),
    writeUtf8(
      join(outputDirectory, "campaign-manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    ),
    writeUtf8(
      join(outputDirectory, "repository-snapshot.json"),
      `${JSON.stringify(snapshot, null, 2)}\n`,
    ),
    ...productCaptures.map((capture) =>
      writeFile(join(outputDirectory, capture.filename), capture.data),
    ),
    writeUtf8(
      join(outputDirectory, "capture-provenance.json"),
      `${JSON.stringify(
        {
          schemaVersion: "1.0.0",
          captures: productCaptures.map((capture) => ({
            filename: capture.filename,
            label: capture.caption,
            description: capture.alt,
            declaration: capture.declaration,
            provenance: capture.provenance,
            sceneIndexes: capture.sceneIndexes,
            mediaType: capture.mediaType,
            width: capture.width,
            height: capture.height,
            bytes: capture.data.byteLength,
            sha256: sha256(capture.data),
          })),
        },
        null,
        2,
      )}\n`,
    ),
  ]);

  const imageDefinitions = socialImageDefinitions(manifest);
  const creativeLayoutReceipts: CreativeLayoutReceipt[] = [];
  options.onStage?.("rendering-images");
  creativeLayoutReceipts.push(
    ...(await Promise.all(
      imageDefinitions.map(async (definition) => {
        const outputPath = join(outputDirectory, "images", definition.filename);
        const receipt = await renderCampaignImage(
          manifest,
          definition,
          outputPath,
          productCaptures,
        );
        await assertImageDimensions(outputPath, definition);
        return { ...receipt, filename: `images/${receipt.filename}` };
      }),
    )),
  );
  creativeLayoutReceipts.push(
    ...(await Promise.all(
      manifest.carousel.map(async (slide) => {
        const definition = carouselImageDefinition(slide, manifest.productBrief.productName);
        const outputPath = join(outputDirectory, "carousel", definition.filename);
        const receipt = await renderCampaignImage(
          manifest,
          definition,
          outputPath,
          productCaptures,
        );
        await assertImageDimensions(outputPath, definition);
        return { ...receipt, filename: `carousel/${receipt.filename}` };
      }),
    )),
  );
  await writeUtf8(
    join(outputDirectory, "creative-layout-receipts.json"),
    `${JSON.stringify(
      {
        schemaVersion: "1.0.0",
        assets: creativeLayoutReceipts,
      },
      null,
      2,
    )}\n`,
  );

  const knownMediaByFilename = new Map<
    string,
    Pick<ExternalAsset, "mediaType" | "width" | "height">
  >();
  const renderedVideos: Array<[filename: string, intendedChannel: string]> = [];
  const renderReceipts: Array<Record<string, unknown>> = [];
  if (options.renderVideos) {
    options.onStage?.("rendering-videos");
    const layouts = options.renderVideos.layouts ?? [...VIDEO_LAYOUTS];
    if (new Set(layouts).size !== layouts.length) {
      throw new Error("Video render layouts must not contain duplicates.");
    }
    for (const layout of layouts) {
      const filename =
        layout === "landscape"
          ? "videos/launch-landscape-1920x1080.mp4"
          : "videos/launch-portrait-1080x1920.mp4";
      const captureInputs: CaptureInput[] = manifest.video.scenes
        .filter((scene) => scene.visual !== "closing")
        .flatMap((scene) =>
          productCaptures
            .filter((capture) => capture.sceneIndexes.includes(scene.index))
            .map((capture, order) => ({
              id: `product_capture_${String(order + 1).padStart(2, "0")}_scene_${String(scene.index).padStart(2, "0")}`,
              sceneIndex: scene.index,
              order,
              alt: capture.alt,
              source: {
                kind: "file" as const,
                path: join(outputDirectory, capture.filename),
              },
            })),
        );
      const metadata = await renderCampaignVideo({
        manifest,
        outputPath: join(outputDirectory, filename),
        layout,
        ...(options.renderVideos.browserExecutable
          ? { browserExecutable: options.renderVideos.browserExecutable }
          : {}),
        ...(options.renderVideos.scale === undefined ? {} : { scale: options.renderVideos.scale }),
        captures: captureInputs,
        onProgress: (event) => options.renderVideos?.onProgress?.(layout, event),
      });
      knownMediaByFilename.set(filename, {
        mediaType: metadata.mediaType,
        width: metadata.width,
        height: metadata.height,
      });
      renderedVideos.push([
        filename,
        layout === "landscape" ? "Landscape launch video" : "Portrait launch video",
      ]);
      renderReceipts.push({
        ...metadata,
        outputPath: filename,
      });
    }
    await writeUtf8(
      join(outputDirectory, "video-render-metadata.json"),
      `${JSON.stringify({ schemaVersion: "1.0.0", renders: renderReceipts }, null, 2)}\n`,
    );
  }

  for (const external of options.externalAssets ?? []) {
    assertSafeArchivePath(external.filename);
    if (!external.filename.startsWith("videos/")) {
      throw new Error("External assets are restricted to the videos/ export directory.");
    }
    if (knownMediaByFilename.has(external.filename)) {
      throw new Error(`Duplicate video asset filename: ${external.filename}`);
    }
    const source = resolve(external.sourcePath);
    if (!(await stat(source)).isFile()) throw new Error(`External asset is not a file: ${source}`);
    await writeFile(join(outputDirectory, external.filename), await readFile(source));
    knownMediaByFilename.set(external.filename, {
      mediaType: external.mediaType,
      width: external.width,
      height: external.height,
    });
  }

  const expectedAssets: Array<
    [filename: string, intendedChannel: string, provenance?: CreativeAsset["provenance"]]
  > = [
    ["site/index.html", "Static microsite"],
    ["site/styles.css", "Static microsite"],
    ["copy/campaign.json", "Structured campaign copy"],
    ["copy/campaign.md", "Human-readable campaign copy"],
    ["campaign-manifest.json", "Structured campaign manifest"],
    ["repository-snapshot.json", "Repository evidence record", "repository-derived"],
    ["capture-provenance.json", "Product capture provenance record"],
    ["creative-layout-receipts.json", "Static creative layout and text-fit evidence"],
    ...imageDefinitions.map(
      (definition) => [`images/${definition.filename}`, definition.channel] as [string, string],
    ),
    ...manifest.carousel.map((slide) => {
      const definition = carouselImageDefinition(slide, manifest.productBrief.productName);
      return [`carousel/${definition.filename}`, `Carousel slide ${slide.index}`] as [
        string,
        string,
      ];
    }),
    ...productCaptures.map(
      (capture) =>
        [capture.filename, `Product capture · ${capture.caption}`, capture.provenance] as [
          string,
          string,
          CreativeAsset["provenance"],
        ],
    ),
    ...renderedVideos,
    ...(renderReceipts.length > 0
      ? ([["video-render-metadata.json", "Reproducible video render metadata"]] as Array<
          [string, string]
        >)
      : []),
    ...(options.externalAssets ?? []).map(
      (external) =>
        [external.filename, external.intendedChannel, external.provenance] as [
          string,
          string,
          CreativeAsset["provenance"],
        ],
    ),
  ];
  options.onStage?.("indexing");
  const assets: CreativeAsset[] = [];
  for (const [filename, channel, provenance] of expectedAssets) {
    assets.push(
      await inspectAsset(
        outputDirectory,
        filename,
        channel,
        provenance,
        knownMediaByFilename.get(filename),
      ),
    );
  }

  const assetIndexPath = join(outputDirectory, "asset-index.json");
  await writeUtf8(
    assetIndexPath,
    `${JSON.stringify(
      {
        schemaVersion: "1.0.0",
        campaignId: manifest.id,
        commitSha: manifest.source.commitSha,
        note: "The index lists bundle contents except itself and the archive to avoid recursive hashes.",
        assets,
      },
      null,
      2,
    )}\n`,
  );

  const zip = new JSZip();
  options.onStage?.("packaging");
  for (const [filename] of expectedAssets) {
    assertSafeArchivePath(filename);
    zip.file(filename, await readFile(join(outputDirectory, filename)));
  }
  zip.file("asset-index.json", await readFile(assetIndexPath));
  const archivePath = join(outputDirectory, "pitchflow-campaign.zip");
  await writeFile(
    archivePath,
    await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
      platform: "UNIX",
    }),
  );

  assets.push(await inspectAsset(outputDirectory, "asset-index.json", "Asset inventory"));
  assets.push(
    await inspectAsset(outputDirectory, basename(archivePath), "Complete campaign archive"),
  );
  options.onStage?.("complete");
  return { outputDirectory, assets, assetIndexPath, archivePath };
}
