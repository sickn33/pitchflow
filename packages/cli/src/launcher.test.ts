import { describe, expect, it, vi } from "vitest";

import { DEFAULT_PORT, parseLauncherArguments, waitForWorkspace } from "./launcher";

describe("parseLauncherArguments", () => {
  it("supports the one-command default and documented open alias", () => {
    expect(parseLauncherArguments([], {})).toEqual({
      help: false,
      openBrowser: true,
      port: DEFAULT_PORT,
    });
    expect(parseLauncherArguments(["open", "--no-open", "--port", "4321"], {})).toEqual({
      help: false,
      openBrowser: false,
      port: 4321,
    });
  });

  it("uses a valid environment port and rejects unsafe or ambiguous input", () => {
    expect(parseLauncherArguments([], { PITCHFLOW_PORT: "4567" }).port).toBe(4567);
    expect(() => parseLauncherArguments(["--port", "80"], {})).toThrow(/1024/);
    expect(() => parseLauncherArguments(["--port", "3210x"], {})).toThrow(/integer/);
    expect(() => parseLauncherArguments(["serve"], {})).toThrow(/unknown/i);
    expect(() => parseLauncherArguments(["open", "open"], {})).toThrow(/only/i);
  });
});

describe("waitForWorkspace", () => {
  it("waits until the loopback workspace reports ready", async () => {
    const probe = vi
      .fn<(url: string) => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const sleep = vi.fn<(milliseconds: number) => Promise<void>>().mockResolvedValue();

    await waitForWorkspace("http://127.0.0.1:3210", {
      probe,
      timeoutMs: 1_000,
      intervalMs: 1,
      sleep,
    });

    expect(probe).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("fails clearly when readiness never arrives", async () => {
    let now = 0;
    const dateSpy = vi.spyOn(Date, "now").mockImplementation(() => {
      now += 10;
      return now;
    });
    try {
      await expect(
        waitForWorkspace("http://127.0.0.1:3210", {
          probe: async () => false,
          timeoutMs: 15,
          intervalMs: 1,
          sleep: async () => undefined,
        }),
      ).rejects.toThrow(/did not become ready/i);
    } finally {
      dateSpy.mockRestore();
    }
  });
});
