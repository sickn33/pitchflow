import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import {
  DEMO_ASSET_KEYS,
  DEMO_SOURCE_PATHS,
  type BuildWeekDemoProps,
  type DemoAssetKey,
} from "./demo-contracts";
import { PitchFlowRenderError } from "./render-error";

export async function stageDemoAssets(
  repositoryRoot: string,
  publicDirectory: string,
): Promise<{
  props: BuildWeekDemoProps;
  inputs: Record<DemoAssetKey, { relativePath: string; bytes: number; sha256: string }>;
}> {
  const stageDirectory = join(publicDirectory, "build-week-demo");
  await mkdir(stageDirectory, { recursive: true });
  const props = {} as BuildWeekDemoProps["assets"];
  const inputs = {} as Record<
    DemoAssetKey,
    { relativePath: string; bytes: number; sha256: string }
  >;

  for (const key of DEMO_ASSET_KEYS) {
    const relativePath = DEMO_SOURCE_PATHS[key];
    const sourcePath = resolve(repositoryRoot, relativePath);
    let sourceStat;
    try {
      sourceStat = await stat(sourcePath);
    } catch (error) {
      throw new PitchFlowRenderError(
        "capture",
        `Required creator-owned demo asset is missing: ${relativePath}.`,
        error,
      );
    }
    if (!sourceStat.isFile() || sourceStat.size === 0) {
      throw new PitchFlowRenderError(
        "capture",
        `Required demo asset is not a non-empty regular file: ${relativePath}.`,
      );
    }
    const bytes = await readFile(sourcePath);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const filename = `${key}-${sha256.slice(0, 16)}-${basename(relativePath)}`;
    await copyFile(sourcePath, join(stageDirectory, filename));
    props[key] = {
      publicPath: `build-week-demo/${filename}`,
      sha256,
      bytes: sourceStat.size,
    };
    inputs[key] = { relativePath, bytes: sourceStat.size, sha256 };
  }
  return { props: { assets: props }, inputs };
}
