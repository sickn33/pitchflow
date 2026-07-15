const SECRET_PATTERNS: ReadonlyArray<RegExp> = [
  /\bgh[opsu]_[A-Za-z0-9]{20,}\b/g,
  /\bglpat-[A-Za-z0-9_-]{20,}\b/g,
  /\bnpm_[A-Za-z0-9]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@[^\s]+/gi,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|connection[_-]?string|database[_-]?url|private[_-]?key|refresh[_-]?token|secret[_-]?key|session[_-]?secret|password|passwd)\s*[:=]\s*["']?[^\s"']{8,}/gi,
];

export function redactPotentialSecrets(input: string): string {
  return SECRET_PATTERNS.reduce(
    (redacted, pattern) => redacted.replace(pattern, "[REDACTED_POTENTIAL_SECRET]"),
    input,
  );
}

export function containsBinaryData(input: string): boolean {
  if (input.includes("\0")) return true;
  if (input.length === 0) return false;
  let suspicious = 0;
  for (const character of input) {
    const code = character.codePointAt(0) ?? 0;
    if (
      character === "�" ||
      (code < 32 && character !== "\n" && character !== "\r" && character !== "\t")
    ) {
      suspicious += 1;
    }
  }
  return suspicious >= 3 && suspicious / input.length > 0.01;
}

export function safeExcerpt(input: string, maximum = 1600): string {
  const redacted = redactPotentialSecrets(input)
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (redacted.length <= maximum) return redacted;
  return `${redacted.slice(0, Math.max(1, maximum - 1)).trimEnd()}…`;
}

export function assertSafeArchivePath(path: string): void {
  if (
    !path ||
    path.startsWith("/") ||
    path.startsWith("\\") ||
    path.includes("\0") ||
    path.split(/[\\/]/).some((segment) => segment === "..")
  ) {
    throw new Error(`Unsafe archive path: ${JSON.stringify(path)}`);
  }
}
