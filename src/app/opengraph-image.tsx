import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "AuditHalo — Supervision compliance tracking for clinical mental-health counselor associates";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function GlobalOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#FAFAF7",
          display: "flex",
          flexDirection: "column",
          padding: "72px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Brand mark + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <BrandMark size={72} />
          <span
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: "#0A1428",
              letterSpacing: "-0.02em",
            }}
          >
            AuditHalo
          </span>
        </div>

        {/* Tagline — calm-confidence brand voice */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            marginTop: "40px",
          }}
        >
          <p
            style={{
              fontSize: 64,
              fontWeight: 600,
              color: "#0A1428",
              lineHeight: 1.15,
              maxWidth: "900px",
              letterSpacing: "-0.025em",
              margin: 0,
            }}
          >
            Supervision records your board will never question.
          </p>
          <p
            style={{
              fontSize: 28,
              color: "#0A1428",
              opacity: 0.65,
              marginTop: "32px",
              maxWidth: "850px",
              lineHeight: 1.4,
            }}
          >
            Encoded state-board rules. Tamper-evident e-signatures. Audit-ready
            evidence packages.
          </p>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid #E3E0D4",
            paddingTop: "24px",
          }}
        >
          <span
            style={{
              fontSize: 22,
              color: "#0A1428",
              opacity: 0.7,
              fontFamily: "monospace",
            }}
          >
            audithalo.com
          </span>
          <span
            style={{
              fontSize: 18,
              color: "#5F6470",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              fontWeight: 600,
            }}
          >
            For clinical supervisors
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}

/**
 * Brand mark — navy ring with a gold dot at 22° clockwise from 12 o'clock.
 *
 * The dot sits on a small background-color "knockout" circle (r=8) so it
 * visually breaks the ring, matching the brand book's mark.
 *
 * Geometry: a circle of radius 42 centered at (50, 50). 22° clockwise from
 * 12 o'clock in SVG coords (y-down) → angle = -90 + 22 = -68°.
 *   x = 50 + 42 * cos(-68°) ≈ 65.7
 *   y = 50 + 42 * sin(-68°) ≈ 11.1
 */
function BrandMark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="50"
        cy="50"
        r="42"
        fill="none"
        stroke="#0F1F4C"
        strokeWidth="14"
      />
      <circle cx="65.7" cy="11.1" r="8" fill="#FAFAF7" />
      <circle cx="65.7" cy="11.1" r="6" fill="#B8860B" />
    </svg>
  );
}
