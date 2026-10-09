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
  ClipboardCheck,
  ArrowRight,
  UserPlus,
  Mail,
  CreditCard,
  Plug,
  Database,
} from "lucide-react";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getOrgRosterWithCompliance } from "@/lib/db/roster-queries";
import { riskBadgeLabel } from "@/lib/rules";
import { seatCap } from "@/lib/billing/seats";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { Button } from "@/components/ui/button";
import { BillingBanner } from "./_billing-banner";
import { PendingInviteActions } from "./roster/pending-invite-actions";

type Role = "hr_admin" | "executive";

type Props = {
  role: Role;
  orgId: string;
  viewerUserId: string;
};

export async function AdminOverview({ role, orgId }: Props) {
  const isHrAdmin = role === "hr_admin";

  const [org, roster, members, monthStats, auditEntries] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(schema.organizations.id, orgId),
    }),
    getOrgRosterWithCompliance(orgId),
    db.query.orgMemberships.findMany({
      where: and(
        eq(schema.orgMemberships.orgId, orgId),
        isNull(schema.orgMemberships.deactivatedAt)
      ),
    }),
    monthRollup(orgId),
    db.query.auditLogEntries.findMany({
      where: eq(schema.auditLogEntries.orgId, orgId),
      orderBy: [desc(schema.auditLogEntries.createdAt)],
      limit: 10,
    }),
  ]);

  if (!org) return null;

  // Summary metrics from the compliance-evaluated roster.
  const totalSupervisees = roster.length;
  const atRiskCount = roster.filter(
    (r) =>
      r.evaluation?.riskLevel === "red" ||
      r.evaluation?.riskLevel === "yellow"
  ).length;
  const onTrackCount = roster.filter(
    (r) => r.evaluation?.riskLevel === "green"
  ).length;
  const auditReadinessScore =
    totalSupervisees === 0
      ? null
      : Math.round((onTrackCount / totalSupervisees) * 100);
  const totalPendingSigs = roster.reduce(
    (s, r) => s + r.pendingSignatureCount,
    0
  );

  // Supervisor map + per-supervisor pending-sigs rollup.
  const supervisorAssignments = await db.query.supervisorAssignments.findMany({
    where: and(
      eq(schema.supervisorAssignments.orgId, orgId),
      eq(schema.supervisorAssignments.isPrimary, true),
      isNull(schema.supervisorAssignments.endedAt)
    ),
  });
  const supervisorIds = members
    .filter((m) => m.role === "supervisor")
    .map((m) => m.userId);
  const supervisorUsers =
    supervisorIds.length > 0
      ? await db.query.users.findMany({
          where: inArray(schema.users.id, supervisorIds),
        })
      : [];
  const supervisorMap = new Map<string, string>();
  for (const u of supervisorUsers) {
    supervisorMap.set(u.id, u.name ?? u.email);
  }
  const pendingBySupervisor = new Map<string, number>();
  const superviseeToSupervisorName = new Map<string, string>();
  for (const a of supervisorAssignments) {
    if (!a.supervisorId || !a.superviseeId) continue;
    const sve = roster.find((r) => r.userId === a.superviseeId);
    if (!sve) continue;
    pendingBySupervisor.set(
      a.supervisorId,
      (pendingBySupervisor.get(a.supervisorId) ?? 0) + sve.pendingSignatureCount
    );
    const name = supervisorMap.get(a.supervisorId);
    if (name) superviseeToSupervisorName.set(a.superviseeId, name);
  }

  // Top 5 at-risk supervisees — red first, then yellow, then lowest progress.
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
    .slice(0, 5);

  // HR-Admin-only extras: pending invites + practice-hours queue + integrations count.
  const [pendingInvites, pendingPracticeByUser, activeIntegrationsCount] =
    isHrAdmin
      ? await Promise.all([
          db.query.invitations.findMany({
            where: and(
              eq(schema.invitations.orgId, orgId),
              eq(schema.invitations.role, "supervisee"),
              isNull(schema.invitations.acceptedAt)
            ),
          }),
          db
            .select({
              superviseeId: schema.sessionEvents.superviseeId,
              count: sql<number>`COUNT(*)::int`,
            })
            .from(schema.sessionEvents)
            .where(
              and(
                eq(schema.sessionEvents.orgId, orgId),
                eq(schema.sessionEvents.kind, "practice"),
                isNull(schema.sessionEvents.approvedAt)
              )
            )
            .groupBy(schema.sessionEvents.superviseeId),
          db
            .select({ count: sql<number>`COUNT(DISTINCT user_id)::int` })
            .from(schema.userCalendarIntegrations)
            .where(isNull(schema.userCalendarIntegrations.disconnectedAt))
            .then((rows) => rows[0]?.count ?? 0),
        ])
      : [[], [] as { superviseeId: string | null; count: number }[], 0];

  const totalPendingPractice = pendingPracticeByUser.reduce(
    (s, r) => s + r.count,
    0
  );
  const nameByUserId = new Map(roster.map((r) => [r.userId, r.name || r.email]));

  const usedSeats = members.filter((m) => m.role === "supervisee").length;
  const cap = seatCap(org);
  const seatCapDisplay = cap === null ? "unlimited" : String(cap);

  const paycor = org.paycorConfig as
    | { lastSyncAt?: string; lastSyncStatus?: string }
    | null
    | undefined;

  // Header
  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="shell-eyebrow">
          {org.name}
          {org.subscriptionTier === "enterprise" && (
            <span className="ml-2 status-pill status-sealed align-middle">
              Enterprise
            </span>
          )}
        </p>
        <h1 className="shell-page-title mt-1 break-words">Overview</h1>
        <p className="shell-page-sub">
          {totalSupervisees === 0
            ? "No supervisees yet — invite some to populate this dashboard."
            : `Audit-readiness ${auditReadinessScore}% — ${onTrackCount} of ${totalSupervisees} supervisees on track.`}
        </p>
      </div>
    </div>
  );

  // Zero-state: no roster yet.
  if (totalSupervisees === 0) {
    return (
      <div className="flex flex-col gap-6">
        {isHrAdmin && <BillingBanner org={org} />}
        {header}
        <div className="panel flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3 min-w-0">
            <UserPlus
              className="h-6 w-6 shrink-0 text-[color:var(--seal-gold)] mt-0.5"
              strokeWidth={2}
            />
            <div className="min-w-0">
              <h3 className="font-display text-lg font-semibold text-[color:var(--text-primary)]">
                Get started
              </h3>
              <p className="mt-1 text-sm text-[color:var(--text-secondary)] leading-relaxed">
                {isHrAdmin
                  ? "Invite your supervisors first, then your supervisees. Supervisors run their own rosters; HR Admins see the whole org."
                  : "This org has no supervisees yet. Ask an HR Admin to invite your team."}
              </p>
            </div>
          </div>
          {isHrAdmin && (
            <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/team">
                  Invite supervisor
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/dashboard/roster">
                  Invite supervisee
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {isHrAdmin && <BillingBanner org={org} />}
      {header}

      {/* Audit-readiness hero */}
      <section className="panel panel-hero flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="label-overline !text-[color:var(--ink-900)]/70">
            Audit readiness
          </p>
          <p className="mt-2 font-display text-5xl font-bold leading-none text-[color:var(--ink-900)] tabular-nums">
            {auditReadinessScore}%
          </p>
          <p className="mt-2 font-mono text-sm text-[color:var(--ink-900)]/80">
            {onTrackCount} / {totalSupervisees} supervisees on track
          </p>
        </div>
        {atRiskCount > 0 && (
          <div className="text-right">
            <p className="label-overline !text-[color:var(--ink-900)]/70">
              Flagged
            </p>
            <p className="mt-2 font-display text-2xl font-semibold text-[color:var(--ink-900)] tabular-nums">
              {atRiskCount}
            </p>
            <p className="mt-1 text-xs text-[color:var(--ink-900)]/70">
              {atRiskCount === 1 ? "supervisee" : "supervisees"} need attention
            </p>
          </div>
        )}
      </section>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Supervisees"
          value={totalSupervisees}
          Icon={Users}
          href="/dashboard/roster"
        />
        <KpiCard
          label="Need attention"
          value={atRiskCount}
          Icon={AlertTriangle}
          warn={atRiskCount > 0}
          href="/dashboard/roster?filter=at-risk"
        />
        <KpiCard
          label="Pending signatures"
          value={totalPendingSigs}
          Icon={FileSignature}
          warn={totalPendingSigs > 0}
          href={isHrAdmin ? "/dashboard/signature-queue" : undefined}
        />
        <KpiCard
          label="Supervision hrs this month"
          value={monthStats.supervisionHours}
          Icon={ShieldCheck}
          good={monthStats.supervisionHours > 0}
        />
      </div>

      {/* 2-col grid: Needs attention + role-split right */}
      <div className="grid gap-6 lg:grid-cols-2">
        <NeedsAttentionPanel
          needsAttention={needsAttention}
          superviseeToSupervisorName={superviseeToSupervisorName}
          pendingInvites={isHrAdmin ? pendingInvites : []}
          pendingPracticeByUser={isHrAdmin ? pendingPracticeByUser : []}
          totalPendingPractice={totalPendingPractice}
          showHrSections={isHrAdmin}
          nameByUserId={nameByUserId}
        />

        {isHrAdmin ? (
          <OrgHealthPanel
            org={org}
            usedSeats={usedSeats}
            seatCapDisplay={seatCapDisplay}
            activeIntegrationsCount={activeIntegrationsCount}
            paycor={paycor ?? null}
          />
        ) : (
          <MonthlyVolumePanel monthStats={monthStats} />
        )}
      </div>

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
              <tbody className="row-zebra">
                {[...pendingBySupervisor.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .filter(([, n]) => n > 0)
                  .map(([supervisorId, count]) => (
                    <tr
                      key={supervisorId}
                      className="border-b border-[color:var(--divider)]"
                    >
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

      {/* Recent activity */}
      {auditEntries.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-3">
            <h2 className="font-display text-xl font-semibold text-[color:var(--text-primary)]">
              Recent activity
            </h2>
            <Link
              href="/dashboard/audit-log"
              className="text-xs font-medium text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
            >
              View all audit log &rarr;
            </Link>
          </div>
          <RecentActivityPanel
            entries={auditEntries}
            actorNames={supervisorMap}
          />
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  Icon,
  warn,
  good,
  href,
}: {
  label: string;
  value: number;
  Icon: typeof Users;
  warn?: boolean;
  good?: boolean;
  href?: string;
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
  const body = (
    <div className="panel flex flex-col gap-3 h-full">
      <Icon className={`h-5 w-5 ${iconTone}`} strokeWidth={2} />
      <div>
        <p
          className={`font-display text-3xl font-bold leading-none tabular-nums ${numTone}`}
        >
          {value}
        </p>
        <p className="label-overline mt-2">{label}</p>
      </div>
    </div>
  );
  if (!href) return body;
  return (
    <Link
      href={href}
      className="block transition-colors hover:[&_.panel]:border-[color:var(--border-strong)]"
    >
      {body}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Needs-attention combined panel
// ---------------------------------------------------------------------------

type RosterRowLike = Awaited<ReturnType<typeof getOrgRosterWithCompliance>>[number];

function NeedsAttentionPanel({
  needsAttention,
  superviseeToSupervisorName,
  pendingInvites,
  pendingPracticeByUser,
  totalPendingPractice,
  showHrSections,
  nameByUserId,
}: {
  needsAttention: RosterRowLike[];
  superviseeToSupervisorName: Map<string, string>;
  pendingInvites: (typeof schema.invitations.$inferSelect)[];
  pendingPracticeByUser: { superviseeId: string | null; count: number }[];
  totalPendingPractice: number;
  showHrSections: boolean;
  nameByUserId: Map<string, string>;
}) {
  const hasInvites = showHrSections && pendingInvites.length > 0;
  const hasPractice = showHrSections && totalPendingPractice > 0;

  return (
    <section className="panel panel-flush flex flex-col">
      <SubSectionHeader
        Icon={AlertTriangle}
        title="At-risk supervisees"
        count={needsAttention.length}
      />
      <div className="row-zebra">
        {needsAttention.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[color:var(--text-muted)] text-center">
            Everyone is on track.
          </p>
        ) : (
          needsAttention.map((r) => {
            const displayName = r.name || r.email;
            const metaParts = [r.state, r.licenseType].filter(Boolean);
            const level = r.evaluation?.riskLevel;
            const supName =
              superviseeToSupervisorName.get(r.userId) ?? null;
            return (
              <Link
                key={r.userId}
                href={`/dashboard/roster/${r.userId}`}
                className="flex items-center gap-3 px-5 py-3 border-b border-[color:var(--divider)] last:border-b-0 transition-colors"
              >
                <InitialsAvatar name={displayName} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-medium text-[color:var(--text-primary)] truncate">
                      {displayName}
                    </span>
                    {metaParts.length > 0 && (
                      <span className="text-xs text-[color:var(--text-muted)]">
                        {metaParts.join(" · ")}
                      </span>
                    )}
                  </div>
                  {supName && (
                    <p className="text-xs text-[color:var(--text-secondary)] mt-0.5">
                      Supervisor: {supName}
                    </p>
                  )}
                </div>
                {level && <RiskPill level={level} />}
              </Link>
            );
          })
        )}
      </div>

      {hasInvites && (
        <>
          <div className="border-t border-[color:var(--divider)]" />
          <SubSectionHeader
            Icon={Mail}
            title="Pending invites"
            count={pendingInvites.length}
          />
          <div className="row-zebra">
            {pendingInvites.slice(0, 5).map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-3 px-5 py-3 border-b border-[color:var(--divider)] last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[color:var(--text-primary)] truncate">
                    {inv.name || inv.email}
                  </p>
                  <p className="text-xs text-[color:var(--text-muted)] truncate">
                    {inv.email}
                  </p>
                </div>
                <PendingInviteActions
                  invitationId={inv.id}
                  email={inv.email}
                />
              </div>
            ))}
            {pendingInvites.length > 5 && (
              <Link
                href="/dashboard/roster"
                className="block px-5 py-2.5 text-xs font-medium text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
              >
                +{pendingInvites.length - 5} more &rarr;
              </Link>
            )}
          </div>
        </>
      )}

      {hasPractice && (
        <>
          <div className="border-t border-[color:var(--divider)]" />
          <SubSectionHeader
            Icon={ClipboardCheck}
            title="Practice hours awaiting approval"
            count={totalPendingPractice}
          />
          <div className="row-zebra">
            {pendingPracticeByUser
              .filter((r) => r.superviseeId)
              .slice(0, 5)
              .map((r) => (
                <Link
                  key={r.superviseeId!}
                  href={`/dashboard/roster/${r.superviseeId}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[color:var(--divider)] last:border-b-0"
                >
                  <span className="text-sm text-[color:var(--text-primary)]">
                    {nameByUserId.get(r.superviseeId!) ?? "Supervisee"}
                  </span>
                  <span className="status-pill status-warn">{r.count}</span>
                </Link>
              ))}
          </div>
        </>
      )}
    </section>
  );
}

function SubSectionHeader({
  Icon,
  title,
  count,
}: {
  Icon: typeof AlertTriangle;
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 px-5 py-3 border-b border-[color:var(--divider)] bg-[color:var(--surface-muted)]">
      <Icon
        className="h-4 w-4 shrink-0 text-[color:var(--text-secondary)]"
        strokeWidth={2}
      />
      <h3 className="font-display text-sm font-semibold text-[color:var(--text-primary)]">
        {title}
      </h3>
      {count > 0 && (
        <span className="ml-auto text-xs text-[color:var(--text-muted)] tabular-nums">
          {count}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Org Health panel (HR Admin)
// ---------------------------------------------------------------------------

function OrgHealthPanel({
  org,
  usedSeats,
  seatCapDisplay,
  activeIntegrationsCount,
  paycor,
}: {
  org: typeof schema.organizations.$inferSelect;
  usedSeats: number;
  seatCapDisplay: string;
  activeIntegrationsCount: number;
  paycor: { lastSyncAt?: string; lastSyncStatus?: string } | null;
}) {
  const billingLabel = (() => {
    const s = org.subscriptionStatus;
    if (!s) return "No plan";
    if (s === "trialing") return "Trial";
    if (s === "active") return "Active";
    if (s === "past_due") return "Past due";
    return s;
  })();
  const billingTone =
    org.subscriptionStatus === "past_due"
      ? "status-risk"
      : org.subscriptionStatus === "trialing"
        ? "status-warn"
        : org.subscriptionStatus === "active"
          ? "status-ok"
          : "status-neutral";

  const paycorLine = paycor?.lastSyncAt
    ? `Last sync ${formatRelative(new Date(paycor.lastSyncAt))}`
    : org.paycorConfig
      ? "Configured — not yet synced"
      : "Not configured";

  return (
    <section className="panel flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-[color:var(--divider)]">
        <h2 className="font-display text-lg font-semibold text-[color:var(--text-primary)]">
          Org health
        </h2>
      </div>

      <HealthRow Icon={CreditCard} label="Billing">
        <Link
          href="/dashboard/billing"
          className={`status-pill ${billingTone} hover:opacity-90`}
        >
          {billingLabel}
        </Link>
      </HealthRow>

      <HealthRow Icon={Users} label="Seat usage">
        <span className="font-mono text-sm text-[color:var(--text-primary)]">
          {usedSeats} / {seatCapDisplay}
        </span>
      </HealthRow>

      <HealthRow Icon={Plug} label="Calendar integrations">
        <span className="font-mono text-sm text-[color:var(--text-primary)]">
          {activeIntegrationsCount} connected
        </span>
      </HealthRow>

      <HealthRow Icon={Database} label="Paycor sync">
        <span className="text-sm text-[color:var(--text-secondary)]">
          {paycorLine}
        </span>
      </HealthRow>

      <div className="flex flex-wrap gap-2 pt-3 border-t border-[color:var(--divider)]">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/team">
            Team
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/billing">
            Billing
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/settings">
            Settings
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function HealthRow({
  Icon,
  label,
  children,
}: {
  Icon: typeof CreditCard;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Icon
          className="h-4 w-4 shrink-0 text-[color:var(--text-secondary)]"
          strokeWidth={2}
        />
        <span className="text-sm text-[color:var(--text-secondary)]">{label}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Monthly volume panel (Executive)
// ---------------------------------------------------------------------------

function MonthlyVolumePanel({
  monthStats,
}: {
  monthStats: Awaited<ReturnType<typeof monthRollup>>;
}) {
  return (
    <section className="panel flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-[color:var(--divider)]">
        <h2 className="font-display text-lg font-semibold text-[color:var(--text-primary)]">
          Monthly volume
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <VolumeStat
          Icon={ShieldCheck}
          label="Supervision hrs"
          value={monthStats.supervisionHours}
        />
        <VolumeStat
          Icon={CalendarClock}
          label="Scheduled this week"
          value={monthStats.scheduledThisWeek}
        />
        <VolumeStat
          Icon={CalendarX}
          label="No-shows last 30d"
          value={monthStats.noShowsLast30Days}
          warn={monthStats.noShowsLast30Days > 0}
        />
        <VolumeStat
          Icon={FileSignature}
          label="Sealed this month"
          value={monthStats.evidenceSealed}
          good={monthStats.evidenceSealed > 0}
        />
      </div>
    </section>
  );
}

function VolumeStat({
  Icon,
  label,
  value,
  warn,
  good,
}: {
  Icon: typeof ShieldCheck;
  label: string;
  value: number;
  warn?: boolean;
  good?: boolean;
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
    <div className="flex items-start gap-3">
      <Icon className={`h-4 w-4 mt-1 shrink-0 ${iconTone}`} strokeWidth={2} />
      <div>
        <p
          className={`font-display text-2xl font-semibold leading-none tabular-nums ${numTone}`}
        >
          {value}
        </p>
        <p className="label-overline mt-1.5">{label}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent activity panel
// ---------------------------------------------------------------------------

function RecentActivityPanel({
  entries,
  actorNames,
}: {
  entries: (typeof schema.auditLogEntries.$inferSelect)[];
  actorNames: Map<string, string>;
}) {
  return (
    <div className="panel panel-flush overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-[color:var(--border)] bg-[color:var(--surface-muted)]">
            <th className="px-5 py-3 label-overline">When</th>
            <th className="px-5 py-3 label-overline">Actor</th>
            <th className="px-5 py-3 label-overline">Action</th>
            <th className="px-5 py-3 label-overline">Resource</th>
          </tr>
        </thead>
        <tbody className="row-zebra">
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-[color:var(--divider)]">
              <td className="px-5 py-3 font-mono text-xs text-[color:var(--text-secondary)] whitespace-nowrap">
                {formatRelative(e.createdAt)}
              </td>
              <td className="px-5 py-3 text-[color:var(--text-primary)]">
                {e.actorUserId
                  ? (actorNames.get(e.actorUserId) ?? "—")
                  : "System"}
              </td>
              <td className="px-5 py-3 text-[color:var(--text-primary)]">
                {humanizeAction(e.action)}
              </td>
              <td className="px-5 py-3 text-[color:var(--text-muted)]">
                {e.resourceType ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function RiskPill({ level }: { level: "green" | "yellow" | "red" }) {
  const cls =
    level === "red"
      ? "status-risk"
      : level === "yellow"
        ? "status-warn"
        : "status-ok";
  return (
    <span className={`status-pill ${cls} shrink-0`}>
      {level === "green" && <Circle className="h-2 w-2 fill-current" />}
      {level === "yellow" && <AlertTriangle className="h-3 w-3" />}
      {level === "red" && <AlertOctagon className="h-3 w-3" />}
      {riskBadgeLabel(level)}
    </span>
  );
}

function humanizeAction(action: string): string {
  // "session.signed" → "Session signed"; "member.role_changed" → "Member role changed"
  const [, verb = ""] = action.split(".", 2);
  const noun = action.split(".", 1)[0];
  const nounCap = noun.charAt(0).toUpperCase() + noun.slice(1);
  const verbNice = verb.replace(/_/g, " ");
  return verb ? `${nounCap} ${verbNice}` : action;
}

/** Short relative-time label — "2m ago", "5h ago", "3d ago", "Mar 4". */
function formatRelative(d: Date): string {
  const now = Date.now();
  const diffMs = now - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// monthRollup — lifted verbatim from the former executive page.
// ---------------------------------------------------------------------------

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
