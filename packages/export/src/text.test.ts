import { describe, expect, it } from "vitest";

import { escapeHtml, wrapText } from "./text";

describe("export text safety", () => {
  it("escapes every HTML-significant character", () => {
    expect(escapeHtml(`<a href='x'>& "y"</a>`)).toBe(
      "&lt;a href=&#39;x&#39;&gt;&amp; &quot;y&quot;&lt;/a&gt;",
    );
  });

  it("wraps and truncates long display text deterministically", () => {
    const lines = wrapText("one two three four five six seven eight nine ten", 10, 3);
    expect(lines).toHaveLength(3);
    expect(lines.at(-1)).toMatch(/…$/);
    expect(lines.every((line) => line.length <= 12)).toBe(true);
  });
});
