import type { HourRing, HourLegendStat } from "@/lib/rules/hour-rings";
import type { RiskLevel } from "@/lib/rules/types";

/**
 * Concentric-ring licensure tracker for the supervisee dashboard
 * (docs/App changes/handoff-05-supervisee-page.md §3). Sits on a neutral
 * panel — the halo-yellow used for the supervision ring is a scoped
 * data-viz exception to "yellow = CTA only". Track/labels flip in dark
 * via tokens; no motion (respects prefers-reduced-motion by construction).
 *
 * Pure presentational: all math is done upstream by computeHourRings.
 */

const VIEW = 200;
const CENTER = VIEW / 2;
const STROKE = 11;
// Outer → inner radii, matched positionally to rings[0..2].
const RADII = [84, 68, 52];

const RING_COLOR: Record<HourRing["key"], string> = {
  practice: "var(--text-primary)", // ink; flips to paper in dark
  supervision: "var(--halo-yellow)",
  individual: "var(--sage-500)",
};

const STAT_DOT: Record<HourLegendStat["key"], string> = {
  individual: "var(--sage-500)",
  group: "var(--sage-500)",
};

/** Locale-independent formatter — deterministic across SSR/CSR. */
function fmt(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  const [int, dec] = rounded.toFixed(1).split(".");
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec === "0" ? withSep : `${withSep}.${dec}`;
}

function riskPillClass(level: RiskLevel | undefined): string {
  if (level === "green") return "status-ok";
  if (level === "yellow") return "status-warn";
  if (level === "red") return "status-risk";
  return "status-pending";
}

export function HourProgressRing({
  rings,
  stats,
  riskLevel,
  riskLabel,
}: {
  rings: HourRing[];
  stats: HourLegendStat[];
  riskLevel: RiskLevel | undefined;
  riskLabel: string;
}) {
  const headline = rings[0];

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
      <div className="relative shrink-0" style={{ width: 200, height: 200 }}>
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="h-[200px] w-[200px] -rotate-90"
          role="img"
          aria-label={`Licensure progress: ${headline.pct}% of ${fmt(
            headline.max
          )} supervised hours`}
        >
          {rings.map((ring, i) => {
            const r = RADII[i] ?? RADII[RADII.length - 1];
            const circ = 2 * Math.PI * r;
            return (
              <g key={ring.key}>
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={r}
                  fill="none"
                  stroke="var(--divider)"
                  strokeWidth={STROKE}
                />
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={r}
                  fill="none"
                  stroke={RING_COLOR[ring.key]}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  strokeDashoffset={circ * (1 - ring.fraction)}
                />
              </g>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
          <span className="font-mono text-4xl font-bold leading-none text-[color:var(--text-primary)]">
            {headline.pct}%
          </span>
          <span className={`status-pill ${riskPillClass(riskLevel)}`}>
            {riskLabel}
          </span>
        </div>
      </div>

      <ul className="flex w-full flex-col gap-3 sm:w-auto">
        {rings.map((ring) => (
          <LegendRow
            key={ring.key}
            dot={RING_COLOR[ring.key]}
            kind="ring"
            label={ring.label}
            value={ring.value}
            max={ring.max}
            met={ring.met}
          />
        ))}
        {stats.map((stat) => (
          <LegendRow
            key={stat.key}
            dot={STAT_DOT[stat.key]}
            kind="stat"
            label={stat.label}
            value={stat.value}
            max={stat.max}
            met={stat.met}
          />
        ))}
      </ul>
    </div>
  );
}

function LegendRow({
  dot,
  kind,
  label,
  value,
  max,
  met,
}: {
  dot: string;
  /** "ring" = ring-backed (filled dot); "stat" = legend-only, no corresponding
   *  arc in the chart (hollow dot so viewers don't look for a missing ring). */
  kind: "ring" | "stat";
  label: string;
  value: number;
  max: number | null;
  met: boolean;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
        style={
          kind === "stat"
            ? { background: "transparent", border: `1.5px solid ${dot}` }
            : { background: dot }
        }
        aria-hidden
      />
      <div className="min-w-0">
        <p className="label-overline">{label}</p>
        <p className="mt-0.5 font-mono text-sm">
          <span className="text-[color:var(--text-primary)]">{fmt(value)}</span>
          {max != null ? (
            <span className="text-[color:var(--text-muted)]"> / {fmt(max)}</span>
          ) : (
            <span className="text-[color:var(--text-muted)]"> hrs</span>
          )}
          {met && (
            <span className="text-[color:var(--text-muted)]"> · Met</span>
          )}
        </p>
      </div>
    </li>
  );
}
