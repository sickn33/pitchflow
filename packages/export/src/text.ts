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

export type FittedText = {
  original: string;
  rendered: string;
  lines: string[];
  fontSize: number;
  lineHeight: number;
  fits: true;
  truncated: false;
};

export type FitTextOptions = {
  maximumWidth: number;
  maximumHeight: number;
  maximumFontSize: number;
  minimumFontSize: number;
  lineHeightRatio?: number;
  maximumLines?: number;
};

function glyphWidth(character: string): number {
  if (/\s/.test(character)) return 0.3;
  if (/[ilI1|.,'`:;]/.test(character)) return 0.28;
  if (/[MWmw@%&]/.test(character)) return 0.88;
  if (/[A-Z0-9]/.test(character)) return 0.64;
  return 0.54;
}

function estimatedWidth(value: string, fontSize: number): number {
  return [...value].reduce((total, character) => total + glyphWidth(character) * fontSize, 0);
}

function wrapAtWidth(value: string, maximumWidth: number, fontSize: number): string[] | null {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    if (estimatedWidth(word, fontSize) > maximumWidth) return null;
    const candidate = line ? `${line} ${word}` : word;
    if (estimatedWidth(candidate, fontSize) <= maximumWidth) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Fits every word into a deterministic box. Unlike the former wrapper, this
 * function never drops words or appends an ellipsis: an impossible layout is a
 * render error instead of a misleading creative.
 */
export function fitText(value: string, options: FitTextOptions): FittedText {
  const original = value.trim().replace(/\s+/g, " ");
  if (!original) throw new Error("Creative text must not be empty.");
  const lineHeightRatio = options.lineHeightRatio ?? 1.08;
  const maximumLines = options.maximumLines ?? Number.POSITIVE_INFINITY;

  for (
    let fontSize = Math.floor(options.maximumFontSize);
    fontSize >= Math.ceil(options.minimumFontSize);
    fontSize -= 1
  ) {
    const lines = wrapAtWidth(original, options.maximumWidth, fontSize);
    if (!lines) continue;
    const lineHeight = Math.ceil(fontSize * lineHeightRatio);
    if (lines.length <= maximumLines && lines.length * lineHeight <= options.maximumHeight) {
      return {
        original,
        rendered: lines.join("\n"),
        lines,
        fontSize,
        lineHeight,
        fits: true,
        truncated: false,
      };
    }
  }

  throw new Error(
    `Creative text does not fit its ${options.maximumWidth}x${options.maximumHeight} box without truncation.`,
  );
}
