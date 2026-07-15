# PitchFlow capture contract

PitchFlow motion masters accept only documented local raster captures. Remote URLs, SVG, WebP, executable HTML, video embeds, and implicit downloads are not supported.

The parent-facing path accepts 2–4 ordered local PNG/JPEG paths and applies the capture sequence to each non-closing scene:

```ts
await renderCampaignVideo({
  manifest,
  layout: "landscape",
  outputPath: "./artifacts/campaign-landscape.mp4",
  capturePaths: ["/absolute/path/overview.png", "/absolute/path/evidence.jpg"],
});
```

For scene-specific sequences and descriptive alt text, pass detailed `captures` instead:

```ts
await renderCampaignVideo({
  manifest,
  layout: "landscape",
  outputPath: "./artifacts/campaign-landscape.mp4",
  captures: [
    {
      id: "workspace_overview",
      sceneIndex: 1,
      order: 0,
      alt: "PitchFlow workspace showing the analyzed repository and campaign status",
      source: { kind: "file", path: "/absolute/path/to/owned-capture.png" },
    },
  ],
});
```

Each non-closing scene requires at least one capture. Multiple captures form a sequence ordered by the integer `order` field. Orders must be unique within a scene and range from 0 through 9.

Input requirements:

- `id`: unique, 3–80 lowercase letters, digits, underscores, or hyphens.
- `sceneIndex`: an existing manifest scene.
- `order`: sequence position from 0 through 9.
- `alt`: truthful description, 3–180 characters.
- `source`: either an absolute/local file path or a base64 data URL.
- Media: PNG or JPEG only, with content-signature and raster-dimension verification.
- Size: at most 12 MiB per capture and 32 scene-mapped captures per render.

Pass either `capturePaths` or `captures`, never both. The renderer copies validated bytes into a temporary private Remotion public directory. The directory is deleted after rendering. Render metadata retains the capture ID, scene, sequence order, alt text, source kind, media type, dimensions, byte count, and SHA-256 hash; it does not retain local file paths or data URLs.

`createTestFixtureCaptures()` and files under `artifacts/smoke` are verifier fixtures, explicitly labeled “NOT A PRODUCT CAPTURE.” They must never be used in a public or final master. Final captures must be supplied by the parent workflow from owned, documented PitchFlow UI capture sessions.

Encoding defaults are deterministic software H.264 High/yuv420p with one encoder worker. Full-resolution landscape targets 10 Mbps; full-resolution portrait targets 12 Mbps. Quarter-scale verifier renders target 2 Mbps.
