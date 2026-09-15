import { AlertOctagon, AlertTriangle, Circle } from "lucide-react";

/**
 * Token-native roster preview for the marketing surface. Replaces the old
 * raster app screenshot (which carried a v1 navy button) with a real component
 * built from the v2 design system — warm paper ground, severity ladder badges
 * (§7.1), critical-row left border (§7.2), mono hour counts (§12.3). Light-only,
 * matches the app roster without embedding pre-redesign UI.
 */

type Status = "at-risk" | "attention" | "on-track";

type Row = {
  name: string;
  credential: string;
  hours: string;
  /** 0–100 fill for the progress track */
  pct: number;
  status: Status;
  pending: number;
};

const rows: Row[] = [
  { name: "Jordan Williams", credential: "TX · LPC-Associate", hours: "319.1h", pct: 18, status: "at-risk", pending: 3 },
  { name: "Emily Chen", credential: "NC · LCMHCA", hours: "2,405.3h", pct: 80, status: "attention", pending: 3 },
  { name: "Marcus Rivera", credential: "CA · APCC", hours: "2,837.5h", pct: 71, status: "at-risk", pending: 3 },
  { name: "Sofia Patel", credential: "FL · RMHCI", hours: "712.0h", pct: 36, status: "at-risk", pending: 3 },
  { name: "Aisha Thompson", credential: "AZ · LAC", hours: "1,888.5h", pct: 63, status: "on-track", pending: 3 },
];

function StatusBadge({ status }: { status: Status }) {
  if (status === "at-risk") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--risk-600)] px-2.5 py-1 text-xs font-medium text-white">
        <AlertOctagon className="h-3 w-3" strokeWidth={2} />
        At risk
      </span>
    );
  }
  if (status === "attention") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--warn-500)] px-2.5 py-1 text-xs font-medium text-[color:var(--warn-700)]">
        <AlertTriangle className="h-3 w-3" strokeWidth={2} />
        Needs attention
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--ok-700)]">
      <Circle className="h-2 w-2 fill-current" />
      On track
    </span>
  );
}

export function RosterPreview() {
  return (
    <div className="panel panel-flush">
      <div className="flex items-center justify-between border-b border-[color:var(--ink-200)] px-5 py-4">
        <h3 className="font-display text-lg font-semibold text-foreground">
          Supervisor roster
        </h3>
        <span className="font-mono text-xs text-[color:var(--ink-500)]">
          5 supervisees · 4 need review
        </span>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[color:var(--ink-200)] bg-[color:var(--paper-100)]">
            <th scope="col" className="label-overline px-5 py-2.5 text-left">Name</th>
            <th scope="col" className="label-overline px-5 py-2.5 text-left">Credential</th>
            <th scope="col" className="label-overline hidden px-5 py-2.5 text-left sm:table-cell">Practice hrs</th>
            <th scope="col" className="label-overline px-5 py-2.5 text-left">Status</th>
            <th scope="col" className="label-overline px-5 py-2.5 text-right">Pending</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const critical = r.status === "at-risk";
            return (
              <tr
                key={r.name}
                className={`border-b border-[color:var(--ink-100)] bg-[color:var(--paper-white)] last:border-b-0 ${
                  critical ? "border-l-[3px] border-l-[color:var(--risk-600)]" : ""
                }`}
                style={critical ? { background: "color-mix(in srgb, var(--risk-50) 30%, var(--paper-white))" } : undefined}
              >
                <td className="px-5 py-3.5 font-medium text-foreground">{r.name}</td>
                <td className="px-5 py-3.5 text-[color:var(--ink-600)]">{r.credential}</td>
                <td className="hidden px-5 py-3.5 sm:table-cell">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-20 overflow-hidden rounded-full bg-[color:var(--ink-100)]">
                      <span
                        className="block h-full rounded-full bg-[color:var(--seal-gold)]"
                        style={{ width: `${r.pct}%` }}
                      />
                    </span>
                    <span className="font-mono text-xs text-[color:var(--ink-700)]">{r.hours}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-5 py-3.5 text-right font-mono text-xs text-[color:var(--ink-600)]">
                  {r.pending}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
