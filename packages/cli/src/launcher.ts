export type LauncherOptions = {
  command: "connect" | "open";
  help: boolean;
  openBrowser: boolean;
  port: number;
  publicOrigin: string;
};

export const DEFAULT_PORT = 3210;
export const DEFAULT_PUBLIC_ORIGIN = "https://pitchflow-ten.vercel.app";

export const HELP_TEXT = `PitchFlow local generation companion

Usage:
  pnpm pitchflow connect [--port <number>] [--public-origin <origin>] [--no-open]
  pnpm pitchflow open [options]  Compatibility development command

Options:
  --port <number>           Bind the loopback workspace to this port (default: 3210)
  --public-origin <origin>  Exact hosted origin allowed to pair with this companion
                            (default: https://pitchflow-ten.vercel.app)
  --no-open                 Start without opening the local workspace
  -h, --help                Show this help

Connect builds and starts the production workspace; open starts its development
server. Both bind only to 127.0.0.1. Your Codex authentication and provider
credentials remain on this machine and are never sent to PitchFlow's deployment.
Use --public-origin only for an HTTPS deployment or loopback development origin.`;

function parsePort(value: string | undefined, source: string): number {
  if (!value || !/^\d+$/.test(value)) {
    throw new Error(`${source} must be an integer between 1024 and 65535.`);
  }

  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65_535) {
    throw new Error(`${source} must be an integer between 1024 and 65535.`);
  }
  return port;
}

export function parsePublicOrigin(value: string | undefined, source: string): string {
  if (!value || value.trim() !== value || value.includes(",")) {
    throw new Error(`${source} must be one exact HTTP(S) origin.`);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${source} must be one exact HTTP(S) origin.`);
  }

  const isHttp = url.protocol === "http:";
  const isHttps = url.protocol === "https:";
  const isLoopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  const hasOriginOnly =
    url.origin === value &&
    url.pathname === "/" &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash;

  if ((!isHttps && !(isHttp && isLoopback)) || !hasOriginOnly) {
    throw new Error(
      `${source} must be an exact HTTPS origin or an HTTP loopback development origin.`,
    );
  }

  return url.origin;
}

export function parseLauncherArguments(
  args: readonly string[],
  environment: Readonly<Record<string, string | undefined>> = process.env,
): LauncherOptions {
  let command: LauncherOptions["command"] = "connect";
  let openBrowser = true;
  let port = environment.PITCHFLOW_PORT
    ? parsePort(environment.PITCHFLOW_PORT, "PITCHFLOW_PORT")
    : DEFAULT_PORT;
  let help = false;
  let commandSeen = false;
  let publicOrigin = environment.PITCHFLOW_ALLOWED_ORIGINS
    ? parsePublicOrigin(environment.PITCHFLOW_ALLOWED_ORIGINS, "PITCHFLOW_ALLOWED_ORIGINS")
    : DEFAULT_PUBLIC_ORIGIN;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "connect" || argument === "open") {
      if (commandSeen) throw new Error("Specify only one PitchFlow command.");
      command = argument;
      commandSeen = true;
      continue;
    }
    if (argument === "--no-open") {
      openBrowser = false;
      continue;
    }
    if (argument === "--port") {
      port = parsePort(args[index + 1], "--port");
      index += 1;
      continue;
    }
    if (argument === "--public-origin") {
      publicOrigin = parsePublicOrigin(args[index + 1], "--public-origin");
      index += 1;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      help = true;
      continue;
    }
    throw new Error(`Unknown PitchFlow launcher argument: ${argument ?? ""}`);
  }

  return { command, help, openBrowser, port, publicOrigin };
}

export function buildWorkspaceEnvironment(
  options: Pick<LauncherOptions, "command" | "port" | "publicOrigin">,
  repositoryRoot: string,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): NodeJS.ProcessEnv {
  const nodeEnvironment = options.command === "connect" ? "production" : "development";
  const allowedKeys = [
    "CODEX_HOME",
    "GITHUB_TOKEN",
    "HOME",
    "LANG",
    "LC_ALL",
    "LOGNAME",
    "PATH",
    "SHELL",
    "TEMP",
    "TERM",
    "TMP",
    "TMPDIR",
    "USER",
    "XDG_CONFIG_HOME",
  ] as const;
  const allowedEnvironment = Object.fromEntries(
    allowedKeys.flatMap((key) => {
      const value = environment[key];
      return value === undefined ? [] : [[key, value]];
    }),
  );

  return {
    ...allowedEnvironment,
    NODE_ENV: nodeEnvironment,
    PITCHFLOW_ALLOWED_ORIGINS: options.publicOrigin,
    PITCHFLOW_CODEX_CLI_PATH: `${repositoryRoot}/packages/codex/node_modules/@openai/codex/bin/codex.js`,
    PITCHFLOW_PORT: String(options.port),
    PITCHFLOW_PUBLIC_VIEWER: "0",
    PITCHFLOW_REPOSITORY_ROOT: repositoryRoot,
  };
}

export const WORKSPACE_BUILD_PROCESS = {
  command: "pnpm",
  args: ["--filter", "@pitchflow/web", "build"],
} as const;

export function workspaceProcess(command: LauncherOptions["command"]): {
  command: "pnpm";
  args: readonly string[];
} {
  return {
    command: "pnpm",
    args: ["--filter", "@pitchflow/web", command === "connect" ? "start" : "dev"],
  };
}

export function launcherMessages(url: string): readonly string[] {
  return [
    `Starting PitchFlow local generation companion at ${url}`,
    "Codex authentication and provider credentials remain on this machine.",
  ];
}

export type ReadyProbe = (url: string) => Promise<boolean>;

export async function defaultReadyProbe(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/api/status`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) return false;
    const body: unknown = await response.json();
    return (
      typeof body === "object" &&
      body !== null &&
      "mode" in body &&
      body.mode === "local" &&
      "generationEnabled" in body
    );
  } catch {
    return false;
  }
}

export async function waitForWorkspace(
  url: string,
  options: {
    probe?: ReadyProbe;
    timeoutMs?: number;
    intervalMs?: number;
    sleep?: (milliseconds: number) => Promise<void>;
    signal?: AbortSignal;
  } = {},
): Promise<void> {
  const probe = options.probe ?? defaultReadyProbe;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const intervalMs = options.intervalMs ?? 250;
  const sleep =
    options.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, milliseconds);
      }));
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (options.signal?.aborted) throw options.signal.reason;
    if (await probe(url)) return;
    await sleep(intervalMs);
  }

  throw new Error(`PitchFlow did not become ready at ${url} within ${timeoutMs} ms.`);
}
