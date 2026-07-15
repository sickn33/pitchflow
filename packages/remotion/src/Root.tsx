import { Composition } from "remotion";

import { PitchFlowComposition } from "./PitchFlowComposition";
import { PITCHFLOW_COMPOSITION_ID, type PitchFlowCompositionProps } from "./contracts";
import { DEFAULT_CAMPAIGN_MANIFEST } from "./fixture";
import { getLayoutDimensions, validateVideoTimeline } from "./timeline";

export function PitchFlowRoot() {
  const defaultProps: PitchFlowCompositionProps = {
    manifest: DEFAULT_CAMPAIGN_MANIFEST,
    layout: "landscape",
    captures: [],
  };

  return (
    <Composition
      id={PITCHFLOW_COMPOSITION_ID}
      component={PitchFlowComposition}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => {
        const manifest = validateVideoTimeline(props.manifest);
        const dimensions = getLayoutDimensions(props.layout);
        return {
          ...dimensions,
          fps: manifest.video.fps,
          durationInFrames: manifest.video.durationSeconds * manifest.video.fps,
          props: { manifest, layout: props.layout, captures: props.captures },
          defaultCodec: "h264",
          defaultPixelFormat: "yuv420p",
        };
      }}
    />
  );
}
