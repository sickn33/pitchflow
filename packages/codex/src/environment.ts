const CODEX_ENVIRONMENT_ALLOWLIST = [
  "CODEX_HOME",
  "HOME",
  "LANG",
  "LC_ALL",
  "LOGNAME",
  "NODE_ENV",
  "PATH",
  "PITCHFLOW_CODEX_CLI_PATH",
  "SHELL",
  "TEMP",
  "TERM",
  "TMP",
  "TMPDIR",
  "USER",
  "XDG_CONFIG_HOME",
] as const;

export function buildCodexEnvironment(
  source: Readonly<Record<string, string | undefined>> = process.env,
): Record<string, string> & { NODE_ENV: "development" | "test" | "production" } {
  const allowed: Record<string, string> = Object.fromEntries(
    CODEX_ENVIRONMENT_ALLOWLIST.flatMap((key) => {
      const value = source[key];
      return value === undefined ? [] : [[key, value]];
    }),
  );
  return {
    ...allowed,
    NODE_ENV:
      source.NODE_ENV === "development" ||
      source.NODE_ENV === "test" ||
      source.NODE_ENV === "production"
        ? source.NODE_ENV
        : "production",
  };
}
