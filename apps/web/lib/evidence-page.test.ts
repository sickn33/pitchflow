import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  fileURLToPath(new URL("../app/evidence/page.tsx", import.meta.url)),
  "utf8",
);

describe("guided Evidence page contract", () => {
  it("leads with purpose, summary, and a short judge path", () => {
    expect(pageSource).toContain(
      "This page shows what is real, how Codex/GPT-5.6 was used, and how the outputs were",
    );
    expect(pageSource).toContain("3-minute judge path");
    expect(pageSource).toContain("Verify the product without reading the whole ledger.");
    expect(pageSource.match(/seconds<\/span>/g)).toHaveLength(3);
  });

  it("has exactly four human proof sections with a why-this-matters explanation", () => {
    for (const title of [
      "Product proof",
      "Codex &amp; GPT‑5.6",
      "Trust &amp; provenance",
      "Verification",
    ]) {
      expect(pageSource).toContain(title);
    }
    expect(pageSource.match(/className="evidence-section"/g)).toHaveLength(4);
    expect(pageSource.match(/<WhyItMatters>/g)).toHaveLength(4);
    expect(pageSource).toContain("Why this matters");
  });

  it("keeps complete raw receipts collapsed instead of rendering the old giant inventory", () => {
    expect(pageSource).toContain("Raw evidence");
    expect(pageSource.match(/<details(?:\s|>)/g)).toHaveLength(4);
    expect(pageSource).not.toMatch(/<details[^>]*\sopen(?:=|\s|>)/);
    expect(pageSource).toContain("evidence.snapshot.evidence.map");
    expect(pageSource).toContain("evidence.assets.map");
    expect(pageSource).not.toContain("<PublicViewer");
    expect(pageSource).not.toContain('className="evidence-card"');
  });
});
