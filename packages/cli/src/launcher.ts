export type LauncherOptions = {
  help: boolean;
  openBrowser: boolean;
  port: number;
};

export const DEFAULT_PORT = 3210;

export const HELP_TEXT = `PitchFlow local workspace

Usage:
  pnpm pitchflow [open] [--port <number>] [--no-open]

Options:
  --port <number>  Bind the loopback workspace to this port (default: 3210)
  --no-open        Start the workspace without opening a browser
  -h, --help       Show this help

The launcher binds only to 127.0.0.1. Repository analysis and authenticated
Codex/GPT-5.6 generation stay on this machine.`;

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

export function parseLauncherArguments(
  args: readonly string[],
  environment: Readonly<Record<string, string | undefined>> = process.env,
): LauncherOptions {
  let openBrowser = true;
  let port = environment.PITCHFLOW_PORT
    ? parsePort(environment.PITCHFLOW_PORT, "PITCHFLOW_PORT")
    : DEFAULT_PORT;
  let help = false;
  let commandSeen = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "open") {
      if (commandSeen) throw new Error("The open command may only be specified once.");
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
    if (argument === "--help" || argument === "-h") {
      help = true;
      continue;
    }
    throw new Error(`Unknown PitchFlow launcher argument: ${argument ?? ""}`);
  }

  return { help, openBrowser, port };
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
