import { afterEach, describe, expect, it } from "vitest";

import { POST, maxDuration } from "./route";

const originalViewer = process.env.PITCHFLOW_PUBLIC_VIEWER;
const originalVercel = process.env.VERCEL;

afterEach(() => {
  if (originalViewer === undefined) delete process.env.PITCHFLOW_PUBLIC_VIEWER;
  else process.env.PITCHFLOW_PUBLIC_VIEWER = originalViewer;
  if (originalVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = originalVercel;
});

function request(origin: string): Request {
  return new Request("http://127.0.0.1:3210/api/export", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: "{}",
  });
}

describe("capture export route boundary", () => {
  it("stays within Vercel's Hobby serverless duration ceiling", () => {
    expect(maxDuration).toBeLessThanOrEqual(300);
  });

  it("rejects public-viewer export before reading or staging attachments", async () => {
    process.env.PITCHFLOW_PUBLIC_VIEWER = "1";
    const response = await POST(request("http://127.0.0.1:3210"));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PUBLIC_VIEWER_READ_ONLY" },
    });
  });

  it("rejects cross-origin local export before parsing attachments", async () => {
    delete process.env.PITCHFLOW_PUBLIC_VIEWER;
    delete process.env.VERCEL;
    const response = await POST(request("https://attacker.example"));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "LOCAL_REQUEST_ORIGIN_REJECTED" },
    });
  });
});
