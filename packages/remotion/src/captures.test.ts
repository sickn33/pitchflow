import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createCaptureInputsFromPaths, prepareCaptures } from "./captures";
import {
  createTestFixtureCaptures,
  DEFAULT_CAMPAIGN_MANIFEST,
  TEST_FIXTURE_CAPTURE_DATA_URL,
} from "./fixture";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "pitchflow-capture-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("capture preparation", () => {
  it("maps 2–4 ordered local paths into every non-closing scene", () => {
    const inputs = createCaptureInputsFromPaths(
      ["/tmp/overview.png", "/tmp/evidence.jpg"],
      DEFAULT_CAMPAIGN_MANIFEST,
    );

    expect(inputs).toHaveLength(10);
    expect(inputs.filter((input) => input.sceneIndex === 1).map((input) => input.order)).toEqual([
      0, 1,
    ]);
    expect(() =>
      createCaptureInputsFromPaths(["/tmp/only.png"], DEFAULT_CAMPAIGN_MANIFEST),
    ).toThrow("2–4 local PNG or JPEG");
  });

  it("copies validated captures into a private public directory and records hashes", async () => {
    const directory = await temporaryDirectory();
    const result = await prepareCaptures(
      createTestFixtureCaptures(),
      directory,
      DEFAULT_CAMPAIGN_MANIFEST,
    );

    expect(result.captures).toHaveLength(5);
    expect(result.receipts).toHaveLength(5);
    expect(result.receipts[0]).toMatchObject({
      sourceKind: "data-url",
      mediaType: "image/png",
      sceneIndex: 1,
      order: 0,
      width: 1,
      height: 1,
    });
    const copied = await readFile(join(directory, result.captures[0]!.publicPath));
    expect(copied.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(result.captures[0]!.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("accepts a local raster file and records file provenance without retaining its path", async () => {
    const directory = await temporaryDirectory();
    const sourcePath = join(directory, "owned-test-capture.png");
    const png = Buffer.from(TEST_FIXTURE_CAPTURE_DATA_URL.split(",")[1]!, "base64");
    await writeFile(sourcePath, png);
    const inputs = createTestFixtureCaptures();
    inputs[0] = {
      ...inputs[0]!,
      source: { kind: "file", path: sourcePath },
    };

    const result = await prepareCaptures(
      inputs,
      join(directory, "public"),
      DEFAULT_CAMPAIGN_MANIFEST,
    );

    expect(result.receipts[0]!.sourceKind).toBe("file");
    expect(JSON.stringify(result.receipts)).not.toContain(sourcePath);
  });

  it("rejects missing capture coverage for a substantive scene", async () => {
    const directory = await temporaryDirectory();
    const incomplete = createTestFixtureCaptures().filter((capture) => capture.sceneIndex !== 3);

    await expect(
      prepareCaptures(incomplete, directory, DEFAULT_CAMPAIGN_MANIFEST),
    ).rejects.toMatchObject({ stage: "capture" });
  });

  it("rejects a media declaration that does not match the raster bytes", async () => {
    const directory = await temporaryDirectory();
    const mismatched = createTestFixtureCaptures();
    mismatched[0] = {
      ...mismatched[0]!,
      source: {
        kind: "data-url",
        dataUrl: TEST_FIXTURE_CAPTURE_DATA_URL.replace("image/png", "image/jpeg"),
      },
    };

    await expect(
      prepareCaptures(mismatched, directory, DEFAULT_CAMPAIGN_MANIFEST),
    ).rejects.toMatchObject({ stage: "capture" });
  });
});
