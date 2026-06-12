import { ImageResponse } from "next/og";

export const alt = "MatchSeer matchday forecast preview";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          padding: 58,
          color: "#121314",
          background: "linear-gradient(115deg, #fffaf0 0%, #f7ead4 48%, #dff0e8 100%)",
          fontFamily: "Arial",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            border: "3px solid rgba(18, 19, 20, 0.14)",
            borderRadius: 24,
            padding: 44,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 82,
                height: 82,
                color: "#fffaf0",
                background: "#101820",
                borderRadius: 18,
                fontSize: 48,
                fontWeight: 900,
              }}
            >
              MS
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  color: "#6a7078",
                  fontSize: 30,
                  fontWeight: 900,
                  letterSpacing: 0,
                  textTransform: "uppercase",
                }}
              >
                MatchSeer
              </span>
              <span style={{ fontSize: 54, fontWeight: 900 }}>
                Matchday forecast
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 28 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                gap: 18,
              }}
            >
              <span style={{ fontSize: 78, fontWeight: 900, lineHeight: 0.96 }}>
                Real stats, playful readouts, zero betting energy.
              </span>
              <span style={{ color: "#4e555d", fontSize: 28, fontWeight: 700 }}>
                AI interpretation, team form, weather, referee context, and player sparks.
              </span>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                width: 290,
                padding: 24,
                color: "#fff",
                background: "#101820",
                borderRadius: 18,
              }}
            >
              <span style={{ color: "#f0b84a", fontSize: 26, fontWeight: 900 }}>
                Oracle signal
              </span>
              <span style={{ fontSize: 62, fontWeight: 900 }}>74%</span>
              <span style={{ color: "#cfd5dc", fontSize: 24, fontWeight: 700 }}>
                Confidence without sportsbook vibes.
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
