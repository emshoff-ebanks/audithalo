import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { Info, ArrowRight, UserPlus } from "lucide-react";
import {
  canSupervise,
  getCurrentMembership,
  isHrAdmin,
} from "@/lib/authz";
import { getOrgRosterWithCompliance, type RosterRow } from "@/lib/db/roster-queries";
import { pickRosterRepresentativeGap } from "@/lib/rules/gap-grouping";
import type { Gap } from "@/lib/rules/types";
import { pendingSignaturesForSupervisor } from "@/lib/supervisor-signatures";
import { db, schema } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { BillingBanner } from "./_billing-banner";
import { OnboardingChecklist } from "./_onboarding-checklist";
import { SupervisorThisWeek } from "./_supervisor-this-week";
import { computeOnboardingSteps } from "@/lib/onboarding";

type Props = {
  userId: string;
  userName: string | null;
  userEmail: string;
  /** ?wk=<int> week offset for the "This week" panel (design §9 URL-state). */
  weekOffset?: number;
};

const DAY_MS = 24 * 60 * 60_000;
const SEV_RANK: Record<Gap["severity"], number> = {
  blocker: 0,
  warning: 1,
  info: 2,
};

const pillDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export async function SupervisorDashboard({ userId, weekOffset = 0 }: Props) {
  const membership = await getCurrentMembership(userId);
  if (!membership) redirect("/login");

  const isSupervisor = canSupervise(membership.role);
  const hrAdmin = isHrAdmin(membership.role);

  const [roster, org, viewer] = await Promise.all([
    getOrgRosterWithCompliance(membership.orgId),
    db.query.organizations.findFirst({
      where: eq(schema.organizations.id, membership.orgId),
    }),
    db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: {
        credentials: true,
        emailVerifiedAt: true,
        supervisorTrainingHours: true,
        onboardingDismissedAt: true,
      },
    }),
  ]);

  // Scope: a supervisor sees only their actively-assigned supervisees; an
  // HR Admin sees the whole org. (null = whole org, skip the filter.)
  let allowedSuperviseeIds: string[] | null = null;
  if (isSupervisor && !hrAdmin) {
    const rows = await db
      .select({ superviseeId: schema.supervisorAssignments.superviseeId })
      .from(schema.supervisorAssignments)
      .where(
        and(
          eq(schema.supervisorAssignments.supervisorId, userId),
          eq(schema.supervisorAssignments.orgId, membership.orgId),
          isNull(schema.supervisorAssignments.endedAt)
        )
      );
    allowedSuperviseeIds = rows
      .map((r) => r.superviseeId)
      .filter((id): id is string => id !== null);
  }

  const allowedSet = allowedSuperviseeIds
    ? new Set(allowedSuperviseeIds)
    : null;
  const scopedRoster = allowedSet
    ? roster.filter((r) => allowedSet.has(r.userId))
    : roster;
  const totalSupervisees = scopedRoster.length;

  // Only supervisors sign, so only they get the pending-signature hero.
  const pending = isSupervisor
    ? await pendingSignaturesForSupervisor(userId, membership.orgId)
    : [];

  // Header eyebrow — {primary credential} · {N}-STATE SUPERVISION.
  const credential = viewer?.credentials?.[0] ?? null;
  const stateCount = new Set(
    scopedRoster.map((r) => r.state).filter(Boolean)
  ).size;
  const eyebrowParts: string[] = [];
  if (credential) eyebrowParts.push(credential);
  if (stateCount > 0) eyebrowParts.push(`${stateCount}-state supervision`);
  const eyebrow = eyebrowParts.length ? eyebrowParts.join(" · ") : "Supervision";

  // "Supervisees at risk" — one representative gap per non-green,
  // non-paused supervisee, blockers first, top 3.
  const atRiskEntries = scopedRoster
    .filter(
      (r) =>
        r.evaluation &&
        r.evaluation.riskLevel !== "green" &&
        !r.evaluation.paused
    )
    .map((r) => ({ row: r, gap: pickRosterRepresentativeGap(r.evaluation!.gaps) }))
    .filter((e): e is { row: RosterRow; gap: Gap } => e.gap !== null);
  atRiskEntries.sort(
    (a, b) => SEV_RANK[a.gap.severity] - SEV_RANK[b.gap.severity]
  );
  const topAtRisk = atRiskEntries.slice(0, 3);

  const header = (
    <div>
      <p className="shell-eyebrow">{eyebrow}</p>
      <h1 className="shell-page-title mt-1">Overview</h1>
    </div>
  );

  const onboardingBlock = !viewer?.onboardingDismissedAt
    ? (() => {
        const rosterHasTraining = roster.some(
          (r) => r.ruleId?.startsWith("ca-apcc") || r.ruleId?.startsWith("fl-rmhci")
        );
        const onboarding = computeOnboardingSteps({
          emailVerifiedAt: viewer?.emailVerifiedAt ?? null,
          subscriptionStatus: org?.subscriptionStatus ?? null,
          roster: roster.map((r) => ({ evaluation: r.evaluation })),
          supervisorTrainingHours: viewer?.supervisorTrainingHours ?? null,
          rosterHasTrainingRequiredRule: rosterHasTraining,
        });
        return (
          <OnboardingChecklist
            emailDone={onboarding.stepDone[0]}
            trialDone={onboarding.stepDone[1]}
            rosterDone={onboarding.stepDone[2]}
            rulesDone={onboarding.stepDone[3]}
            trainingRelevant={rosterHasTraining}
            trainingDone={onboarding.stepDone[4] ?? false}
          />
        );
      })()
    : null;

  return (
    <div className="flex flex-col gap-6">
      <BillingBanner org={org} />
      {onboardingBlock}

      {header}

      {totalSupervisees === 0 ? (
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
                {hrAdmin
                  ? "Invite your supervisors first, then your supervisees. Supervisors run their own rosters; HR Admins see the whole org."
                  : "Invite your first supervisee to begin tracking hours and supervision sessions."}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
            {hrAdmin && (
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/team">
                  Invite supervisor
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
            <Button asChild size="sm">
              <Link href="/dashboard/roster">
                Invite supervisee
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <ActionNeeded isSupervisor={isSupervisor} pending={pending} />

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="panel flex flex-col">
              <div className="flex items-center justify-between gap-3 pb-4 border-b border-[color:var(--divider)]">
                <div className="flex items-center gap-2 min-w-0">
                  <Info
                    className="h-4 w-4 shrink-0 text-[color:var(--text-secondary)]"
                    strokeWidth={2}
                  />
                  <h2 className="font-display text-lg font-semibold text-[color:var(--text-primary)]">
                    Supervisees at risk
                  </h2>
                </div>
                {topAtRisk.length > 0 && (
                  <Link
                    href="/dashboard/roster?filter=at-risk"
                    className="text-xs font-medium text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] whitespace-nowrap"
                  >
                    See all &rarr;
                  </Link>
                )}
              </div>
              <div className="pt-4 flex flex-col gap-3">
                {topAtRisk.length === 0 ? (
                  <p className="text-sm text-[color:var(--text-muted)] py-4 text-center">
                    Everyone is on track.
                  </p>
                ) : (
                  topAtRisk.map(({ row, gap }) => (
                    <AtRiskCard key={row.userId} row={row} gap={gap} />
                  ))
                )}
              </div>
            </section>

            <SupervisorThisWeek
              orgId={membership.orgId}
              allowedSuperviseeIds={allowedSuperviseeIds}
              weekOffset={weekOffset}
            />
          </div>
        </>
      )}
    </div>
  );
}

function ActionNeeded({
  isSupervisor,
  pending,
}: {
  isSupervisor: boolean;
  pending: Awaited<ReturnType<typeof pendingSignaturesForSupervisor>>;
}) {
  // HR Admin never signs — no action-needed block at all.
  if (!isSupervisor) return null;

  // One hero per screen, reserved for real action: no yellow hero when
  // nothing is waiting (design §7.4). Show a calm line instead.
  if (pending.length === 0) {
    return (
      <div className="panel flex items-center gap-3">
        <p className="text-sm text-[color:var(--text-secondary)]">
          You&apos;re all caught up. Nothing awaits your signature.
        </p>
      </div>
    );
  }

  const count = pending.length;
  // Server Components render once per request; reading the clock here is
  // intentional and stable across the render.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const oldestDays = Math.floor(
    (nowMs - pending[0].date.getTime()) / DAY_MS
  );
  const oldestCopy =
    oldestDays <= 0
      ? "Oldest is from today. Sign to seal."
      : `Oldest is ${oldestDays} day${oldestDays === 1 ? "" : "s"} old. Sign to seal.`;

  const visible = pending.slice(0, 4);
  const overflow = pending.length - visible.length;

  return (
    <div className="panel panel-hero flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="label-overline !text-[color:var(--ink-900)]/70">
            Action needed
          </p>
          <p className="mt-2 font-display text-2xl sm:text-3xl font-bold leading-tight text-[color:var(--ink-900)]">
            <span className="tabular-nums">{count}</span>{" "}
            {count === 1 ? "note" : "notes"} waiting on your signature
          </p>
          <p className="mt-1 text-sm text-[color:var(--ink-900)]/80">
            {oldestCopy}
          </p>
        </div>
        <Link
          href="/dashboard/signature-queue"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[8px] bg-[color:var(--ink-900)] px-4 h-10 text-sm font-medium text-[color:var(--paper-50)] hover:opacity-90 transition-opacity"
        >
          Review queue
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--ink-900)]/15 pt-4">
        {visible.map((row) => (
          <Link
            key={row.sessionId}
            href={`/sign/${row.sessionId}`}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-900)]/20 px-3 h-7 text-xs text-[color:var(--ink-900)] hover:bg-[color:var(--ink-900)]/5 transition-colors"
          >
            <span className="font-medium truncate max-w-[12rem]">
              {row.superviseeName}
            </span>
            <span className="font-mono text-[color:var(--ink-900)]/60">
              {pillDate.format(row.date)}
            </span>
          </Link>
        ))}
        {overflow > 0 && (
          <Link
            href="/dashboard/signature-queue"
            className="inline-flex items-center rounded-full px-3 h-7 text-xs font-medium text-[color:var(--ink-900)]/70 hover:text-[color:var(--ink-900)] transition-colors"
          >
            +{overflow} more
          </Link>
        )}
      </div>
    </div>
  );
}

function AtRiskCard({ row, gap }: { row: RosterRow; gap: Gap }) {
  const displayName = row.name || row.email;
  const metaParts = [row.licenseType, row.state].filter(Boolean);
  const blocking = gap.severity === "blocker";
  return (
    <Link
      href={`/dashboard/roster/${row.userId}`}
      className="flex items-center gap-3 rounded-[8px] border border-[color:var(--border)] p-3.5 hover:border-[color:var(--border-strong)] transition-colors"
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
        <p className="mt-1 text-sm text-[color:var(--text-secondary)] leading-snug">
          {gap.message}
        </p>
      </div>
      <span
        className={`status-pill shrink-0 ${blocking ? "status-risk" : "status-warn"}`}
      >
        {blocking ? "Blocking" : "At risk"}
      </span>
    </Link>
  );
}
