import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { Users, AlertTriangle, AlertOctagon, FileSignature, CheckCircle2, ArrowRight, UserPlus } from "lucide-react";
import {
  canSupervise,
  getCurrentMembership,
  isHrAdmin,
} from "@/lib/authz";
import { getOrgRosterWithCompliance } from "@/lib/db/roster-queries";
import { db, schema } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { BillingBanner } from "./_billing-banner";
import { OnboardingChecklist } from "./_onboarding-checklist";
import { PracticePanels, PRACTICE_THRESHOLD } from "./_practice-panel";
import { TodaysSchedule } from "./_todays-schedule";
import { RecentActivity } from "./_recent-activity";
import { computeOnboardingSteps } from "@/lib/onboarding";

type Props = {
  userId: string;
  userName: string | null;
  userEmail: string;
};

export async function SupervisorDashboard({
  userId,
  userName,
  userEmail,
}: Props) {
  const membership = await getCurrentMembership(userId);
  if (!membership) redirect("/login");

  const [roster, org, viewer] = await Promise.all([
    getOrgRosterWithCompliance(membership.orgId),
    db.query.organizations.findFirst({
      where: eq(schema.organizations.id, membership.orgId),
    }),
    db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: {
        isFoundingSupervisor: true,
        emailVerifiedAt: true,
        supervisorTrainingHours: true,
        onboardingDismissedAt: true,
      },
    }),
  ]);

  // The "Today's schedule" widget needs to know which supervisees this
  // viewer is allowed to see sessions for. Supervisor: their active
  // assignments. HR Admin: the whole org (pass null and the widget
  // skips the inArray filter). Done with one query so the widget stays
  // pure / cache-friendly.
  let allowedSuperviseeIdsForSchedule: string[] | null = null;
  if (canSupervise(membership.role) && !isHrAdmin(membership.role)) {
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
    allowedSuperviseeIdsForSchedule = rows.map((r) => r.superviseeId).filter((id): id is string => id !== null);
  }

  const totalSupervisees = roster.length;
  const atRiskCount = roster.filter(
    (r) => r.evaluation?.riskLevel === "red" || r.evaluation?.riskLevel === "yellow"
  ).length;
  const totalPendingSigs = roster.reduce((sum, r) => sum + r.pendingSignatureCount, 0);
  const compliantCount = roster.filter((r) => r.evaluation?.riskLevel === "green").length;

  // KPI metric panels (design-system-v2.md §7.4). Exactly one hero panel
  // carries halo yellow — "Need attention" is the supervisor's compliance
  // headline. Non-hero numbers use their state tone; the hero goes ink-on-yellow.
  const summaryCards = [
    {
      label: "Supervisees",
      value: totalSupervisees,
      Icon: Users,
      tone: "neutral" as const,
      hero: false,
      href: "/dashboard/roster",
    },
    {
      label: "Need attention",
      value: atRiskCount,
      Icon: AlertTriangle,
      tone: "neutral" as const,
      hero: true,
      href: "/dashboard/roster?filter=at-risk",
    },
    {
      label: "Pending signatures",
      value: totalPendingSigs,
      Icon: FileSignature,
      tone: totalPendingSigs > 0 ? ("warn" as const) : ("neutral" as const),
      hero: false,
      href: "/dashboard/roster?filter=pending-signatures",
    },
    {
      label: "On track",
      value: compliantCount,
      Icon: CheckCircle2,
      tone: "ok" as const,
      hero: false,
      href: "/dashboard/roster?filter=on-track",
    },
  ];

  const toneNumber: Record<string, string> = {
    neutral: "text-[color:var(--text-primary)]",
    warn: "text-[color:var(--warn-700)]",
    ok: "text-[color:var(--ok-700)]",
  };
  const toneIcon: Record<string, string> = {
    neutral: "text-[color:var(--text-secondary)]",
    warn: "text-[color:var(--warn-500)]",
    ok: "text-[color:var(--ok-700)]",
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="shell-page-title break-words">{userName ?? userEmail}</h1>
          <p className="shell-page-sub">
            {totalSupervisees === 0
              ? "No supervisees yet — invite one to get started."
              : `${totalSupervisees} supervisee${totalSupervisees !== 1 ? "s" : ""} on your roster.`}
          </p>
        </div>
        {viewer?.isFoundingSupervisor && (
          <span className="status-pill status-sealed">Founding Supervisor</span>
        )}
      </div>

      <div className="flex flex-col gap-6">
        <BillingBanner org={org} />
        {!viewer?.onboardingDismissedAt && (() => {
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
        })()}
        {totalSupervisees === 0 && (
          <div className="panel flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3 min-w-0">
              <UserPlus className="h-6 w-6 shrink-0 text-[color:var(--seal-gold)] mt-0.5" />
              <div className="min-w-0">
                <h3 className="font-display text-lg font-semibold text-[color:var(--text-primary)]">
                  Get started
                </h3>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)] leading-relaxed">
                  {isHrAdmin(membership.role)
                    ? "Invite your supervisors first, then your supervisees. Supervisors run their own rosters; HR Admins see the whole org."
                    : "Invite your first supervisee to begin tracking hours and supervision sessions."}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
              {isHrAdmin(membership.role) && (
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
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className={`panel${card.hero ? " panel-hero" : ""} flex flex-col gap-3 transition-[filter,border-color] ${
                card.hero ? "hover:brightness-[0.97]" : "hover:border-[color:var(--border-strong)]"
              }`}
            >
              <card.Icon
                className={`h-5 w-5 ${card.hero ? "text-[color:var(--ink-900)]" : toneIcon[card.tone]}`}
                strokeWidth={2}
              />
              <div>
                <p
                  className={`font-display text-3xl font-bold leading-none ${
                    card.hero ? "text-[color:var(--ink-900)]" : toneNumber[card.tone]
                  }`}
                >
                  {card.value}
                </p>
                <p
                  className={`label-overline mt-2 ${
                    card.hero ? "!text-[color:var(--ink-900)]/70" : ""
                  }`}
                >
                  {card.label}
                </p>
              </div>
            </Link>
          ))}
        </div>

        <TodaysSchedule
          orgId={membership.orgId}
          allowedSuperviseeIds={allowedSuperviseeIdsForSchedule}
        />

        {roster.length >= PRACTICE_THRESHOLD && <PracticePanels roster={roster} />}

        {atRiskCount > 0 && (
          <section>
            <h2 className="font-display text-xl font-semibold text-[color:var(--text-primary)] mb-3">
              Needs attention
            </h2>
            <div className="flex flex-col gap-2">
              {roster
                .filter((r) => r.evaluation?.riskLevel !== "green")
                .map((r) => {
                  const critical = r.evaluation?.riskLevel === "red";
                  return (
                    <Link
                      key={r.userId}
                      href={`/dashboard/roster/${r.userId}`}
                      className={`flex items-center justify-between gap-3 p-4 rounded-[8px] border border-[color:var(--border)] border-l-[3px] transition-colors ${
                        critical
                          ? "border-l-[color:var(--risk-600)] bg-[color:var(--risk-50)]/40 hover:bg-[color:var(--risk-50)]/60"
                          : "border-l-[color:var(--warn-500)] bg-[color:var(--warn-50)]/40 hover:bg-[color:var(--warn-50)]/60"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-[color:var(--text-primary)]">{r.name}</p>
                        <p className="text-sm text-[color:var(--text-secondary)]">
                          {r.evaluation?.totals.practiceHours.toFixed(1)} practice hours logged
                          {r.pendingSignatureCount > 0
                            ? ` · ${r.pendingSignatureCount} pending signature${r.pendingSignatureCount !== 1 ? "s" : ""}`
                            : ""}
                        </p>
                      </div>
                      <span className={`status-pill ${critical ? "status-risk" : "status-warn"}`}>
                        {critical ? (
                          <AlertOctagon className="h-3 w-3" />
                        ) : (
                          <AlertTriangle className="h-3 w-3" />
                        )}
                        {critical ? "At risk" : "Drift"}
                      </span>
                    </Link>
                  );
                })}
            </div>
          </section>
        )}

        <RecentActivity orgId={membership.orgId} />
      </div>
    </>
  );
}
