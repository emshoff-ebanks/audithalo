import { ImageResponse } from "next/og";
import { getLatestRuleByJurLic, parseSlug } from "@/lib/rules";

// Note: this OG image runs on the Node.js runtime (Next 16 default).
// The rules loader uses node:fs + js-yaml synchronously and cannot run on Edge.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "AuditHalo — state supervision rule";

export default async function StateOgImage({
  params,
}: {
  // In Next.js 16, `params` for opengraph-image.tsx is a Promise — same as page.tsx.
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const parsed = parseSlug(slug);
  const rule = parsed
    ? getLatestRuleByJurLic(parsed.jurisdiction, parsed.licenseCode)
    : null;

  const stateTitle = rule
    ? `${rule.jurisdiction} ${rule.license_code}`
    : "AuditHalo";
  const licenseName = rule?.license_name ?? "Supervision compliance";

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
        }}
      >
        {/* Header — brand mark + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <BrandMark size={48} />
          <span
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: "#0A1428",
              letterSpacing: "-0.01em",
            }}
          >
            AuditHalo
          </span>
        </div>

        {/* Body — big state-specific title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
          }}
        >
          <span
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: "#1D4ED8",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              marginBottom: "16px",
            }}
          >
            State rule
          </span>
          <p
            style={{
              fontSize: 96,
              fontWeight: 700,
              color: "#0A1428",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              margin: 0,
            }}
          >
            {stateTitle}
          </p>
          <p
            style={{
              fontSize: 36,
              color: "#0A1428",
              opacity: 0.7,
              marginTop: "20px",
              maxWidth: "950px",
              lineHeight: 1.3,
            }}
          >
            {licenseName} — supervision hours, tracked
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
            audithalo.com/states/{slug}
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
            Encoded · cited · verifiable
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}

/**
 * Brand mark — navy ring with a gold dot at 22° clockwise from 12 o'clock.
 * See src/app/opengraph-image.tsx for geometry notes.
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
