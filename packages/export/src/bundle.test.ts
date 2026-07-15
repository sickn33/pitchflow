import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  PITCHFLOW_PROMPT_VERSION,
  createDeterministicCampaignDraft,
  finalizeCampaignManifest,
} from "@pitchflow/core";
import JSZip from "jszip";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import { createTestSnapshot } from "../../../tests/helpers/snapshot";
import { renderCampaignBundle, type ProductCapture, type RenderBundleOptions } from "./bundle";

const temporaryPaths = new Set<string>();

type Bounds = { x: number; y: number; width: number; height: number };

function boundsOverlap(left: Bounds, right: Bounds): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

afterEach(async () => {
  await Promise.all([...temporaryPaths].map((path) => rm(path, { recursive: true, force: true })));
  temporaryPaths.clear();
});

function createManifest() {
  const snapshot = createTestSnapshot();
  const manifest = finalizeCampaignManifest(createDeterministicCampaignDraft(snapshot), snapshot, {
    provider: "deterministic-fixture",
    model: "fixture-v1",
    promptVersion: PITCHFLOW_PROMPT_VERSION,
    generatedAt: "2026-07-15T04:30:00.000Z",
    threadId: null,
    repairAttempts: 0,
    usage: null,
  });
  return { snapshot, manifest };
}

function outputDirectory(label: string): string {
  const path = join(process.cwd(), "artifacts", "work", `${label}-${randomUUID()}`);
  temporaryPaths.add(path);
  return path;
}

async function fixtureCaptures(label: string): Promise<ProductCapture[]> {
  const directory = outputDirectory(`${label}-captures`);
  await mkdir(directory, { recursive: true });
  const colors = ["#7c5cff", "#23d9b7"];
  const captures = await Promise.all(
    colors.map(async (background, index) => {
      const sourcePath = join(directory, `capture-${index + 1}.png`);
      await sharp({
        create: { width: 320, height: 200, channels: 4, background },
      })
        .png()
        .toFile(sourcePath);
      return {
        sourcePath,
        alt: `Deterministic test product interface ${index + 1}`,
        caption: `Test product view ${index + 1}`,
        provenance: "pitchflow-generated" as const,
        declaration: "test-fixture" as const,
      };
    }),
  );
  return captures;
}

async function renderTestBundle(
  manifest: ReturnType<typeof createManifest>["manifest"],
  snapshot: ReturnType<typeof createManifest>["snapshot"],
  output: string,
  options: Omit<RenderBundleOptions, "productCaptures"> = {},
) {
  return renderCampaignBundle(manifest, snapshot, output, {
    ...options,
    productCaptures: await fixtureCaptures("bundle"),
  });
}

describe("renderCampaignBundle", () => {
  it("renders an exact-dimension site, social pack, carousel, copy, manifest, index, and safe ZIP", async () => {
    const { snapshot, manifest } = createManifest();
    const output = outputDirectory("complete-bundle");
    const result = await renderTestBundle(manifest, snapshot, output);

    expect(result.assets.map((asset) => asset.filename)).toEqual(
      expect.arrayContaining([
        "site/index.html",
        "images/og-1200x630.png",
        "images/x-1600x900.png",
        "images/linkedin-1200x627.png",
        "images/instagram-1080x1080.png",
        "images/product-capture-01.png",
        "images/product-capture-02.png",
        "carousel/slide-01-1080x1350.png",
        "carousel/slide-05-1080x1350.png",
        "copy/campaign.md",
        "capture-provenance.json",
        "creative-layout-receipts.json",
        "campaign-manifest.json",
        "asset-index.json",
        "pitchflow-campaign.zip",
      ]),
    );

    const dimensions = await sharp(join(output, "images/og-1200x630.png")).metadata();
    expect(dimensions).toMatchObject({ width: 1200, height: 630, format: "png" });
    const slide = await sharp(join(output, "carousel/slide-03-1080x1350.png")).metadata();
    expect(slide).toMatchObject({ width: 1080, height: 1350, format: "png" });

    const archive = await JSZip.loadAsync(await readFile(result.archivePath));
    const filenames = Object.keys(archive.files);
    expect(filenames).toContain("asset-index.json");
    expect(filenames).toContain("creative-layout-receipts.json");
    expect(filenames).toContain("site/index.html");
    expect(filenames).toContain("carousel/slide-05-1080x1350.png");
    expect(
      filenames.every((filename) => !filename.startsWith("/") && !filename.includes("..")),
    ).toBe(true);
    const provenance = JSON.parse(
      await readFile(join(output, "capture-provenance.json"), "utf8"),
    ) as {
      captures: Array<{ declaration: string; sceneIndexes: number[]; sha256: string }>;
    };
    const renderableSceneIndexes = manifest.video.scenes
      .filter((scene) => scene.visual !== "closing")
      .map((scene) => scene.index);
    expect(provenance.captures).toHaveLength(2);
    expect(provenance.captures.every((capture) => capture.declaration === "test-fixture")).toBe(
      true,
    );
    expect(provenance.captures.every((capture) => /^[a-f0-9]{64}$/.test(capture.sha256))).toBe(
      true,
    );
    expect(
      provenance.captures.every(
        (capture) =>
          JSON.stringify(capture.sceneIndexes) === JSON.stringify(renderableSceneIndexes),
      ),
    ).toBe(true);

    const layoutEvidence = JSON.parse(
      await readFile(join(output, "creative-layout-receipts.json"), "utf8"),
    ) as {
      schemaVersion: string;
      assets: Array<{
        filename: string;
        layoutId: string;
        narrativeStage: string | null;
        width: number;
        height: number;
        captureFilenames: string[];
        textBlocks: Array<{
          original: string;
          rendered: string;
          lines: string[];
          fits: boolean;
          truncated: boolean;
          bounds: Bounds;
        }>;
        reservedRegions: Array<{ id: string; bounds: Bounds }>;
      }>;
    };
    expect(layoutEvidence.schemaVersion).toBe("1.0.0");
    expect(layoutEvidence.assets).toHaveLength(9);
    const socialReceipts = layoutEvidence.assets.filter((asset) =>
      asset.filename.startsWith("images/"),
    );
    const carouselReceipts = layoutEvidence.assets.filter((asset) =>
      asset.filename.startsWith("carousel/"),
    );
    expect(new Set(socialReceipts.map((asset) => asset.layoutId)).size).toBe(4);
    expect(carouselReceipts.map((asset) => asset.narrativeStage)).toEqual([
      "hook-problem",
      "capture-flow",
      "extracted-result",
      "export-share-outcome",
      "cta",
    ]);
    expect(layoutEvidence.assets.every((asset) => asset.captureFilenames.length > 0)).toBe(true);
    expect(new Set(carouselReceipts.flatMap((asset) => asset.captureFilenames))).toEqual(
      new Set(["images/product-capture-01.png", "images/product-capture-02.png"]),
    );
    expect(
      layoutEvidence.assets.every((asset) =>
        asset.textBlocks.every(
          (block) =>
            block.fits &&
            !block.truncated &&
            block.lines.join(" ") === block.original &&
            !block.rendered.includes("…"),
        ),
      ),
    ).toBe(true);
    for (const receipt of layoutEvidence.assets) {
      const metadata = await sharp(join(output, receipt.filename)).metadata();
      expect(metadata).toMatchObject({
        width: receipt.width,
        height: receipt.height,
        format: "png",
      });
      for (const [index, block] of receipt.textBlocks.entries()) {
        for (const other of receipt.textBlocks.slice(index + 1)) {
          expect(
            boundsOverlap(block.bounds, other.bounds),
            `${receipt.filename}: ${block.original} overlaps ${other.original}`,
          ).toBe(false);
        }
        for (const region of receipt.reservedRegions) {
          expect(
            boundsOverlap(block.bounds, region.bounds),
            `${receipt.filename}: ${block.original} overlaps ${region.id}`,
          ).toBe(false);
        }
      }
    }
  });

  it("escapes untrusted manifest text in the static microsite", async () => {
    const { snapshot, manifest } = createManifest();
    manifest.productBrief.oneLiner = '<script>alert("no")</script> & ship';
    const output = outputDirectory("escaped-site");
    await renderTestBundle(manifest, snapshot, output);
    const html = await readFile(join(output, "site/index.html"), "utf8");
    expect(html).not.toContain('<script>alert("no")</script>');
    expect(html).toContain("&lt;script&gt;alert(&quot;no&quot;)&lt;/script&gt; &amp; ship");
    expect(html).toContain("Real product UI");
    expect(html).toContain("../images/product-capture-01.png");
  });

  it("refuses to overwrite a non-empty output directory", async () => {
    const { snapshot, manifest } = createManifest();
    const output = outputDirectory("no-overwrite");
    await mkdir(output, { recursive: true });
    await writeFile(join(output, "keep.txt"), "do not overwrite", "utf8");
    await expect(renderTestBundle(manifest, snapshot, output)).rejects.toThrow(
      /Refusing to overwrite non-empty export directory/,
    );
  });

  it("refuses a manifest and snapshot with different provenance", async () => {
    const { snapshot, manifest } = createManifest();
    manifest.source.snapshotId = "snapshot_other";
    await expect(renderTestBundle(manifest, snapshot, outputDirectory("mismatch"))).rejects.toThrow(
      /provenance do not match/,
    );
  });

  it("refuses an internally inconsistent snapshot before rendering assets", async () => {
    const { snapshot, manifest } = createManifest();
    snapshot.evidence[0]!.excerpt = "Tampered evidence";
    await expect(
      renderTestBundle(manifest, snapshot, outputDirectory("tampered-evidence")),
    ).rejects.toThrow(/evidence audit failed/i);
  });

  it("produces stable image hashes for the same manifest", async () => {
    const { snapshot, manifest } = createManifest();
    const first = await renderTestBundle(manifest, snapshot, outputDirectory("deterministic-one"));
    const second = await renderTestBundle(manifest, snapshot, outputDirectory("deterministic-two"));
    const imageHashes = (assets: typeof first.assets) =>
      assets
        .filter((asset) => asset.mediaType === "image/png")
        .map((asset) => [asset.filename, asset.sha256]);
    expect(imageHashes(first.assets)).toEqual(imageHashes(second.assets));
  });

  it("refuses missing, malformed, or excessive product capture sets", async () => {
    const { snapshot, manifest } = createManifest();
    await expect(
      renderCampaignBundle(manifest, snapshot, outputDirectory("missing-captures"), {
        productCaptures: [],
      }),
    ).rejects.toThrow(/2–4 real product UI captures/i);

    const malformedDirectory = outputDirectory("malformed-capture-source");
    await mkdir(malformedDirectory, { recursive: true });
    const malformed = join(malformedDirectory, "not-an-image.png");
    await writeFile(malformed, "not a PNG", "utf8");
    const oneValid = (await fixtureCaptures("malformed"))[0]!;
    await expect(
      renderCampaignBundle(manifest, snapshot, outputDirectory("malformed-capture"), {
        productCaptures: [
          oneValid,
          {
            sourcePath: malformed,
            alt: "Malformed image pretending to be product UI",
            caption: "Malformed product view",
            provenance: "user-supplied",
            declaration: "creator-owned",
          },
        ],
      }),
    ).rejects.toThrow();
  });

  it("requires capture provenance to distinguish real UI from test fixtures", async () => {
    const { snapshot, manifest } = createManifest();
    const captures = await fixtureCaptures("provenance-mismatch");
    captures[0] = {
      ...captures[0]!,
      provenance: "user-supplied",
      declaration: "test-fixture",
    };
    await expect(
      renderCampaignBundle(manifest, snapshot, outputDirectory("provenance-mismatch-output"), {
        productCaptures: captures,
      }),
    ).rejects.toThrow(/only explicit test fixtures/i);
  });

  it("records explicit scene-specific capture coverage for the video renderer", async () => {
    const { snapshot, manifest } = createManifest();
    const sceneIndexes = manifest.video.scenes
      .filter((scene) => scene.visual !== "closing")
      .map((scene) => scene.index);
    const captures = await fixtureCaptures("scene-coverage");
    const splitAt = Math.ceil(sceneIndexes.length / 2);
    captures[0] = { ...captures[0]!, sceneIndexes: sceneIndexes.slice(0, splitAt) };
    captures[1] = { ...captures[1]!, sceneIndexes: sceneIndexes.slice(splitAt) };
    const output = outputDirectory("scene-coverage-output");

    await renderCampaignBundle(manifest, snapshot, output, { productCaptures: captures });

    const provenance = JSON.parse(
      await readFile(join(output, "capture-provenance.json"), "utf8"),
    ) as { captures: Array<{ sceneIndexes: number[] }> };
    expect(provenance.captures.map((capture) => capture.sceneIndexes)).toEqual([
      sceneIndexes.slice(0, splitAt),
      sceneIndexes.slice(splitAt),
    ]);
  });

  it("rejects scene-specific captures that leave a production scene without real UI", async () => {
    const { snapshot, manifest } = createManifest();
    const firstSceneIndex = manifest.video.scenes.find(
      (scene) => scene.visual !== "closing",
    )!.index;
    const captures = (await fixtureCaptures("missing-scene-coverage")).map((capture) => ({
      ...capture,
      sceneIndexes: [firstSceneIndex],
    }));

    await expect(
      renderCampaignBundle(manifest, snapshot, outputDirectory("missing-scene-coverage-output"), {
        productCaptures: captures,
      }),
    ).rejects.toThrow(/scene .* has no documented real product capture/i);
  });
});
