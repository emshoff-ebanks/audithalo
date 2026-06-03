import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import {
  ArrowRight,
  Users,
  AlertTriangle,
  FileSignature,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { getCurrentMembership } from "@/lib/authz";
import { getOrgRosterWithCompliance } from "@/lib/db/roster-queries";
import { computeOrgMetrics, bottomAtRisk } from "@/lib/dashboard-metrics";
import { db, schema } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Props = { userId: string; userName: string | null; userEmail: string };

export async function ExecutiveDashboard({
  userId,
  userName,
  userEmail,
}: Props) {
  const membership = await getCurrentMembership(userId);
  if (!membership) redirect("/login");

  const [roster, org] = await Promise.all([
    getOrgRosterWithCompliance(membership.orgId),
    db.query.organizations.findFirst({
      where: eq(schema.organizations.id, membership.orgId),
    }),
  ]);

  const metrics = computeOrgMetrics(roster);
  const atRisk = bottomAtRisk(roster, 3);

  // Stacked bar segments
  const total = metrics.withEvaluation;
  const greenPct = total > 0 ? (metrics.onTrack / total) * 100 : 0;
  const yellowPct = total > 0 ? (metrics.needsAttention / total) * 100 : 0;
  const redPct = total > 0 ? (metrics.atRisk / total) * 100 : 0;

  const scoreColor =
    metrics.complianceScorePct >= 80
      ? "text-[color:var(--color-success)]"
      : metrics.complianceScorePct >= 50
      ? "text-[color:var(--color-warning)]"
      : "text-[color:var(--color-risk)]";

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 sm:py-12">
      <Badge variant="outline" className="mb-3">
        Executive · {org?.name ?? "Practice"}
      </Badge>
      <h1 className="font-display text-3xl sm:text-4xl font-semibold text-foreground break-words">
        {userName ?? userEmail}
      </h1>

      {/* Compliance score — the hero number */}
      <Card className="mt-8">
        <CardContent className="p-6 sm:p-8">
          <p className="label-overline mb-2">Practice compliance score</p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span
              className={`font-display text-6xl sm:text-7xl font-bold ${scoreColor}`}
            >
              {metrics.complianceScorePct}%
            </span>
            <span className="text-foreground/60">
              {metrics.onTrack} of {metrics.withEvaluation} supervisees on track
            </span>
          </div>

          {/* Stacked risk distribution */}
          {total > 0 && (
            <div className="mt-6">
              <p className="label-overline mb-2">Risk distribution</p>
              <div className="flex h-3 rounded-sm overflow-hidden bg-muted">
                {greenPct > 0 && (
                  <div
                    className="bg-[color:var(--color-success)]"
                    style={{ width: `${greenPct}%` }}
                    title={`On track: ${metrics.onTrack}`}
                  />
                )}
                {yellowPct > 0 && (
                  <div
                    className="bg-[color:var(--color-warning)]"
                    style={{ width: `${yellowPct}%` }}
                    title={`Needs attention: ${metrics.needsAttention}`}
                  />
                )}
                {redPct > 0 && (
                  <div
                    className="bg-[color:var(--color-risk)]"
                    style={{ width: `${redPct}%` }}
                    title={`At risk: ${metrics.atRisk}`}
                  />
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-foreground/70">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[color:var(--color-success)]" />
                  On track {metrics.onTrack}
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[color:var(--color-warning)]" />
                  Needs attention {metrics.needsAttention}
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[color:var(--color-risk)]" />
                  At risk {metrics.atRisk}
                </span>
                {metrics.unassigned > 0 && (
                  <span className="flex items-center gap-2 text-foreground/50">
                    <span className="h-2 w-2 rounded-full bg-foreground/20" />
                    Unassigned {metrics.unassigned}
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          label="Supervisees"
          value={metrics.totalSupervisees}
          icon={Users}
        />
        <KpiCard
          label="Practice hrs (cumulative)"
          value={Math.round(metrics.totalPracticeHours)}
          icon={TrendingUp}
        />
        <KpiCard
          label="Supervision hrs"
          value={Math.round(metrics.totalSupervisionHours)}
          icon={CheckCircle2}
        />
        <KpiCard
          label="Pending signatures"
          value={metrics.totalPendingSignatures}
          icon={FileSignature}
          tone={metrics.totalPendingSignatures > 0 ? "warning" : "neutral"}
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

      {/* Bottom 3 at-risk */}
      {atRisk.length > 0 && (
        <div className="mt-10">
          <h2 className="font-display text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle
              className="h-5 w-5 text-[color:var(--color-warning)]"
              strokeWidth={1.75}
            />
            Top {atRisk.length} at-risk
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
                    hours · {r.evaluation?.gaps.length ?? 0} gap
                    {r.evaluation?.gaps.length !== 1 ? "s" : ""}
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
        <p className={`font-display text-3xl font-bold ${color}`}>
          {value.toLocaleString()}
        </p>
        <p className="mt-1 text-sm text-foreground/60">{label}</p>
      </CardContent>
    </Card>
  );
}
