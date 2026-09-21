import Link from "next/link";
import {
  Users,
  AlertTriangle,
  AlertOctagon,
  Circle,
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
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="shell-eyebrow">Executive overview</p>
          <h1 className="shell-page-title mt-1 break-words">{org.name}</h1>
          <p className="shell-page-sub">
            {totalSupervisees === 0
              ? "No supervisees yet — invite some to populate this dashboard."
              : `Audit-readiness ${auditReadinessScore}% — ${onTrackCount} of ${totalSupervisees} supervisees on track.`}
          </p>
        </div>
        {org.subscriptionTier === "enterprise" && (
          <span className="status-pill status-sealed">Enterprise</span>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Supervisees" value={totalSupervisees} Icon={Users} />
        <SummaryCard
          label="Need attention"
          value={atRiskCount}
          Icon={AlertTriangle}
          hero
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

      {/* Scheduling rollup */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Scheduled this week" value={monthStats.scheduledThisWeek} Icon={CalendarClock} />
        <SummaryCard
          label="No-shows last 30d"
          value={monthStats.noShowsLast30Days}
          Icon={CalendarX}
          warn={monthStats.noShowsLast30Days > 0}
          good={monthStats.noShowsLast30Days === 0}
        />
        <SummaryCard label="Sealed this month" value={monthStats.evidenceSealed} Icon={FileSignature} good />
      </div>

      {/* Needs attention — top 8 */}
      <section>
        <h2 className="font-display text-xl font-semibold text-[color:var(--text-primary)] mb-3">
          Needs attention
        </h2>
        {needsAttention.length === 0 ? (
          <div className="panel text-center text-[color:var(--text-muted)]">
            Every supervisee is on track. No flags to triage.
          </div>
        ) : (
          <div className="panel panel-flush overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left border-b border-[color:var(--border)] bg-[color:var(--surface-muted)]">
                  <th className="px-5 py-3 label-overline">Supervisee</th>
                  <th className="px-5 py-3 label-overline">Primary supervisor</th>
                  <th className="px-5 py-3 label-overline">Credential</th>
                  <th className="px-5 py-3 label-overline">Practice hrs</th>
                  <th className="px-5 py-3 label-overline">Status</th>
                </tr>
              </thead>
              <tbody>
                {needsAttention.map((r) => {
                  const supName = superviseeToSupervisorName.get(r.userId) ?? "—";
                  const practiceHrs = r.evaluation?.totals.practiceHours ?? 0;
                  const riskLevel = r.evaluation?.riskLevel;
                  return (
                    <tr key={r.userId} className="border-b border-[color:var(--divider)]">
                      <td className="px-5 py-3 font-medium text-[color:var(--text-primary)]">
                        <Link href={`/dashboard/roster/${r.userId}`} className="hover:underline">
                          {r.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-[color:var(--text-secondary)]">{supName}</td>
                      <td className="px-5 py-3 text-[color:var(--text-secondary)]">
                        {r.state && r.licenseType
                          ? `${r.state} · ${r.licenseType}`
                          : r.state ?? r.licenseType ?? "—"}
                      </td>
                      <td className="px-5 py-3 font-mono text-[color:var(--text-primary)]">
                        {practiceHrs.toFixed(1)}h
                      </td>
                      <td className="px-5 py-3">
                        {riskLevel ? <RiskPill level={riskLevel} /> : (
                          <span className="text-[color:var(--text-muted)] italic text-xs">No rule</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pending signatures by supervisor */}
      {totalPendingSigs > 0 && (
        <section>
          <h2 className="font-display text-xl font-semibold text-[color:var(--text-primary)] mb-3">
            Pending signatures by supervisor
          </h2>
          <div className="panel panel-flush overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-[color:var(--border)] bg-[color:var(--surface-muted)]">
                  <th className="px-5 py-3 label-overline">Supervisor</th>
                  <th className="px-5 py-3 label-overline">Pending</th>
                </tr>
              </thead>
              <tbody>
                {[...pendingBySupervisor.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .filter(([, n]) => n > 0)
                  .map(([supervisorId, count]) => (
                    <tr key={supervisorId} className="border-b border-[color:var(--divider)]">
                      <td className="px-5 py-3 font-medium text-[color:var(--text-primary)]">
                        {supervisorMap.get(supervisorId) ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span className="status-pill status-warn">{count}</span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

/** Severity status pill (design-system-v2.md §7.1, §13). */
function RiskPill({ level }: { level: "green" | "yellow" | "red" }) {
  const cls = level === "red" ? "status-risk" : level === "yellow" ? "status-warn" : "status-ok";
  return (
    <span className={`status-pill ${cls}`}>
      {level === "green" && <Circle className="h-2 w-2 fill-current" />}
      {level === "yellow" && <AlertTriangle className="h-3 w-3" />}
      {level === "red" && <AlertOctagon className="h-3 w-3" />}
      {riskBadgeLabel(level)}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  Icon,
  warn,
  good,
  hero,
}: {
  label: string;
  value: number;
  Icon: typeof Users;
  warn?: boolean;
  good?: boolean;
  hero?: boolean;
}) {
  const numTone = warn
    ? "text-[color:var(--warn-700)]"
    : good
      ? "text-[color:var(--ok-700)]"
      : "text-[color:var(--text-primary)]";
  const iconTone = warn
    ? "text-[color:var(--warn-500)]"
    : good
      ? "text-[color:var(--ok-700)]"
      : "text-[color:var(--text-secondary)]";
  return (
    <div className={`panel flex flex-col gap-3${hero ? " panel-hero" : ""}`}>
      <Icon
        className={`h-5 w-5 ${hero ? "text-[color:var(--ink-900)]" : iconTone}`}
        strokeWidth={2}
      />
      <div>
        <p
          className={`font-display text-3xl font-bold leading-none ${
            hero ? "text-[color:var(--ink-900)]" : numTone
          }`}
        >
          {value}
        </p>
        <p className={`label-overline mt-2 ${hero ? "!text-[color:var(--ink-900)]/70" : ""}`}>
          {label}
        </p>
      </div>
    </div>
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
