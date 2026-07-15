import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { verifySubmission } from "./submission-contract";

describe("submission completeness contract", () => {
  it("fails closed when required evidence is absent", async () => {
    const root = await mkdtemp(join(tmpdir(), "pitchflow-submission-empty-"));
    const result = await verifySubmission(root, { allowGates: true });
    expect(result.status).toBe("failed");
    expect(result.errors.length).toBeGreaterThan(5);
  });

  it("rejects a status path that escapes the repository", async () => {
    const root = await mkdtemp(join(tmpdir(), "pitchflow-submission-path-"));
    await mkdir(join(root, "submission"), { recursive: true });
    await writeFile(
      join(root, "submission/status.json"),
      JSON.stringify({
        format: "pitchflow-submission-status",
        version: 1,
        category: "Developer Tools",
        language: "English",
        repositoryUrl: "https://github.com/sickn33/pitchflow",
        publicViewerUrl: "https://pitchflow-ten.vercel.app",
        demo: { path: "../outside.mp4", reportPath: "../outside.json" },
        feedback: {},
        devpost: {},
      }),
    );
    const result = await verifySubmission(root, { allowGates: true });
    expect(result.status).toBe("failed");
    expect(result.errors.join("\n")).toMatch(/escapes the repository|outside\.json/u);
  });
});
