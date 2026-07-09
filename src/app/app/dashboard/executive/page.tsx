import Link from "next/link";
import {
  ArrowLeft,
  Users,
  AlertTriangle,
  FileSignature,
  ShieldCheck,
  CalendarClock,
  CalendarX,
} from "lucide-react";
import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import {
  getCurrentMembership,
  requireExecutiveOrHrAdmin,
} from "@/lib/authz";
import { riskBadgeLabel } from "@/lib/rules";
import { db, schema } from "@/lib/db";
import { getOrgRosterWithCompliance } from "@/lib/db/roster-queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Executive — AuditHalo" };
export const dynamic = "force-dynamic";

/**
 * Read-only practice-wide rollup for Executive and HR Admin roles.
 *
 * Executive lands here automatically (see /dashboard/page.tsx routing).
 * HR Admin can reach it via the dashboard nav — they get the same view
 * since the data is org-wide regardless.
 *
 * Strict no-PHI posture: AI session note content is NOT rendered here.
 * Only metadata (date, supervisor, supervisee name, hour math, risk badge).
 */
export default async function ExecutiveDashboardPage() {
  const session = await requireExecutiveOrHrAdmin();
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return null;
  }

  const [org, roster, members, monthStats] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(schema.organizations.id, membership.orgId),
      columns: { id: true, name: true, subscriptionTier: true },
    }),
    getOrgRosterWithCompliance(membership.orgId),
    db.query.orgMemberships.findMany({
      where: and(
        eq(schema.orgMemberships.orgId, membership.orgId),
        isNull(schema.orgMemberships.deactivatedAt)
      ),
    }),
    monthRollup(membership.orgId),
  ]);

  if (!org) return null;

  // Compute summary metrics off the roster (already includes risk eval).
  const totalSupervisees = roster.length;
  const atRiskCount = roster.filter(
    (r) =>
      r.evaluation?.riskLevel === "red" ||
      r.evaluation?.riskLevel === "yellow"
  ).length;
  const onTrackCount = roster.filter(
    (r) => r.evaluation?.riskLevel === "green"
  ).length;

  // Audit-readiness score = % of supervisees with no warning-level gaps.
  // Floor at 0 / cap at 100; show "—" when there's no roster yet.
  const auditReadinessScore =
    totalSupervisees === 0
      ? null
      : Math.round((onTrackCount / totalSupervisees) * 100);

  // Pending signature breakdown by primary supervisor.
  const supervisorAssignments = await db.query.supervisorAssignments.findMany({
    where: and(
      eq(schema.supervisorAssignments.orgId, membership.orgId),
      eq(schema.supervisorAssignments.isPrimary, true),
      isNull(schema.supervisorAssignments.endedAt)
    ),
  });

  const supervisorMap = new Map<string, string>(); // supervisorUserId → name
  const supervisorIds = supervisors(members).map((m) => m.userId);
  const supervisorUsers =
    supervisorIds.length > 0
      ? await db.query.users.findMany({
          where: inArray(schema.users.id, supervisorIds),
        })
      : [];
  for (const u of supervisorUsers) {
    supervisorMap.set(u.id, u.name ?? u.email);
  }

  // For each primary supervisor, sum their supervisees' pending sigs.
  const pendingBySupervisor = new Map<string, number>();
  for (const a of supervisorAssignments) {
    if (!a.supervisorId || !a.superviseeId) continue;
    const sve = roster.find((r) => r.userId === a.superviseeId);
    if (!sve) continue;
    pendingBySupervisor.set(
      a.supervisorId,
      (pendingBySupervisor.get(a.supervisorId) ?? 0) + sve.pendingSignatureCount
    );
  }
  const totalPendingSigs = [...pendingBySupervisor.values()].reduce(
    (s, n) => s + n,
    0
  );

  // Top 8 supervisees by risk (red first, then yellow), then by lowest progress.
  const needsAttention = roster
    .filter(
      (r) =>
        r.evaluation?.riskLevel === "red" ||
        r.evaluation?.riskLevel === "yellow"
    )
    .sort((a, b) => {
      const aRed = a.evaluation?.riskLevel === "red" ? 0 : 1;
      const bRed = b.evaluation?.riskLevel === "red" ? 0 : 1;
      if (aRed !== bRed) return aRed - bRed;
      const aPct = a.evaluation?.progress.practiceProgressPct ?? 0;
      const bPct = b.evaluation?.progress.practiceProgressPct ?? 0;
      return aPct - bPct;
    })
    .slice(0, 8);

  const superviseeToSupervisorName = new Map<string, string>();
  for (const a of supervisorAssignments) {
    if (!a.supervisorId || !a.superviseeId) continue;
    const name = supervisorMap.get(a.supervisorId);
    if (name) superviseeToSupervisorName.set(a.superviseeId, name);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-12">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/dashboard">
          <ArrowLeft />
          Back to dashboard
        </Link>
      </Button>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant="outline">Executive overview</Badge>
        {org.subscriptionTier === "enterprise" && (
          <Badge variant="outline">Enterprise</Badge>
        )}
      </div>
      <h1 className="font-display text-3xl sm:text-4xl font-semibold text-foreground break-words">
        {org.name}
      </h1>
      <p className="mt-2 text-foreground/70">
        {totalSupervisees === 0
          ? "No supervisees yet — invite some to populate this dashboard."
          : `Audit-readiness ${auditReadinessScore}% — ${onTrackCount} of ${totalSupervisees} supervisees on track.`}
      </p>

      {/* Summary cards */}
      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <SummaryCard
          label="Supervisees"
          value={totalSupervisees}
          Icon={Users}
        />
        <SummaryCard
          label="Need attention"
          value={atRiskCount}
          Icon={AlertTriangle}
          warn={atRiskCount > 0}
          good={atRiskCount === 0 && totalSupervisees > 0}
        />
        <SummaryCard
          label="Pending signatures"
          value={totalPendingSigs}
          Icon={FileSignature}
          warn={totalPendingSigs > 0}
        />
        <SummaryCard
          label="Supervision hrs this month"
          value={monthStats.supervisionHours}
          Icon={ShieldCheck}
          good
        />
      </div>

      {/* Scheduling rollup — Phase 5 additions. Sits below the headline
          cards so the existing four don't grow into a 6-up that breaks
          mobile layout. */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <SummaryCard
          label="Scheduled this week"
          value={monthStats.scheduledThisWeek}
          Icon={CalendarClock}
        />
        <SummaryCard
          label="No-shows last 30d"
          value={monthStats.noShowsLast30Days}
          Icon={CalendarX}
          warn={monthStats.noShowsLast30Days > 0}
          good={monthStats.noShowsLast30Days === 0}
        />
        <SummaryCard
          label="Sealed this month"
          value={monthStats.evidenceSealed}
          Icon={FileSignature}
          good
        />
      </div>

      {/* Needs attention — top 8 */}
      <div className="mt-10">
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">
          Needs attention
        </h2>
        {needsAttention.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-foreground/60">
                Every supervisee is on track. No flags to triage.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-accent text-left">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Supervisee</th>
                      <th className="px-5 py-3 font-semibold">Primary supervisor</th>
                      <th className="px-5 py-3 font-semibold">Credential</th>
                      <th className="px-5 py-3 font-semibold">Practice hrs</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {needsAttention.map((r) => {
                      const supName =
                        superviseeToSupervisorName.get(r.userId) ?? "—";
                      const practiceHrs =
                        r.evaluation?.totals.practiceHours ?? 0;
                      const riskLevel = r.evaluation?.riskLevel;
                      return (
                        <tr key={r.userId} className="border-t border-border">
                          <td className="px-5 py-3 font-medium">
                            <Link
                              href={`/dashboard/roster/${r.userId}`}
                              className="hover:underline"
                            >
                              {r.name}
                            </Link>
                          </td>
                          <td className="px-5 py-3 text-foreground/70">
                            {supName}
                          </td>
                          <td className="px-5 py-3 text-foreground/70">
                            {r.state && r.licenseType
                              ? `${r.state} · ${r.licenseType}`
                              : r.state ?? r.licenseType ?? "—"}
                          </td>
                          <td className="px-5 py-3 font-mono">
                            {practiceHrs.toFixed(1)}h
                          </td>
                          <td className="px-5 py-3">
                            {riskLevel ? (
                              <Badge
                                variant={
                                  riskLevel === "red"
                                    ? "risk"
                                    : riskLevel === "yellow"
                                      ? "warning"
                                      : "success"
                                }
                              >
                                {riskBadgeLabel(riskLevel)}
                              </Badge>
                            ) : (
                              <span className="text-foreground/40 italic text-xs">
                                No rule
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pending signatures by supervisor */}
      {totalPendingSigs > 0 && (
        <div className="mt-10">
          <h2 className="font-display text-xl font-semibold text-foreground mb-4">
            Pending signatures by supervisor
          </h2>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-accent text-left">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Supervisor</th>
                    <th className="px-5 py-3 font-semibold">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {[...pendingBySupervisor.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .filter(([, n]) => n > 0)
                    .map(([supervisorId, count]) => (
                      <tr
                        key={supervisorId}
                        className="border-t border-border"
                      >
                        <td className="px-5 py-3 font-medium">
                          {supervisorMap.get(supervisorId) ?? "—"}
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant="warning">{count}</Badge>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  Icon,
  warn,
  good,
}: {
  label: string;
  value: number;
  Icon: typeof Users;
  warn?: boolean;
  good?: boolean;
}) {
  const color = warn
    ? "text-[color:var(--color-warning)]"
    : good
      ? "text-[color:var(--color-success)]"
      : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <Icon className={`h-5 w-5 mb-2 sm:mb-3 ${color}`} strokeWidth={1.75} />
        <p className={`font-display text-2xl sm:text-3xl font-bold ${color}`}>
          {value}
        </p>
        <p className="mt-1 text-xs sm:text-sm text-foreground/60">{label}</p>
      </CardContent>
    </Card>
  );
}

function supervisors(
  members: (typeof schema.orgMemberships.$inferSelect)[]
): (typeof schema.orgMemberships.$inferSelect)[] {
  return members.filter((m) => m.role === "supervisor");
}

/**
 * Fast rollup of this calendar month's supervision activity. Two cheap
 * aggregate queries — keeps the executive dashboard well under 500ms even
 * on orgs with thousands of sessions.
 */
async function monthRollup(orgId: string): Promise<{
  supervisionHours: number;
  evidenceSealed: number;
  scheduledThisWeek: number;
  noShowsLast30Days: number;
}> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Mon-start week per the existing calendar view convention.
  const startOfWeek = new Date(now);
  const dow = (startOfWeek.getDay() + 6) % 7;
  startOfWeek.setDate(startOfWeek.getDate() - dow);
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60_000);

  const [hoursRow] = await db
    .select({
      total: sql<number>`COALESCE(SUM("duration_hours"), 0)::float`,
    })
    .from(schema.sessionEvents)
    .where(
      and(
        eq(schema.sessionEvents.orgId, orgId),
        eq(schema.sessionEvents.kind, "supervision"),
        gte(schema.sessionEvents.date, startOfMonth)
      )
    );

  const [packagesRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(schema.evidencePackages)
    .where(
      and(
        eq(schema.evidencePackages.orgId, orgId),
        gte(schema.evidencePackages.createdAt, startOfMonth)
      )
    );

  const [scheduledThisWeekRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(schema.sessionEvents)
    .where(
      and(
        eq(schema.sessionEvents.orgId, orgId),
        eq(schema.sessionEvents.scheduledStatus, "scheduled"),
        gte(schema.sessionEvents.date, startOfWeek),
        sql`${schema.sessionEvents.date} < ${endOfWeek}`
      )
    );

  const [noShowsRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(schema.sessionEvents)
    .where(
      and(
        eq(schema.sessionEvents.orgId, orgId),
        eq(schema.sessionEvents.scheduledStatus, "no_show"),
        gte(schema.sessionEvents.date, thirtyDaysAgo)
      )
    );

  return {
    supervisionHours: Math.round((hoursRow?.total ?? 0) * 10) / 10,
    evidenceSealed: packagesRow?.count ?? 0,
    scheduledThisWeek: scheduledThisWeekRow?.count ?? 0,
    noShowsLast30Days: noShowsRow?.count ?? 0,
  };
}
