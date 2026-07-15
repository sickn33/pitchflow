import { afterEach, describe, expect, it } from "vitest";

import { assertLocalGenerationEnabled, isPublicViewer } from "./runtime";

const originalPublicViewer = process.env.PITCHFLOW_PUBLIC_VIEWER;
const originalVercel = process.env.VERCEL;

afterEach(() => {
  if (originalPublicViewer === undefined) delete process.env.PITCHFLOW_PUBLIC_VIEWER;
  else process.env.PITCHFLOW_PUBLIC_VIEWER = originalPublicViewer;
  if (originalVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = originalVercel;
});

describe("public viewer safety boundary", () => {
  it("treats Vercel and explicit viewer builds as read-only", () => {
    process.env.PITCHFLOW_PUBLIC_VIEWER = "1";
    expect(isPublicViewer()).toBe(true);
    expect(() => assertLocalGenerationEnabled()).toThrow(/intentionally read-only/i);

    delete process.env.PITCHFLOW_PUBLIC_VIEWER;
    process.env.VERCEL = "1";
    expect(isPublicViewer()).toBe(true);
    expect(() => assertLocalGenerationEnabled()).toThrow(/own Codex account/i);
  });

  it("allows the local workspace boundary", () => {
    delete process.env.PITCHFLOW_PUBLIC_VIEWER;
    delete process.env.VERCEL;
    expect(isPublicViewer()).toBe(false);
    expect(() => assertLocalGenerationEnabled()).not.toThrow();
  });
});
