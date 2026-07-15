import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { MAX_CAPTURE_BYTES, type CaptureUpload } from "./capture-contract";
import { captureCliArguments, stageCaptureFiles, validateCaptureUploads } from "./captures";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function png(width = 1280, height = 720): Buffer {
  const bytes = Buffer.alloc(45);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  bytes[24] = 8;
  bytes[25] = 2;
  bytes.writeUInt32BE(0, 33);
  bytes.write("IEND", 37, "ascii");
  return bytes;
}

function jpeg(width = 1280, height = 720): Buffer {
  return Buffer.from([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x10,
    ...new Array<number>(14).fill(0),
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x03,
    0x01,
    0x11,
    0x00,
    0x02,
    0x11,
    0x00,
    0x03,
    0x11,
    0x00,
    0xff,
    0xd9,
  ]);
}

function upload(order: number, overrides: Partial<CaptureUpload> = {}): CaptureUpload {
  const bytes = png();
  return {
    id: `capture_${order + 1}`,
    order,
    fileName: `screen-${order + 1}.png`,
    label: `Product screen ${order + 1}`,
    description: `A documented real product state for screen ${order + 1}.`,
    provenance: "creator-owned",
    mediaType: "image/png",
    dataUrl: `data:image/png;base64,${bytes.toString("base64")}`,
    ...overrides,
  };
}

describe("local product capture validation", () => {
  it("validates, hashes, and stages 2–4 captures with absolute ordered paths", async () => {
    const jpegBytes = jpeg();
    const validated = validateCaptureUploads([
      upload(1, {
        fileName: "screen-2.jpg",
        mediaType: "image/jpeg",
        dataUrl: `data:image/jpeg;base64,${jpegBytes.toString("base64")}`,
      }),
      upload(0),
    ]);
    expect(validated.map((capture) => capture.order)).toEqual([0, 1]);
    expect(validated[0]).toMatchObject({ width: 1280, height: 720, mediaType: "image/png" });
    expect(validated[1]).toMatchObject({ width: 1280, height: 720, mediaType: "image/jpeg" });
    expect(validated[0]?.sha256).toMatch(/^[a-f0-9]{64}$/);

    const directory = await mkdtemp(join(tmpdir(), "pitchflow-web-captures-"));
    temporaryDirectories.push(directory);
    const staged = await stageCaptureFiles(directory, validated);
    expect(staged.paths).toHaveLength(2);
    expect(staged.paths.every(isAbsolute)).toBe(true);
    expect(captureCliArguments(staged.paths)).toEqual([
      "--capture",
      staged.paths[0],
      "--capture",
      staged.paths[1],
    ]);
    expect(() => captureCliArguments(["relative.png", staged.paths[1]!])).toThrow(/absolute/i);
    expect(staged.manifest.captures.map((capture) => capture.provenanceLabel)).toEqual([
      "Creator-owned product UI",
      "Creator-owned product UI",
    ]);
    expect(JSON.parse(await readFile(staged.manifestPath, "utf8"))).not.toHaveProperty(
      "captures.0.dataUrl",
    );
    await expect(readFile(staged.paths[0]!)).resolves.toEqual(png());
  });

  it("rejects malformed base64, MIME/signature mismatches, and truncated binaries", () => {
    expect(() =>
      validateCaptureUploads([
        upload(0, { dataUrl: "data:image/png;base64,****************************====" }),
        upload(1),
      ]),
    ).toThrow(/canonical base64/i);

    expect(() =>
      validateCaptureUploads([
        upload(0, { dataUrl: "data:image/png;base64,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }),
        upload(1),
      ]),
    ).toThrow(/binary signature/i);

    expect(() =>
      validateCaptureUploads([
        upload(0, {
          mediaType: "image/jpeg",
          dataUrl: `data:image/jpeg;base64,${png().toString("base64")}`,
        }),
        upload(1),
      ]),
    ).toThrow(/binary signature/i);

    const truncated = png().subarray(0, 33);
    expect(() =>
      validateCaptureUploads([
        upload(0, { dataUrl: `data:image/png;base64,${truncated.toString("base64")}` }),
        upload(1),
      ]),
    ).toThrow(/valid images/i);
  });

  it("rejects oversize payloads and counts outside the 2–4 production boundary", () => {
    const oversized = Buffer.alloc(MAX_CAPTURE_BYTES + 1).toString("base64");
    expect(() =>
      validateCaptureUploads([
        upload(0, { dataUrl: `data:image/png;base64,${oversized}` }),
        upload(1),
      ]),
    ).toThrow(/at most/i);
    expect(() => validateCaptureUploads([upload(0)])).toThrow();
    expect(() =>
      validateCaptureUploads([upload(0), upload(1), upload(2), upload(3), upload(4)]),
    ).toThrow();
  });

  it("requires unique contiguous ordering and explicit provenance descriptions", () => {
    expect(() => validateCaptureUploads([upload(0), upload(0, { id: "capture_2" })])).toThrow(
      /order/i,
    );
    expect(() =>
      validateCaptureUploads([upload(0, { description: "short" }), upload(1)]),
    ).toThrow();
    expect(() =>
      validateCaptureUploads([upload(0, { provenance: "unknown" as "creator-owned" }), upload(1)]),
    ).toThrow();
  });
});
