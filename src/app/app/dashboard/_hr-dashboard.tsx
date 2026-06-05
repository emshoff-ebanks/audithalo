import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import {
  Users,
  AlertTriangle,
  FileSignature,
  CheckCircle2,
  ArrowRight,
  Activity,
  Circle,
  AlertOctagon,
} from "lucide-react";
import { getCurrentMembership } from "@/lib/authz";
import { getOrgRosterWithCompliance } from "@/lib/db/roster-queries";
import { computeOrgMetrics, bottomAtRisk } from "@/lib/dashboard-metrics";
import { riskBadgeVariant, riskBadgeLabel } from "@/lib/rules";
import { db, schema } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Props = { userId: string; userName: string | null; userEmail: string };

export async function HrDashboard({ userId, userName, userEmail }: Props) {
  const membership = await getCurrentMembership(userId);
  if (!membership) redirect("/login");

  const [roster, org] = await Promise.all([
    getOrgRosterWithCompliance(membership.orgId),
    db.query.organizations.findFirst({
      where: eq(schema.organizations.id, membership.orgId),
    }),
  ]);

  const metrics = computeOrgMetrics(roster);
  const atRisk = bottomAtRisk(roster, 5);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 sm:py-12">
      <Badge variant="outline" className="mb-3">
        HR · {org?.name ?? "Practice"}
      </Badge>
      <h1 className="font-display text-3xl sm:text-4xl font-semibold text-foreground break-words">
        {userName ?? userEmail}
      </h1>
      <p className="mt-2 text-foreground/70">
        {metrics.totalSupervisees} supervisee
        {metrics.totalSupervisees !== 1 ? "s" : ""} across the practice.
      </p>

      {/* Summary cards */}
      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          label="Supervisees"
          value={metrics.totalSupervisees}
          icon={Users}
        />
        <KpiCard
          label="At risk"
          value={metrics.atRisk + metrics.needsAttention}
          icon={AlertTriangle}
          tone={
            metrics.atRisk + metrics.needsAttention > 0 ? "warning" : "success"
          }
        />
        <KpiCard
          label="Pending signatures"
          value={metrics.totalPendingSignatures}
          icon={FileSignature}
          tone={metrics.totalPendingSignatures > 0 ? "warning" : "neutral"}
        />
        <KpiCard
          label="On track"
          value={metrics.onTrack}
          icon={CheckCircle2}
          tone="success"
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/dashboard/roster">
            View full roster <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/audit-log">Audit log</Link>
        </Button>
      </div>

      {/* Compliance heatmap */}
      <div className="mt-10">
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">
          Compliance heatmap
        </h2>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-accent">
                  <tr className="text-left">
                    <th className="px-5 py-3 font-semibold">Supervisee</th>
                    <th className="px-5 py-3 font-semibold">Rule</th>
                    <th className="px-5 py-3 font-semibold">Practice</th>
                    <th className="px-5 py-3 font-semibold">Supervision</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((r) => {
                    const practicePct =
                      r.evaluation?.progress.practiceProgressPct ?? 0;
                    const supPct =
                      r.evaluation?.progress.supervisionProgressPct ?? 0;
                    const rowBg = (() => {
                      if (r.evaluation?.riskLevel === "red")
                        return "bg-[color:var(--color-risk-50)]/30";
                      if (r.evaluation?.riskLevel === "yellow")
                        return "bg-[color:var(--color-warn-50)]/30";
                      return "";
                    })();
                    return (
                      <tr
                        key={r.userId}
                        className={`border-t border-border hover:bg-accent/40 ${rowBg}`}
                      >
                        <td className="px-5 py-3 font-medium">
                          <Link
                            href={`/dashboard/roster/${r.userId}`}
                            className="hover:underline"
                          >
                            {r.name}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-foreground/70">
                          {r.state && r.licenseType ? (
                            `${r.state} · ${r.licenseType}`
                          ) : (
                            <span className="italic text-foreground/40">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <ProgressCell
                            pct={practicePct}
                            hasRule={r.evaluation !== null}
                          />
                        </td>
                        <td className="px-5 py-3">
                          <ProgressCell
                            pct={supPct}
                            hasRule={r.evaluation !== null}
                          />
                        </td>
                        <td className="px-5 py-3">
                          {r.evaluation ? (
                            <Badge
                              variant={riskBadgeVariant(
                                r.evaluation.riskLevel
                              )}
                            >
                              {r.evaluation.riskLevel === "green" && (
                                <Circle className="h-2 w-2 fill-current" />
                              )}
                              {r.evaluation.riskLevel === "yellow" && (
                                <AlertTriangle className="h-3 w-3" />
                              )}
                              {r.evaluation.riskLevel === "red" && (
                                <AlertOctagon className="h-3 w-3" />
                              )}
                              {riskBadgeLabel(r.evaluation.riskLevel)}
                            </Badge>
                          ) : (
                            <span className="text-foreground/40 italic text-xs">
                              No rule
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {r.pendingSignatureCount > 0 ? (
                            <Badge variant="warning">
                              {r.pendingSignatureCount}
                            </Badge>
                          ) : (
                            <span className="text-foreground/40">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {roster.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-8 text-center text-foreground/50 text-sm"
                      >
                        No supervisees in this practice yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom 5 at-risk */}
      {atRisk.length > 0 && (
        <div className="mt-10">
          <h2 className="font-display text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity
              className="h-5 w-5 text-[color:var(--color-warning)]"
              strokeWidth={1.75}
            />
            Needs attention
          </h2>
          <div className="space-y-3">
            {atRisk.map((r) => (
              <Link
                key={r.userId}
                href={`/dashboard/roster/${r.userId}`}
                className="flex items-center justify-between p-4 rounded-sm border-l-[3px] border-l-[color:var(--color-warning)] bg-[color:var(--color-warning)]/5 hover:bg-[color:var(--color-warning)]/10 transition-colors"
              >
                <div>
                  <p className="font-medium text-foreground">{r.name}</p>
                  <p className="text-sm text-foreground/60">
                    {r.evaluation?.totals.practiceHours.toFixed(0)} practice
                    hours
                    {r.pendingSignatureCount > 0
                      ? ` · ${r.pendingSignatureCount} pending`
                      : ""}
                    {r.evaluation &&
                      ` · ${r.evaluation.gaps.length} gap${
                        r.evaluation.gaps.length !== 1 ? "s" : ""
                      }`}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-foreground/40 shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressCell({ pct, hasRule }: { pct: number; hasRule: boolean }) {
  if (!hasRule)
    return <span className="text-foreground/40 italic text-xs">—</span>;
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-[color:var(--color-gold)] transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="font-mono text-xs text-foreground/60">
        {clamped.toFixed(0)}%
      </span>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone?: "neutral" | "warning" | "success";
}) {
  const color =
    tone === "warning"
      ? "text-[color:var(--color-warning)]"
      : tone === "success"
      ? "text-[color:var(--color-success)]"
      : "text-foreground";
  return (
    <Card>
      <CardContent className="p-6">
        <Icon className={`h-5 w-5 mb-3 ${color}`} strokeWidth={1.75} />
        <p className={`font-display text-3xl font-bold ${color}`}>{value}</p>
        <p className="mt-1 text-sm text-foreground/60">{label}</p>
      </CardContent>
    </Card>
  );
}
