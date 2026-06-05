import Link from "next/link";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Circle,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { RosterRow } from "@/lib/db/roster-queries";
import { computeOrgMetrics } from "@/lib/dashboard-metrics";

/**
 * Practice-scale panels — compliance score and a per-supervisee risk
 * distribution heatmap. Surfaced on the supervisor dashboard only when the
 * roster has at least PRACTICE_THRESHOLD supervisees; below that, the
 * existing summary cards + "Needs attention" list are enough.
 */
export const PRACTICE_THRESHOLD = 5;

export function PracticePanels({ roster }: { roster: RosterRow[] }) {
  const metrics = computeOrgMetrics(roster);

  return (
    <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp
              className="h-4 w-4 text-[color:var(--color-success)]"
              strokeWidth={1.75}
            />
            <p className="label-overline">Compliance score</p>
          </div>
          <p className="font-display text-5xl font-bold text-foreground">
            {metrics.complianceScorePct}%
          </p>
          <p className="mt-2 text-sm text-foreground/60">
            {metrics.onTrack} of {metrics.withEvaluation} evaluable supervisees
            are on track.
          </p>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity
              className="h-4 w-4 text-[color:var(--color-warning)]"
              strokeWidth={1.75}
            />
            <p className="label-overline">Risk distribution</p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {roster.map((r) => {
              const risk = r.evaluation?.riskLevel ?? null;
              const cls = (() => {
                if (risk === "green")
                  return "bg-[color:var(--color-success)] text-white";
                if (risk === "yellow")
                  return "bg-[color:var(--color-warning)] text-white";
                if (risk === "red")
                  return "bg-[color:var(--color-risk)] text-white";
                return "bg-muted text-foreground/70";
              })();
              const Icon =
                risk === "red"
                  ? AlertOctagon
                  : risk === "yellow"
                    ? AlertTriangle
                    : Circle;
              return (
                <li key={r.userId}>
                  <Link
                    href={`/dashboard/roster/${r.userId}`}
                    title={`${r.name} — ${risk ?? "no rule"}`}
                    className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium ${cls} hover:opacity-90`}
                  >
                    <Icon className="h-3 w-3" />
                    {r.name.split(" ")[0] ?? r.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
