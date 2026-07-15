import { ImageResponse } from "next/og";

export const alt = "PitchFlow turns a repository into a complete launch campaign";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "stretch",
        background: "#090a0c",
        color: "#f3f2ec",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Arial, sans-serif",
        height: "100%",
        justifyContent: "space-between",
        padding: "70px 76px",
        width: "100%",
      }}
    >
      <div
        style={{ alignItems: "center", display: "flex", fontSize: 28, fontWeight: 700, gap: 20 }}
      >
        <div
          style={{
            alignItems: "center",
            border: "2px solid #9cffb8",
            borderRadius: 16,
            color: "#9cffb8",
            display: "flex",
            fontFamily: "monospace",
            fontSize: 20,
            height: 56,
            justifyContent: "center",
            width: 56,
          }}
        >
          PF
        </div>
        PitchFlow
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 92,
            fontWeight: 700,
            letterSpacing: "-6px",
            lineHeight: 0.95,
          }}
        >
          <span>Paste your repo.</span>
          <span style={{ color: "#9cffb8" }}>Launch ready.</span>
        </div>
        <div style={{ color: "#b4b6bb", fontSize: 30 }}>
          Site, social kit, product video, and copy · Directed with GPT-5.6 in Codex
        </div>
      </div>
      <div
        style={{
          color: "#9cffb8",
          display: "flex",
          fontFamily: "monospace",
          fontSize: 18,
          gap: 42,
        }}
      >
        <span>ANALYZE</span>
        <span>DIRECT</span>
        <span>GENERATE</span>
        <span>DELIVER</span>
        <span>EXPORT</span>
      </div>
    </div>,
    size,
  );
}
