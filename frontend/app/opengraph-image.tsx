import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "UjamaaDAO — Ward Sovereignty Platform"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-end",
          background: "#1D4731",
          padding: "64px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top-right watermark circles */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            right: "-120px",
            width: "480px",
            height: "480px",
            borderRadius: "50%",
            border: "2px solid rgba(212,145,30,0.25)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "-60px",
            right: "-60px",
            width: "360px",
            height: "360px",
            borderRadius: "50%",
            border: "2px solid rgba(212,145,30,0.15)",
            display: "flex",
          }}
        />

        {/* Bottom content */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Wordmark */}
          <div
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: "rgba(247,242,232,0.55)",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            UJAMAA DAO
          </div>

          {/* Headline */}
          <div
            style={{
              fontSize: "68px",
              fontWeight: 700,
              color: "#F7F2E8",
              lineHeight: 1.05,
              maxWidth: "800px",
            }}
          >
            Ward Sovereignty Platform
          </div>

          {/* Sub */}
          <div
            style={{
              fontSize: "28px",
              color: "rgba(247,242,232,0.65)",
              marginTop: "8px",
              maxWidth: "680px",
            }}
          >
            Governance · Community Projects · Economic Sovereignty
          </div>

          {/* Amber bar */}
          <div
            style={{
              width: "80px",
              height: "4px",
              background: "#D4911E",
              borderRadius: "2px",
              marginTop: "8px",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  )
}
