import { describe, expect, it } from "vitest";

import {
  DOGFOOD_PACKAGE_URL,
  parseDogfoodPackage,
  selectDogfoodGalleryAssets,
  type DogfoodAsset,
} from "./dogfood";

function asset(
  href: string,
  mediaType: string,
  label = href.split("/").at(-1) ?? "Asset",
): DogfoodAsset {
  return { label, href, mediaType, bytes: 42, sha256: "a".repeat(64) };
}

describe("cached dogfood integration", () => {
  it("uses a versioned immutable asset path", () => {
    expect(DOGFOOD_PACKAGE_URL).toBe("/dogfood/pitchflow/v1/judge-package.json");
  });

  it("rejects an absent or placeholder package", () => {
    expect(() => parseDogfoodPackage({})).toThrow(/judge package format/i);
    expect(() =>
      parseDogfoodPackage({ format: "pitchflow-judge-package", version: 1, assets: [] }),
    ).toThrow();
  });

  it("selects only real indexed assets for each judge gallery group", () => {
    const assets = [
      asset("/dogfood/pitchflow/v1/videos/launch-portrait-1080x1920.mp4", "video/mp4"),
      asset("/dogfood/pitchflow/v1/carousel/slide-10.png", "image/png"),
      asset("/dogfood/pitchflow/v1/images/linkedin.png", "image/png", "LinkedIn graphic"),
      asset("/dogfood/pitchflow/v1/site/index.html", "text/html", "Static microsite"),
      asset(
        "/dogfood/pitchflow/v1/images/product-capture-01.png",
        "image/png",
        "Real product UI capture 1",
      ),
      asset("/dogfood/pitchflow/v1/videos/launch-landscape-1920x1080.mp4", "video/mp4"),
      asset("/dogfood/pitchflow/v1/pitchflow-campaign.zip", "application/zip", "Complete ZIP"),
      asset("/dogfood/pitchflow/v1/carousel/slide-2.png", "image/png"),
    ];

    const gallery = selectDogfoodGalleryAssets(assets);

    expect(gallery.landscapeVideo?.href).toContain("landscape");
    expect(gallery.portraitVideo?.href).toContain("portrait");
    expect(gallery.socialGraphics.map(({ label }) => label)).toEqual(["LinkedIn graphic"]);
    expect(gallery.carousel.map(({ href }) => href)).toEqual([
      "/dogfood/pitchflow/v1/carousel/slide-2.png",
      "/dogfood/pitchflow/v1/carousel/slide-10.png",
    ]);
    expect(gallery.productCaptures.map(({ label }) => label)).toEqual([
      "Real product UI capture 1",
    ]);
    expect(gallery.microsite?.mediaType).toBe("text/html");
    expect(gallery.archive?.mediaType).toBe("application/zip");
  });

  it("does not relabel ambiguous videos or turn generated UI into a fallback", () => {
    const ambiguousVideo = asset(
      "/dogfood/pitchflow/v1/videos/launch.mp4",
      "video/mp4",
      "Launch film",
    );
    const plainJson = asset("/dogfood/pitchflow/v1/campaign.json", "application/json", "Campaign");

    const gallery = selectDogfoodGalleryAssets([ambiguousVideo, plainJson]);

    expect(gallery.landscapeVideo).toBeNull();
    expect(gallery.portraitVideo).toBeNull();
    expect(gallery.socialGraphics).toEqual([]);
    expect(gallery.productCaptures).toEqual([]);
    expect(gallery.microsite).toBeNull();
    expect(gallery.archive).toBeNull();
  });
});
