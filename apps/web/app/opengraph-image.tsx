import { ImageResponse } from "next/og";

export const alt = "PitchFlow — evidence in, launch system out";
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
          <span>Evidence in.</span>
          <span style={{ color: "#9cffb8" }}>Launch system out.</span>
        </div>
        <div style={{ color: "#b4b6bb", fontSize: 30 }}>
          A repo-native AI launch studio · Built with Codex + GPT-5.6
        </div>
      </div>
      <div
        style={{
          color: "#ffb86b",
          display: "flex",
          fontFamily: "monospace",
          fontSize: 18,
          gap: 42,
        }}
      >
        <span>COMMIT PINNED</span>
        <span>CLAIMS CITED</span>
        <span>ASSETS REPRODUCIBLE</span>
      </div>
    </div>,
    size,
  );
}
