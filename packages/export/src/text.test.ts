import { describe, expect, it } from "vitest";

import { escapeHtml, fitText } from "./text";

describe("export text safety", () => {
  it("escapes every HTML-significant character", () => {
    expect(escapeHtml(`<a href='x'>& "y"</a>`)).toBe(
      "&lt;a href=&#39;x&#39;&gt;&amp; &quot;y&quot;&lt;/a&gt;",
    );
  });

  it("fits every original word without truncation or an inserted ellipsis", () => {
    const original = "one two three four five six seven eight nine ten";
    const result = fitText(original, {
      maximumWidth: 180,
      maximumHeight: 100,
      maximumFontSize: 30,
      minimumFontSize: 12,
      maximumLines: 4,
    });

    expect(result.fits).toBe(true);
    expect(result.truncated).toBe(false);
    expect(result.lines.join(" ")).toBe(original);
    expect(result.rendered).not.toContain("…");
  });

  it("fails closed when complete text cannot fit", () => {
    expect(() =>
      fitText("unbreakable-supercalifragilisticexpialidocious-token", {
        maximumWidth: 40,
        maximumHeight: 20,
        maximumFontSize: 18,
        minimumFontSize: 16,
        maximumLines: 1,
      }),
    ).toThrow(/without truncation/i);
  });
});
