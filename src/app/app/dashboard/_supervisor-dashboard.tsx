import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { Users, AlertTriangle, FileSignature, CheckCircle2, ArrowRight, UserPlus } from "lucide-react";
import {
  canSupervise,
  getCurrentMembership,
  isHrAdmin,
} from "@/lib/authz";
import { getOrgRosterWithCompliance } from "@/lib/db/roster-queries";
import { db, schema } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BillingBanner } from "./_billing-banner";
import { PracticePanels, PRACTICE_THRESHOLD } from "./_practice-panel";
import { TodaysSchedule } from "./_todays-schedule";
import { RecentActivity } from "./_recent-activity";

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
    allowedSuperviseeIdsForSchedule = rows.map((r) => r.superviseeId);
  }

  const totalSupervisees = roster.length;
  const atRiskCount = roster.filter(
    (r) => r.evaluation?.riskLevel === "red" || r.evaluation?.riskLevel === "yellow"
  ).length;
  const totalPendingSigs = roster.reduce((sum, r) => sum + r.pendingSignatureCount, 0);
  const compliantCount = roster.filter((r) => r.evaluation?.riskLevel === "green").length;

  const summaryCards = [
    {
      label: "Supervisees",
      value: totalSupervisees,
      Icon: Users,
      warn: false,
      good: false,
      href: "/dashboard/roster",
    },
    {
      label: "Need attention",
      value: atRiskCount,
      Icon: AlertTriangle,
      warn: atRiskCount > 0,
      good: atRiskCount === 0,
      href: "/dashboard/roster?filter=at-risk",
    },
    {
      label: "Pending signatures",
      value: totalPendingSigs,
      Icon: FileSignature,
      warn: totalPendingSigs > 0,
      good: false,
      href: "/dashboard/roster?filter=pending-signatures",
    },
    {
      label: "On track",
      value: compliantCount,
      Icon: CheckCircle2,
      warn: false,
      good: true,
      href: "/dashboard/roster?filter=on-track",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-12">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="outline">Dashboard</Badge>
        {viewer?.isFoundingSupervisor && (
          <Badge
            variant="outline"
            className="border-[color:var(--color-gold)] bg-[color:var(--color-gold)]/10 text-[color:var(--color-gold)]"
          >
            Founding Supervisor
          </Badge>
        )}
      </div>
      <h1 className="font-display text-3xl sm:text-4xl font-semibold text-foreground break-words">
        {userName ?? userEmail}
      </h1>
      <p className="mt-2 text-foreground/70">
        {totalSupervisees === 0
          ? "No supervisees yet — invite one to get started."
          : `${totalSupervisees} supervisee${totalSupervisees !== 1 ? "s" : ""} on your roster.`}
      </p>

      <div className="mt-8 space-y-8">
        <BillingBanner org={org} />
        {totalSupervisees === 0 && (
          <Card>
            <CardContent className="p-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3 min-w-0">
                <UserPlus className="h-6 w-6 shrink-0 text-[color:var(--color-gold)] mt-0.5" />
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-semibold text-foreground">
                    Get started
                  </h3>
                  <p className="mt-1 text-sm text-foreground/70 leading-relaxed">
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
            </CardContent>
          </Card>
        )}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {summaryCards.map((card) => {
            const color = card.warn
              ? "text-[color:var(--color-warning)]"
              : card.good
              ? "text-[color:var(--color-success)]"
              : "text-foreground";
            return (
              <Link key={card.label} href={card.href}>
                <Card className="hover:bg-accent/40 transition-colors cursor-pointer h-full">
                  <CardContent className="p-4 sm:p-6">
                    <card.Icon className={`h-5 w-5 mb-2 sm:mb-3 ${color}`} strokeWidth={1.75} />
                    <p className={`font-display text-2xl sm:text-3xl font-bold ${color}`}>{card.value}</p>
                    <p className="mt-1 text-xs sm:text-sm text-foreground/60">{card.label}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-10">
        <TodaysSchedule
          orgId={membership.orgId}
          allowedSuperviseeIds={allowedSuperviseeIdsForSchedule}
        />
      </div>

      {roster.length >= PRACTICE_THRESHOLD && <PracticePanels roster={roster} />}

      {atRiskCount > 0 && (
        <div className="mt-10">
          <h2 className="font-display text-xl font-semibold text-foreground mb-4">
            Needs attention
          </h2>
          <div className="space-y-3">
            {roster
              .filter((r) => r.evaluation?.riskLevel !== "green")
              .map((r) => (
                <Link
                  key={r.userId}
                  href={`/dashboard/roster/${r.userId}`}
                  className="flex items-center justify-between p-4 rounded-sm border border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning)]/5 hover:bg-[color:var(--color-warning)]/10 transition-colors"
                >
                  <div>
                    <p className="font-medium text-foreground">{r.name}</p>
                    <p className="text-sm text-foreground/60">
                      {r.evaluation?.totals.practiceHours.toFixed(1)} practice hours logged
                      {r.pendingSignatureCount > 0
                        ? ` · ${r.pendingSignatureCount} pending signature${r.pendingSignatureCount !== 1 ? "s" : ""}`
                        : ""}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-foreground/40 shrink-0" />
                </Link>
              ))}
          </div>
        </div>
      )}

      <div className="mt-10">
        <RecentActivity orgId={membership.orgId} />
      </div>
    </div>
  );
}
