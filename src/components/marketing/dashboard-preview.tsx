import {
  Users,
  AlertTriangle,
  FileSignature,
  CheckCircle2,
  Activity,
  TrendingUp,
  ArrowRight,
  AlertOctagon,
  Circle,
} from "lucide-react";

/**
 * Token-native HR-admin dashboard preview for the marketing surface. Replaces
 * the old raster app screenshot with a real component in the v2 language —
 * KPI panels (§7.4), severity ladder (§7.1), mono metrics (§12.3). Light-only.
 */

const kpis = [
  { icon: Users, value: "5", label: "Supervisees", tone: "text-foreground" },
  { icon: AlertTriangle, value: "4", label: "Need attention", tone: "text-[color:var(--warn-700)]" },
  { icon: FileSignature, value: "15", label: "Pending signatures", tone: "text-[color:var(--warn-700)]" },
  { icon: CheckCircle2, value: "1", label: "On track", tone: "text-[color:var(--ok-700)]" },
];

const risk: { name: string; level: "risk" | "warn" | "ok" }[] = [
  { name: "Jordan", level: "risk" },
  { name: "Emily", level: "warn" },
  { name: "Marcus", level: "risk" },
  { name: "Sofia", level: "risk" },
  { name: "Aisha", level: "ok" },
];

const attention = [
  { name: "Jordan Williams", meta: "319.1 practice hours logged · 3 pending signatures" },
  { name: "Emily Chen", meta: "2,405.3 practice hours logged · 3 pending signatures" },
  { name: "Marcus Rivera", meta: "2,837.5 practice hours logged · 3 pending signatures" },
  { name: "Sofia Patel", meta: "712.0 practice hours logged · 3 pending signatures" },
];

function RiskPill({ name, level }: { name: string; level: "risk" | "warn" | "ok" }) {
  if (level === "risk") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--risk-600)] px-2.5 py-1 text-xs font-medium text-white">
        <AlertOctagon className="h-3 w-3" strokeWidth={2} /> {name}
      </span>
    );
  }
  if (level === "warn") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--warn-500)] px-2.5 py-1 text-xs font-medium text-[color:var(--warn-700)]">
        <AlertTriangle className="h-3 w-3" strokeWidth={2} /> {name}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--ok-700)]/40 px-2.5 py-1 text-xs font-medium text-[color:var(--ok-700)]">
      <Circle className="h-2 w-2 fill-current" /> {name}
    </span>
  );
}

export function DashboardPreview() {
  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="panel">
            <k.icon className={`h-5 w-5 ${k.tone}`} strokeWidth={2} />
            <div className={`mt-3 font-display text-3xl font-bold ${k.tone}`}>{k.value}</div>
            <div className="label-overline mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Score + risk distribution */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.6fr]">
        <div className="panel">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[color:var(--ok-700)]" strokeWidth={2} />
            <span className="label-overline">Compliance score</span>
          </div>
          <div className="mt-3 font-display text-5xl font-bold text-foreground">20%</div>
          <p className="mt-2 text-sm text-[color:var(--ink-600)]">
            1 of 5 evaluable supervisees are on track.
          </p>
        </div>
        <div className="panel">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[color:var(--seal-gold)]" strokeWidth={2} />
            <span className="label-overline">Risk distribution</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {risk.map((r) => (
              <RiskPill key={r.name} {...r} />
            ))}
          </div>
        </div>
      </div>

      {/* Needs attention */}
      <div>
        <h3 className="mb-3 font-display text-xl font-semibold text-foreground">Needs attention</h3>
        <div className="space-y-2">
          {attention.map((a) => (
            <div
              key={a.name}
              className="flex items-center justify-between rounded-[10px] border border-[color:var(--ink-200)] bg-[color:var(--paper-100)] px-5 py-3.5"
            >
              <div>
                <div className="font-medium text-foreground">{a.name}</div>
                <div className="mt-0.5 text-sm text-[color:var(--ink-600)]">{a.meta}</div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-[color:var(--ink-400)]" strokeWidth={2} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
