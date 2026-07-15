import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { BuildWeekDemoProps, DemoAssetKey } from "./demo-contracts";
import { DEMO_SECTIONS } from "./demo-timeline";

const BG = "#070b0a";
const SURFACE = "#101615";
const TEXT = "#f6f4ee";
const MUTED = "#a9b0ad";
const GREEN = "#74f7a5";
const CYAN = "#54d6e5";
const ORANGE = "#ffb36a";
const FONT = "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const MONO = "SFMono-Regular, Menlo, Monaco, Consolas, monospace";
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

function asset(props: BuildWeekDemoProps, key: DemoAssetKey): string {
  return staticFile(props.assets[key].publicPath);
}

function Grid() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        opacity: 0.12,
        backgroundImage:
          "linear-gradient(rgba(116,247,165,.24) 1px, transparent 1px), linear-gradient(90deg, rgba(116,247,165,.24) 1px, transparent 1px)",
        backgroundSize: "80px 80px",
        transform: `translate(${-(frame * 0.35) % 80}px, ${-(frame * 0.2) % 80}px)`,
      }}
    />
  );
}

function Brand({ right }: { right?: ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 44,
        left: 64,
        right: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 20,
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 15, fontSize: 25, fontWeight: 750 }}
      >
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 44,
            height: 44,
            border: `1px solid ${GREEN}`,
            borderRadius: 12,
            color: GREEN,
            fontFamily: MONO,
            fontSize: 17,
          }}
        >
          PF
        </span>
        PitchFlow
      </div>
      {right}
    </div>
  );
}

function Pill({ children, color = GREEN }: { children: ReactNode; color?: string }) {
  return (
    <div
      style={{
        padding: "11px 18px",
        borderRadius: 999,
        border: `1px solid ${color}77`,
        background: `${BG}E8`,
        color,
        fontFamily: MONO,
        fontSize: 16,
        fontWeight: 750,
        letterSpacing: 1.4,
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function KeyCaption({ children, accent = GREEN }: { children: ReactNode; accent?: string }) {
  const frame = useCurrentFrame();
  const enter = spring({ frame: frame - 8, fps: 30, config: { damping: 18, stiffness: 130 } });
  return (
    <div
      style={{
        position: "absolute",
        left: 64,
        right: 64,
        bottom: 34,
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "18px 24px",
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,.14)",
        borderLeft: `6px solid ${accent}`,
        background: "rgba(7,11,10,.94)",
        boxShadow: "0 18px 70px rgba(0,0,0,.38)",
        color: TEXT,
        fontSize: 27,
        lineHeight: 1.25,
        fontWeight: 610,
        transform: `translateY(${(1 - enter) * 42}px)`,
        opacity: enter,
      }}
    >
      {children}
    </div>
  );
}

function Shot({ duration, children }: { duration: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const opacity =
    interpolate(frame, [0, 12], [0, 1], clamp) *
    interpolate(frame, [duration - 12, duration - 1], [1, 0], clamp);
  return (
    <AbsoluteFill
      style={{ background: BG, color: TEXT, fontFamily: FONT, opacity, overflow: "hidden" }}
    >
      <Grid />
      {children}
    </AbsoluteFill>
  );
}

function SourceImage({
  props,
  assetKey,
  style,
}: {
  props: BuildWeekDemoProps;
  assetKey: DemoAssetKey;
  style?: CSSProperties;
}) {
  return (
    <Img
      src={asset(props, assetKey)}
      style={{ width: "100%", height: "100%", objectFit: "contain", ...style }}
    />
  );
}

function Opening({ props, duration }: { props: BuildWeekDemoProps; duration: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = ["Ship the code.", "PitchFlow ships the story."];
  const reveal = spring({ frame, fps, config: { damping: 17, stiffness: 135 } });
  const wipe = interpolate(frame, [0, 34, 62], [100, 34, 0], clamp);
  return (
    <Shot duration={duration}>
      <Brand right={<Pill>Developer tools</Pill>} />
      <div
        style={{
          position: "absolute",
          left: 68,
          top: 160,
          width: 790,
          zIndex: 4,
          transform: `translateY(${(1 - reveal) * 70}px)`,
          opacity: reveal,
        }}
      >
        {title.map((line, index) => (
          <div
            key={line}
            style={{
              fontSize: 104,
              lineHeight: 0.9,
              letterSpacing: -6,
              fontWeight: 820,
              color: index === 1 ? GREEN : TEXT,
            }}
          >
            {line}
          </div>
        ))}
        <div style={{ marginTop: 34, color: MUTED, fontSize: 31, lineHeight: 1.35 }}>
          One pinned GitHub commit → one evidence-linked launch system.
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          right: 36,
          top: 136,
          width: 1020,
          height: 720,
          transform: `translateX(${(1 - reveal) * 120}px) scale(${0.92 + reveal * 0.08})`,
          boxShadow: "0 38px 120px rgba(0,0,0,.48)",
        }}
      >
        <SourceImage props={props} assetKey="cover" />
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 10,
          background: GREEN,
          transform: `translateX(${wipe}%) skewX(-9deg)`,
          transformOrigin: "right center",
          opacity: 0.85,
          mixBlendMode: "screen",
        }}
      />
      <KeyCaption>From scattered launch drafts to one inspectable campaign package.</KeyCaption>
    </Shot>
  );
}

function FullImageShot({
  props,
  assetKey,
  duration,
  label,
  caption,
  zoom = 1,
  panY = 0,
}: {
  props: BuildWeekDemoProps;
  assetKey: DemoAssetKey;
  duration: number;
  label: string;
  caption: string;
  zoom?: number;
  panY?: number;
}) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, duration], [0, 1], clamp);
  return (
    <Shot duration={duration}>
      <Brand right={<Pill>{label}</Pill>} />
      <div
        style={{
          position: "absolute",
          left: 56,
          right: 56,
          top: 112,
          bottom: 118,
          overflow: "hidden",
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,.14)",
          background: "#090c0c",
          boxShadow: "0 36px 110px rgba(0,0,0,.48)",
        }}
      >
        <SourceImage
          props={props}
          assetKey={assetKey}
          style={{
            transform: `scale(${1 + (zoom - 1) * progress}) translateY(${panY * progress}px)`,
            transformOrigin: "center top",
          }}
        />
      </div>
      <KeyCaption>{caption}</KeyCaption>
    </Shot>
  );
}

function ViewerScroll({ props, duration }: { props: BuildWeekDemoProps; duration: number }) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [20, duration - 25], [0, 1], clamp);
  return (
    <Shot duration={duration}>
      <Brand right={<Pill>Public · no login</Pill>} />
      <div
        style={{
          position: "absolute",
          left: 244,
          width: 1432,
          top: 110,
          height: 850,
          overflow: "hidden",
          borderRadius: 22,
          border: `1px solid ${GREEN}55`,
          boxShadow: "0 38px 120px rgba(0,0,0,.5)",
        }}
      >
        <SourceImage
          props={props}
          assetKey="capture02"
          style={{
            objectFit: "cover",
            objectPosition: "top",
            transform: `scale(1.06) translateY(${-progress * 210}px)`,
            transformOrigin: "center top",
          }}
        />
      </div>
      <KeyCaption>
        Cached immutably on Vercel: campaign, captures, motion masters, hashes, and ZIP.
      </KeyCaption>
    </Shot>
  );
}

function ChannelMontage({ props, duration }: { props: BuildWeekDemoProps; duration: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const left = spring({ frame, fps, config: { damping: 18, stiffness: 125 } });
  const right = spring({ frame: frame - 8, fps, config: { damping: 18, stiffness: 125 } });
  return (
    <Shot duration={duration}>
      <Brand right={<Pill color={CYAN}>One manifest · every channel</Pill>} />
      <div
        style={{
          position: "absolute",
          left: 70,
          top: 144,
          width: 1100,
          height: 620,
          transform: `translateX(${(1 - left) * -90}px)`,
          opacity: left,
        }}
      >
        <SourceImage props={props} assetKey="socialX" />
      </div>
      <div
        style={{
          position: "absolute",
          right: 100,
          top: 126,
          width: 540,
          height: 690,
          transform: `translateX(${(1 - right) * 100}px) rotate(2deg)`,
          opacity: right,
        }}
      >
        <SourceImage props={props} assetKey="carousel01" />
      </div>
      <div
        style={{
          position: "absolute",
          left: 100,
          top: 150,
          fontSize: 70,
          fontWeight: 810,
          letterSpacing: -4,
          width: 720,
        }}
      >
        Exact-size outputs.
        <br />
        <span style={{ color: CYAN }}>One evidence spine.</span>
      </div>
      <KeyCaption accent={CYAN}>
        Social graphics and five-slide carousel remain source-linked.
      </KeyCaption>
    </Shot>
  );
}

function MasterExcerpts({ props, duration }: { props: BuildWeekDemoProps; duration: number }) {
  return (
    <Shot duration={duration}>
      <Brand right={<Pill color={CYAN}>Accepted masters</Pill>} />
      <div
        style={{
          position: "absolute",
          left: 70,
          top: 154,
          width: 1190,
          height: 670,
          borderRadius: 22,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,.18)",
        }}
      >
        <OffthreadVideo
          src={asset(props, "landscapeVideo")}
          startFrom={90}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          right: 110,
          top: 134,
          width: 380,
          height: 676,
          borderRadius: 22,
          overflow: "hidden",
          border: `2px solid ${CYAN}`,
        }}
      >
        <OffthreadVideo
          src={asset(props, "portraitVideo")}
          startFrom={90}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      <KeyCaption accent={CYAN}>
        Verified 16:9 and 9:16 Remotion masters, both rendered from the same manifest.
      </KeyCaption>
    </Shot>
  );
}

function FactBoard({
  duration,
  eyebrow,
  title,
  facts,
  caption,
  accent = GREEN,
}: {
  duration: number;
  eyebrow: string;
  title: string;
  facts: Array<{ value: string; label: string }>;
  caption: string;
  accent?: string;
}) {
  const frame = useCurrentFrame();
  return (
    <Shot duration={duration}>
      <Brand right={<Pill color={accent}>{eyebrow}</Pill>} />
      <div style={{ position: "absolute", left: 82, right: 82, top: 170 }}>
        <div
          style={{
            fontSize: 88,
            lineHeight: 0.95,
            letterSpacing: -5,
            fontWeight: 820,
            maxWidth: 1250,
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${facts.length}, 1fr)`,
            gap: 20,
            marginTop: 74,
          }}
        >
          {facts.map((fact, index) => {
            const enter = spring({
              frame: frame - index * 7,
              fps: 30,
              config: { damping: 18, stiffness: 125 },
            });
            return (
              <div
                key={fact.label}
                style={{
                  minHeight: 270,
                  padding: 30,
                  borderRadius: 22,
                  border: `1px solid ${accent}66`,
                  background: SURFACE,
                  transform: `translateY(${(1 - enter) * 70}px)`,
                  opacity: enter,
                }}
              >
                <div
                  style={{
                    color: accent,
                    fontSize: fact.value.length > 12 ? 44 : 72,
                    lineHeight: 1,
                    fontWeight: 820,
                    letterSpacing: -2,
                  }}
                >
                  {fact.value}
                </div>
                <div style={{ marginTop: 24, color: MUTED, fontSize: 23, lineHeight: 1.35 }}>
                  {fact.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <KeyCaption accent={accent}>{caption}</KeyCaption>
    </Shot>
  );
}

function BoundaryDiagram({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const nodes = [
    { title: "Public GitHub", body: "canonical URL + pinned commit", color: GREEN },
    { title: "Local PitchFlow", body: "bounded evidence + GPT-5.6 Sol", color: CYAN },
    { title: "Immutable viewer", body: "read-only cached dogfood", color: ORANGE },
  ];
  return (
    <Shot duration={duration}>
      <Brand right={<Pill>Security boundary</Pill>} />
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 160,
          fontSize: 78,
          fontWeight: 820,
          letterSpacing: -4,
        }}
      >
        Local generation.
        <br />
        <span style={{ color: GREEN }}>Public verification.</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 90,
          right: 90,
          top: 480,
          display: "grid",
          gridTemplateColumns: "1fr 120px 1fr 120px 1fr",
          alignItems: "center",
        }}
      >
        {nodes.flatMap((node, index) => {
          const enter = spring({
            frame: frame - index * 9,
            fps: 30,
            config: { damping: 18, stiffness: 120 },
          });
          const card = (
            <div
              key={node.title}
              style={{
                minHeight: 230,
                padding: 30,
                borderRadius: 22,
                border: `1px solid ${node.color}77`,
                background: SURFACE,
                transform: `scale(${0.9 + enter * 0.1})`,
                opacity: enter,
              }}
            >
              <div style={{ color: node.color, fontFamily: MONO, fontSize: 18, letterSpacing: 2 }}>
                0{index + 1}
              </div>
              <div style={{ marginTop: 24, fontSize: 38, fontWeight: 780 }}>{node.title}</div>
              <div style={{ marginTop: 14, color: MUTED, fontSize: 22, lineHeight: 1.35 }}>
                {node.body}
              </div>
            </div>
          );
          return index < nodes.length - 1
            ? [
                card,
                <div
                  key={`${node.title}-arrow`}
                  style={{ textAlign: "center", color: GREEN, fontSize: 52 }}
                >
                  →
                </div>,
              ]
            : [card];
        })}
      </div>
      <KeyCaption>
        No cloning or execution of submitted code. No personal OAuth in the cloud.
      </KeyCaption>
    </Shot>
  );
}

function Architecture({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const nodes = [
    "Evidence engine",
    "Codex SDK boundary",
    "Manifest schema",
    "Export pipeline",
    "Remotion",
    "Judge viewer",
  ];
  return (
    <Shot duration={duration}>
      <Brand right={<Pill color={CYAN}>Codex collaboration</Pill>} />
      <div
        style={{
          position: "absolute",
          left: 82,
          top: 150,
          fontSize: 78,
          lineHeight: 0.95,
          fontWeight: 820,
          letterSpacing: -4,
        }}
      >
        Finish line →<br />
        <span style={{ color: CYAN }}>executable contracts.</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 760,
          right: 90,
          top: 150,
          bottom: 180,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 18,
        }}
      >
        {nodes.map((node, index) => {
          const enter = spring({
            frame: frame - index * 6,
            fps: 30,
            config: { damping: 18, stiffness: 130 },
          });
          return (
            <div
              key={node}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                padding: 26,
                borderRadius: 20,
                background: SURFACE,
                border: "1px solid rgba(255,255,255,.13)",
                transform: `translateX(${(1 - enter) * 60}px)`,
                opacity: enter,
              }}
            >
              <span
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: 46,
                  height: 46,
                  borderRadius: "50%",
                  background: CYAN,
                  color: BG,
                  fontFamily: MONO,
                  fontWeight: 800,
                }}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span style={{ fontSize: 28, fontWeight: 700 }}>{node}</span>
            </div>
          );
        })}
      </div>
      <KeyCaption accent={CYAN}>
        Codex implemented, tested, red-teamed, and repaired against explicit product gates.
      </KeyCaption>
    </Shot>
  );
}

function RepairLoop({ props, duration }: { props: BuildWeekDemoProps; duration: number }) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, duration], [0, 1], clamp);
  return (
    <Shot duration={duration}>
      <Brand right={<Pill color={ORANGE}>Review → repair → verify</Pill>} />
      <div style={{ position: "absolute", left: 65, top: 150, width: 1050, height: 700 }}>
        <SourceImage
          props={props}
          assetKey="handoff"
          style={{ transform: `scale(${1 + progress * 0.035})` }}
        />
      </div>
      <div style={{ position: "absolute", right: 90, top: 190, width: 600 }}>
        <div style={{ color: ORANGE, fontFamily: MONO, fontSize: 20, letterSpacing: 2 }}>
          INDEPENDENT MEDIA GATE
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 65,
            lineHeight: 0.95,
            letterSpacing: -3,
            fontWeight: 820,
          }}
        >
          Technically valid was not enough.
        </div>
        <div style={{ display: "grid", gap: 14, marginTop: 38 }}>
          {[
            "Two candidates rejected",
            "Visible proof strengthened",
            "Content contract repaired",
            "Full gates rerun",
          ].map((item, index) => (
            <div
              key={item}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                color: index === 0 ? ORANGE : TEXT,
                fontSize: 25,
                fontWeight: 650,
              }}
            >
              <span style={{ color: index === 0 ? ORANGE : GREEN }}>{index === 0 ? "×" : "✓"}</span>
              {item}
            </div>
          ))}
        </div>
      </div>
      <KeyCaption accent={ORANGE}>
        The failed verifier triggered a repair loop—not a weaker finish line.
      </KeyCaption>
    </Shot>
  );
}

function PublicBoundary({ props, duration }: { props: BuildWeekDemoProps; duration: number }) {
  return (
    <Shot duration={duration}>
      <Brand right={<Pill>Public · read only</Pill>} />
      <div
        style={{
          position: "absolute",
          left: 70,
          top: 140,
          width: 1180,
          height: 720,
          borderRadius: 24,
          overflow: "hidden",
          border: `1px solid ${GREEN}55`,
        }}
      >
        <SourceImage props={props} assetKey="capture02" />
      </div>
      <div style={{ position: "absolute", right: 90, top: 170, width: 500 }}>
        <div style={{ fontSize: 67, lineHeight: 0.94, letterSpacing: -3, fontWeight: 820 }}>
          Complete without a live presentation.
        </div>
        <div style={{ marginTop: 36, display: "grid", gap: 16 }}>
          {["Cached campaign", "Generation disabled", "No login", "Immutable assets"].map(
            (item) => (
              <div
                key={item}
                style={{
                  padding: "17px 20px",
                  borderRadius: 14,
                  background: SURFACE,
                  border: `1px solid ${GREEN}44`,
                  color: GREEN,
                  fontFamily: MONO,
                  fontSize: 19,
                }}
              >
                ✓ {item}
              </div>
            ),
          )}
        </div>
      </div>
      <KeyCaption>
        The public deployment is a read-only viewer; fresh GPT-5.6 generation stays local.
      </KeyCaption>
    </Shot>
  );
}

function FinalClose({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps: 30, config: { damping: 17, stiffness: 120 } });
  return (
    <Shot duration={duration}>
      <Brand right={<Pill>Ship the story</Pill>} />
      <div
        style={{
          position: "absolute",
          inset: "150px 80px 120px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          transform: `scale(${0.9 + enter * 0.1})`,
          opacity: enter,
        }}
      >
        <div style={{ color: GREEN, fontFamily: MONO, fontSize: 22, letterSpacing: 4 }}>
          EVIDENCE IN · CAMPAIGN OUT
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 174,
            lineHeight: 0.8,
            fontWeight: 840,
            letterSpacing: -11,
          }}
        >
          PitchFlow
        </div>
        <div style={{ marginTop: 52, display: "grid", gap: 18 }}>
          <div
            style={{
              padding: "20px 34px",
              borderRadius: 999,
              background: GREEN,
              color: BG,
              fontFamily: MONO,
              fontSize: 28,
              fontWeight: 780,
            }}
          >
            pitchflow-ten.vercel.app
          </div>
          <div style={{ color: CYAN, fontFamily: MONO, fontSize: 25 }}>
            github.com/sickn33/pitchflow
          </div>
        </div>
        <div style={{ marginTop: 50, color: MUTED, fontSize: 31 }}>
          Ship the story with the same rigor as the code.
        </div>
      </div>
    </Shot>
  );
}

export function BuildWeekDemoComposition(props: BuildWeekDemoProps) {
  const [promise, judge, local, gpt, exportSection, codex, close] = DEMO_SECTIONS;
  if (!promise || !judge || !local || !gpt || !exportSection || !codex || !close) return null;
  return (
    <AbsoluteFill style={{ background: BG }}>
      <Audio src={asset(props, "narration")} volume={1} />

      <Sequence from={promise.startFrame} durationInFrames={150}>
        <Opening props={props} duration={150} />
      </Sequence>
      <Sequence from={150} durationInFrames={promise.durationInFrames - 150}>
        <FullImageShot
          props={props}
          assetKey="cover"
          duration={promise.durationInFrames - 150}
          label="One pinned repository"
          caption="PitchFlow turns bounded repository evidence into one launch system."
          zoom={1.055}
        />
      </Sequence>

      <Sequence from={judge.startFrame} durationInFrames={300}>
        <ViewerScroll props={props} duration={300} />
      </Sequence>
      <Sequence from={judge.startFrame + 300} durationInFrames={180}>
        <ChannelMontage props={props} duration={180} />
      </Sequence>
      <Sequence from={judge.startFrame + 480} durationInFrames={150}>
        <MasterExcerpts props={props} duration={150} />
      </Sequence>

      <Sequence from={local.startFrame} durationInFrames={390}>
        <FullImageShot
          props={props}
          assetKey="capture01"
          duration={390}
          label="Local Codex workspace"
          caption="One command, one canonical public GitHub URL, one resolved 40-character commit."
          zoom={1.04}
          panY={-26}
        />
      </Sequence>
      <Sequence from={local.startFrame + 390} durationInFrames={384}>
        <BoundaryDiagram duration={384} />
      </Sequence>

      <Sequence from={gpt.startFrame} durationInFrames={300}>
        <FullImageShot
          props={props}
          assetKey="evidence"
          duration={300}
          label="GPT-5.6 Sol"
          caption="The model receives bounded evidence and a strict schema through the official Codex SDK."
          zoom={1.045}
        />
      </Sequence>
      <Sequence from={gpt.startFrame + 300} durationInFrames={300}>
        <FactBoard
          duration={300}
          eyebrow="Accepted dogfood turn"
          title="Material creative direction, verified."
          facts={[
            { value: "GPT-5.6 Sol", label: "model through local Codex entitlement" },
            { value: "8", label: "evidence-linked claims" },
            { value: "49", label: "evidence-link checks passed" },
            { value: "0", label: "schema repair attempts" },
          ]}
          caption="Unsupported metrics, customers, testimonials, and superlatives are rejected."
          accent={CYAN}
        />
      </Sequence>
      <Sequence from={gpt.startFrame + 600} durationInFrames={204}>
        <FullImageShot
          props={props}
          assetKey="capture01"
          duration={204}
          label="Evidence first"
          caption="Every factual surface points back to exact source records."
          zoom={1.065}
          panY={-34}
        />
      </Sequence>

      <Sequence from={exportSection.startFrame} durationInFrames={210}>
        <FullImageShot
          props={props}
          assetKey="capture03"
          duration={210}
          label="Review · refine · copy"
          caption="Claim edits become explicitly user-supplied; supported inferences require approval."
          zoom={1.04}
        />
      </Sequence>
      <Sequence from={exportSection.startFrame + 210} durationInFrames={210}>
        <FullImageShot
          props={props}
          assetKey="capture04"
          duration={210}
          label="Verified export receipt"
          caption="Validated captures, exact-size assets, checksums, and a traversal-safe ZIP."
          zoom={1.04}
        />
      </Sequence>
      <Sequence from={exportSection.startFrame + 420} durationInFrames={180}>
        <MasterExcerpts props={props} duration={180} />
      </Sequence>
      <Sequence from={exportSection.startFrame + 600} durationInFrames={144}>
        <FullImageShot
          props={props}
          assetKey="handoff"
          duration={144}
          label="One manifest · complete handoff"
          caption="Microsite, social, carousel, copy, video, index, and archive stay aligned."
          zoom={1.03}
        />
      </Sequence>

      <Sequence from={codex.startFrame} durationInFrames={320}>
        <Architecture duration={320} />
      </Sequence>
      <Sequence from={codex.startFrame + 320} durationInFrames={240}>
        <FactBoard
          duration={240}
          eyebrow="Build Week partnership"
          title="Codex accelerated the whole product."
          facts={[
            { value: "LOCAL", label: "authenticated SDK boundary" },
            { value: "PINNED", label: "repository evidence" },
            { value: "READ-ONLY", label: "public viewer" },
            { value: "TESTED", label: "security and media gates" },
          ]}
          caption="The key architecture decisions stayed explicit and independently verifiable."
          accent={CYAN}
        />
      </Sequence>
      <Sequence from={codex.startFrame + 560} durationInFrames={271}>
        <RepairLoop props={props} duration={271} />
      </Sequence>

      <Sequence from={close.startFrame} durationInFrames={270}>
        <PublicBoundary props={props} duration={270} />
      </Sequence>
      <Sequence from={close.startFrame + 270} durationInFrames={276}>
        <FinalClose duration={276} />
      </Sequence>
    </AbsoluteFill>
  );
}
