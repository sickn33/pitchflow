export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

export function escapeXml(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, " ");
}

export function wrapText(value: string, maximumCharacters: number, maximumLines = 4): string[] {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maximumCharacters || !line) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maximumLines - 1) break;
  }
  if (line && lines.length < maximumLines) lines.push(line);

  const consumed = lines.join(" ").split(/\s+/).length;
  if (consumed < words.length && lines.length > 0) {
    const last = lines.at(-1) ?? "";
    lines[lines.length - 1] = `${last.replace(/[.,;:!?]?$/, "")}…`;
  }
  return lines;
}
