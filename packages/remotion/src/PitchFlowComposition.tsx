import type { CSSProperties } from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { CampaignManifest } from "@pitchflow/core";

import type { PitchFlowCompositionProps, PreparedCapture, VideoLayout } from "./contracts";
import { getEvidenceLabel, getSafeZone } from "./timeline";

const SYSTEM_SANS =
  "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const SYSTEM_SERIF = "Iowan Old Style, Charter, Georgia, serif";

type Scene = CampaignManifest["video"]["scenes"][number];
type SceneVisual = Scene["visual"];

export type CaptureMotionPlan = {
  focusX: number;
  focusY: number;
  startScale: number;
  endScale: number;
  highlightLeft: number;
  highlightTop: number;
  highlightWidth: number;
  highlightHeight: number;
  featureLabel: string;
};

const CAPTURE_MOTION_PLANS: Record<SceneVisual, CaptureMotionPlan> = {
  opening: {
    focusX: 50,
    focusY: 46,
    startScale: 1.04,
    endScale: 1.14,
    highlightLeft: 9,
    highlightTop: 12,
    highlightWidth: 82,
    highlightHeight: 72,
    featureLabel: "See the product",
  },
  repository: {
    focusX: 24,
    focusY: 22,
    startScale: 1.08,
    endScale: 1.25,
    highlightLeft: 6,
    highlightTop: 8,
    highlightWidth: 54,
    highlightHeight: 33,
    featureLabel: "Start from source",
  },
  evidence: {
    focusX: 73,
    focusY: 40,
    startScale: 1.1,
    endScale: 1.28,
    highlightLeft: 52,
    highlightTop: 19,
    highlightWidth: 41,
    highlightHeight: 43,
    featureLabel: "Show the proof",
  },
  workspace: {
    focusX: 49,
    focusY: 55,
    startScale: 1.07,
    endScale: 1.22,
    highlightLeft: 22,
    highlightTop: 27,
    highlightWidth: 58,
    highlightHeight: 54,
    featureLabel: "Follow the workflow",
  },
  exports: {
    focusX: 77,
    focusY: 72,
    startScale: 1.09,
    endScale: 1.27,
    highlightLeft: 54,
    highlightTop: 53,
    highlightWidth: 39,
    highlightHeight: 35,
    featureLabel: "Ready to share",
  },
  closing: {
    focusX: 50,
    focusY: 50,
    startScale: 1.02,
    endScale: 1.08,
    highlightLeft: 12,
    highlightTop: 12,
    highlightWidth: 76,
    highlightHeight: 76,
    featureLabel: "Explore the product",
  },
};

export function getCaptureMotionPlan(visual: SceneVisual, layout: VideoLayout): CaptureMotionPlan {
  const plan = CAPTURE_MOTION_PLANS[visual];
  if (layout === "landscape") return plan;

  // Portrait is intentionally tighter: a social-native crop keeps the active UI region legible.
  return {
    ...plan,
    startScale: plan.startScale + 0.12,
    endScale: plan.endScale + 0.16,
    highlightLeft: Math.max(5, plan.highlightLeft - 4),
    highlightWidth: Math.min(90, plan.highlightWidth + 8),
  };
}

export function selectSceneCaptures(captures: PreparedCapture[], scene: Scene): PreparedCapture[] {
  const direct = captures.filter((capture) => capture.sceneIndex === scene.index);
  if (scene.visual !== "closing") return direct;

  // Closing scenes do not require dedicated capture inputs. Reuse the latest unique product
  // captures so the CTA lands on the real product rather than an abstract end card.
  return [...captures]
    .reverse()
    .filter(
      (capture, index, reversed) =>
        reversed.findIndex((candidate) => candidate.sha256 === capture.sha256) === index,
    )
    .slice(0, 2)
    .reverse();
}

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

function MotionField({ manifest, layout }: { manifest: CampaignManifest; layout: VideoLayout }) {
  const frame = useCurrentFrame();
  const offset = frame * (layout === "portrait" ? 1.4 : 2.1);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          width: layout === "portrait" ? 1250 : 1500,
          height: layout === "portrait" ? 1250 : 1500,
          borderRadius: "50%",
          left: layout === "portrait" ? -650 : -500,
          top: layout === "portrait" ? 560 : -780,
          background: `radial-gradient(circle, ${manifest.design.accent}2F 0%, transparent 68%)`,
          transform: `translate(${Math.sin(frame / 48) * 32}px, ${Math.cos(frame / 57) * 28}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: -240,
          opacity: 0.11,
          backgroundImage: `linear-gradient(${manifest.design.muted}55 1px, transparent 1px), linear-gradient(90deg, ${manifest.design.muted}55 1px, transparent 1px)`,
          backgroundSize: layout === "portrait" ? "72px 72px" : "84px 84px",
          transform: `translate(${-offset % 84}px, ${-offset % 84}px) rotate(-3deg)`,
        }}
      />
    </AbsoluteFill>
  );
}

function KineticTitle({
  title,
  manifest,
  layout,
  opening,
}: {
  title: string;
  manifest: CampaignManifest;
  layout: VideoLayout;
  opening: boolean;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = title.split(/\s+/);
  const fontSize = layout === "portrait" ? (opening ? 126 : 104) : opening ? 118 : 90;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        columnGap: layout === "portrait" ? 24 : 20,
        rowGap: 0,
        maxWidth: layout === "portrait" ? 930 : 720,
        fontSize,
        lineHeight: 0.88,
        letterSpacing: -0.055 * fontSize,
        fontWeight: 790,
        textWrap: "balance",
      }}
    >
      {words.map((word, index) => {
        const progress = spring({
          frame: frame - index * (opening ? 4 : 3),
          fps,
          durationInFrames: opening ? 22 : 28,
          config: { damping: 16, stiffness: 160, mass: 0.75 },
        });
        return (
          <span
            key={`${word}-${index}`}
            style={{
              display: "inline-block",
              opacity: progress,
              transform: `translateY(${(1 - progress) * 74}px) skewY(${(1 - progress) * 5}deg)`,
              color: index === words.length - 1 && opening ? manifest.design.accent : undefined,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

function CaptureSequence({
  captures,
  manifest,
  layout,
  durationInFrames,
  visual,
}: {
  captures: PreparedCapture[];
  manifest: CampaignManifest;
  layout: VideoLayout;
  durationInFrames: number;
  visual: SceneVisual;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const motion = getCaptureMotionPlan(visual, layout);
  const isOpening = visual === "opening";
  const enter = spring({
    frame: frame - (isOpening ? 0 : 5),
    fps,
    durationInFrames: isOpening ? 18 : 25,
    config: { damping: 16, stiffness: isOpening ? 210 : 155, mass: 0.75 },
  });
  const slot = durationInFrames / Math.max(1, captures.length);
  const emphasis = spring({
    frame: frame - (isOpening ? 11 : 24),
    fps,
    durationInFrames: 24,
    config: { damping: 18, stiffness: 175, mass: 0.7 },
  });
  const scan = interpolate(frame % 60, [0, 59], [0, 100], clamp);
  const frameStyle: CSSProperties =
    layout === "portrait"
      ? { width: 936, height: 940, borderRadius: 34 }
      : { width: 1100, height: 800, borderRadius: 28 };

  return (
    <div
      style={{
        ...frameStyle,
        position: "relative",
        overflow: "hidden",
        background: manifest.design.surface,
        border: `2px solid ${manifest.design.muted}55`,
        boxShadow: "0 44px 120px rgba(0,0,0,0.48)",
        transform: `translateY(${(1 - enter) * (isOpening ? 150 : 90)}px) scale(${0.84 + enter * 0.16}) rotate(${(1 - enter) * (layout === "portrait" ? -2.4 : 1.2)}deg)`,
        opacity: enter,
      }}
      data-capture-led={visual}
      data-capture-count={captures.length}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: layout === "portrait" ? 38 : 34,
          zIndex: 8,
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "0 16px",
          background: `${manifest.design.background}F2`,
          borderBottom: `1px solid ${manifest.design.muted}44`,
        }}
      >
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: dot === 0 ? manifest.design.accent : manifest.design.muted,
              opacity: dot === 0 ? 0.9 : 0.45,
            }}
          />
        ))}
      </div>
      {captures.map((capture, index) => {
        const start = index * slot;
        const end = (index + 1) * slot;
        const fadeIn = index === 0 ? 1 : interpolate(frame, [start, start + 10], [0, 1], clamp);
        const fadeOut =
          index === captures.length - 1 ? 1 : interpolate(frame, [end - 10, end], [1, 0], clamp);
        const localProgress = interpolate(frame, [start, end], [0, 1], clamp);
        const direction = index % 2 === 0 ? 1 : -1;
        const imageScale = interpolate(
          localProgress,
          [0, 1],
          [motion.startScale, motion.endScale],
          clamp,
        );
        const panX = direction * interpolate(localProgress, [0, 1], [-1.4, 1.4], clamp);
        const panY = interpolate(localProgress, [0, 1], [1.1, -1.1], clamp);
        return (
          <div
            key={capture.id}
            style={{
              position: "absolute",
              inset: 0,
              opacity: fadeIn * fadeOut,
              overflow: "hidden",
            }}
          >
            <Img
              src={staticFile(capture.publicPath)}
              alt={capture.alt}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: `${motion.focusX}% ${motion.focusY}%`,
                transformOrigin: `${motion.focusX}% ${motion.focusY}%`,
                transform: `scale(${imageScale}) translate(${panX}%, ${panY}%)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: `${motion.highlightLeft}%`,
                top: `${motion.highlightTop}%`,
                width: `${motion.highlightWidth}%`,
                height: `${motion.highlightHeight}%`,
                borderRadius: layout === "portrait" ? 22 : 18,
                border: `3px solid ${manifest.design.accentAlt}`,
                boxShadow: `0 0 0 ${8 * emphasis}px ${manifest.design.accentAlt}20, 0 0 44px ${manifest.design.accentAlt}55`,
                opacity: emphasis * fadeIn * fadeOut,
                transform: `scale(${0.96 + emphasis * 0.04})`,
                transformOrigin: "center",
              }}
              data-feature-focus={visual}
            >
              <span
                style={{
                  position: "absolute",
                  left: 14,
                  top: -18,
                  padding: layout === "portrait" ? "8px 13px" : "7px 11px",
                  borderRadius: 999,
                  background: manifest.design.accentAlt,
                  color: manifest.design.background,
                  fontSize: layout === "portrait" ? 19 : 16,
                  fontWeight: 780,
                  letterSpacing: 0.4,
                  whiteSpace: "nowrap",
                }}
              >
                {motion.featureLabel}
              </span>
            </div>
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: `${scan}%`,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${manifest.design.accent}, transparent)`,
          opacity: 0.75,
          boxShadow: `0 0 18px ${manifest.design.accent}`,
        }}
      />
    </div>
  );
}

function SceneProgress({ manifest, scene }: { manifest: CampaignManifest; scene: Scene }) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, scene.durationFrames], [0, 100], clamp);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 7 }}>
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: `linear-gradient(90deg, ${manifest.design.accent}, ${manifest.design.accentAlt})`,
        }}
      />
    </div>
  );
}

function AudienceCaption({
  manifest,
  scene,
  layout,
}: {
  manifest: CampaignManifest;
  scene: Scene;
  layout: VideoLayout;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 15, fps, config: { damping: 20, stiffness: 125 } });
  return (
    <div
      style={{
        padding: layout === "portrait" ? "28px 32px" : "22px 26px",
        borderRadius: manifest.design.radius,
        background: `${manifest.design.surface}F4`,
        border: `1px solid ${manifest.design.muted}44`,
        borderLeft: `6px solid ${manifest.design.accentAlt}`,
        boxShadow: "0 20px 70px rgba(0,0,0,0.36)",
        transform: `translateY(${(1 - enter) * 48}px)`,
        opacity: enter,
      }}
    >
      <div
        style={{
          fontSize: layout === "portrait" ? 37 : 28,
          lineHeight: 1.18,
          fontWeight: 590,
          textWrap: "balance",
        }}
      >
        {scene.audienceCaption}
      </div>
      <div
        style={{
          marginTop: 12,
          color: manifest.design.muted,
          fontFamily: "monospace",
          fontSize: layout === "portrait" ? 19 : 16,
          letterSpacing: 1.2,
        }}
      >
        {getEvidenceLabel(scene.evidenceIds)}
      </div>
    </div>
  );
}

function LandscapeScene({
  manifest,
  scene,
  captures,
}: {
  manifest: CampaignManifest;
  scene: Scene;
  captures: PreparedCapture[];
}) {
  const frame = useCurrentFrame();
  const safe = getSafeZone("landscape");
  const wipe = interpolate(frame, [0, 24, 58], [100, 42, 0], clamp);
  const publicTitle = scene.visual === "opening" ? manifest.productBrief.productName : scene.title;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: safe.top,
          left: safe.left,
          width: 650,
          bottom: safe.bottom + 36,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          zIndex: 4,
        }}
      >
        <div>
          <div
            style={{
              color: manifest.design.accent,
              fontSize: 21,
              letterSpacing: 4,
              fontWeight: 750,
              marginBottom: 30,
            }}
          >
            {manifest.productBrief.productName.toUpperCase()} /{" "}
            {String(scene.index).padStart(2, "0")}
          </div>
          <KineticTitle
            title={publicTitle}
            manifest={manifest}
            layout="landscape"
            opening={scene.visual === "opening"}
          />
        </div>
        <AudienceCaption manifest={manifest} scene={scene} layout="landscape" />
      </div>
      <div style={{ position: "absolute", top: 126, right: 72 }}>
        <CaptureSequence
          captures={captures}
          manifest={manifest}
          layout="landscape"
          durationInFrames={scene.durationFrames}
          visual={scene.visual}
        />
      </div>
      {scene.visual === "opening" ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 8,
            background: manifest.design.accent,
            transform: `translateX(${wipe}%) skewX(-8deg)`,
            transformOrigin: "right center",
            mixBlendMode: "screen",
            opacity: 0.82,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
}

function PortraitScene({
  manifest,
  scene,
  captures,
}: {
  manifest: CampaignManifest;
  scene: Scene;
  captures: PreparedCapture[];
}) {
  const frame = useCurrentFrame();
  const safe = getSafeZone("portrait");
  const pulse = interpolate(frame % 30, [0, 15, 29], [0.45, 1, 0.45], clamp);
  const publicTitle = scene.visual === "opening" ? manifest.productBrief.productName : scene.title;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: safe.top - 22,
          left: safe.left,
          right: safe.right,
          zIndex: 5,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            color: manifest.design.accent,
            fontSize: 22,
            letterSpacing: 3.6,
            fontWeight: 760,
          }}
        >
          <span
            style={{
              width: 13,
              height: 13,
              borderRadius: "50%",
              background: manifest.design.accentAlt,
              opacity: pulse,
              boxShadow: `0 0 22px ${manifest.design.accentAlt}`,
            }}
          />
          {manifest.productBrief.productName.toUpperCase()} · {String(scene.index).padStart(2, "0")}
        </div>
        <div style={{ marginTop: 24 }}>
          <KineticTitle
            title={publicTitle}
            manifest={manifest}
            layout="portrait"
            opening={scene.visual === "opening"}
          />
        </div>
      </div>
      <div style={{ position: "absolute", top: 610, left: 72 }}>
        <CaptureSequence
          captures={captures}
          manifest={manifest}
          layout="portrait"
          durationInFrames={scene.durationFrames}
          visual={scene.visual}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: safe.left,
          right: safe.right,
          bottom: safe.bottom,
          zIndex: 6,
        }}
      >
        <AudienceCaption manifest={manifest} scene={scene} layout="portrait" />
      </div>
    </AbsoluteFill>
  );
}

function ClosingScene({
  manifest,
  scene,
  layout,
  captures,
}: {
  manifest: CampaignManifest;
  scene: Scene;
  layout: VideoLayout;
  captures: PreparedCapture[];
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const safe = getSafeZone(layout);
  const enter = spring({ frame, fps, config: { damping: 17, stiffness: 125 } });
  const url = manifest.source.repositoryUrl.replace(/^https?:\/\//, "");
  const cta = manifest.copy.ctaVariants[0] ?? "Explore the repository";
  return (
    <AbsoluteFill>
      {captures.slice(0, 2).map((capture, index) => {
        const reveal = spring({
          frame: frame - index * 7,
          fps,
          durationInFrames: 24,
          config: { damping: 18, stiffness: 155 },
        });
        const isPortrait = layout === "portrait";
        return (
          <div
            key={capture.id}
            style={{
              position: "absolute",
              width: isPortrait ? 720 : 760,
              height: isPortrait ? 520 : 500,
              left: isPortrait ? (index === 0 ? -170 : 540) : index === 0 ? -100 : 1260,
              top: isPortrait ? (index === 0 ? 260 : 1080) : index === 0 ? 100 : 520,
              overflow: "hidden",
              borderRadius: isPortrait ? 34 : 28,
              border: `2px solid ${manifest.design.muted}55`,
              boxShadow: "0 36px 100px rgba(0,0,0,0.55)",
              opacity: reveal * 0.42,
              transform: `translateY(${(1 - reveal) * 90}px) rotate(${index === 0 ? -7 : 7}deg) scale(${0.94 + reveal * 0.06})`,
            }}
            data-closing-capture={index + 1}
          >
            <Img
              src={staticFile(capture.publicPath)}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <AbsoluteFill style={{ background: `${manifest.design.background}38` }} />
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          top: safe.top,
          right: safe.right,
          bottom: safe.bottom,
          left: safe.left,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: layout === "portrait" ? "flex-start" : "center",
          textAlign: layout === "portrait" ? "left" : "center",
          transform: `scale(${0.9 + enter * 0.1})`,
          opacity: enter,
          zIndex: 3,
        }}
      >
        <div
          style={{
            color: manifest.design.accent,
            fontSize: layout === "portrait" ? 28 : 24,
            letterSpacing: 5,
            fontWeight: 780,
          }}
        >
          {cta.toUpperCase()}
        </div>
        <div
          style={{
            marginTop: 34,
            fontSize: layout === "portrait" ? 162 : 154,
            lineHeight: 0.86,
            letterSpacing: -9,
            fontWeight: 820,
            maxWidth: layout === "portrait" ? 900 : 1500,
          }}
        >
          {manifest.productBrief.productName}
        </div>
        <div
          style={{
            marginTop: 54,
            padding: layout === "portrait" ? "26px 30px" : "22px 32px",
            borderRadius: 999,
            background: manifest.design.accent,
            color: manifest.design.background,
            fontFamily: "monospace",
            fontSize: layout === "portrait" ? 30 : 27,
            fontWeight: 750,
          }}
        >
          {url}
        </div>
        <div
          style={{
            marginTop: 34,
            color: manifest.design.muted,
            fontSize: layout === "portrait" ? 28 : 24,
          }}
        >
          {scene.audienceCaption}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function SceneLayer({
  manifest,
  scene,
  layout,
  captures,
}: {
  manifest: CampaignManifest;
  scene: Scene;
  layout: VideoLayout;
  captures: PreparedCapture[];
}) {
  const frame = useCurrentFrame();
  const exit = interpolate(
    frame,
    [scene.durationFrames - 14, scene.durationFrames - 1],
    [1, 0],
    clamp,
  );
  return (
    <AbsoluteFill style={{ opacity: exit }}>
      <MotionField manifest={manifest} layout={layout} />
      {scene.visual === "closing" ? (
        <ClosingScene manifest={manifest} scene={scene} layout={layout} captures={captures} />
      ) : layout === "portrait" ? (
        <PortraitScene manifest={manifest} scene={scene} captures={captures} />
      ) : (
        <LandscapeScene manifest={manifest} scene={scene} captures={captures} />
      )}
      <SceneProgress manifest={manifest} scene={scene} />
    </AbsoluteFill>
  );
}

export function PitchFlowComposition({ manifest, layout, captures }: PitchFlowCompositionProps) {
  const fontFamily = manifest.design.displayFont === "system-serif" ? SYSTEM_SERIF : SYSTEM_SANS;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: manifest.design.background,
        color: manifest.design.text,
        fontFamily,
        overflow: "hidden",
      }}
    >
      {manifest.video.scenes.map((scene) => (
        <Sequence
          key={`${scene.index}-${scene.startFrame}`}
          from={scene.startFrame}
          durationInFrames={scene.durationFrames}
          premountFor={30}
        >
          <SceneLayer
            manifest={manifest}
            scene={scene}
            layout={layout}
            captures={selectSceneCaptures(captures, scene)}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
