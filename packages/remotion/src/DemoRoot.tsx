import { Composition } from "remotion";

import { BuildWeekDemoComposition } from "./DemoComposition";
import {
  BUILD_WEEK_DEMO_COMPOSITION_ID,
  BUILD_WEEK_DEMO_DURATION_FRAMES,
  BUILD_WEEK_DEMO_FPS,
  BUILD_WEEK_DEMO_HEIGHT,
  BUILD_WEEK_DEMO_WIDTH,
  DEMO_ASSET_KEYS,
  DEMO_SOURCE_PATHS,
  type BuildWeekDemoProps,
} from "./demo-contracts";
import { validateDemoTimeline } from "./demo-timeline";

const assets = Object.fromEntries(
  DEMO_ASSET_KEYS.map((key) => [
    key,
    { publicPath: DEMO_SOURCE_PATHS[key], sha256: "0".repeat(64), bytes: 1 },
  ]),
) as BuildWeekDemoProps["assets"];

export function BuildWeekDemoRoot() {
  validateDemoTimeline();
  return (
    <Composition
      id={BUILD_WEEK_DEMO_COMPOSITION_ID}
      component={BuildWeekDemoComposition}
      defaultProps={{ assets }}
      width={BUILD_WEEK_DEMO_WIDTH}
      height={BUILD_WEEK_DEMO_HEIGHT}
      fps={BUILD_WEEK_DEMO_FPS}
      durationInFrames={BUILD_WEEK_DEMO_DURATION_FRAMES}
    />
  );
}
