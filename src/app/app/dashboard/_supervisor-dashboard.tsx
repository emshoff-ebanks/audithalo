import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { Users, AlertTriangle, FileSignature, CheckCircle2, ArrowRight } from "lucide-react";
import { getCurrentMembership } from "@/lib/authz";
import { getOrgRosterWithCompliance } from "@/lib/db/roster-queries";
import { db, schema } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OnboardingChecklist } from "./_onboarding-checklist";
import { BillingBanner } from "./_billing-banner";

type Props = {
  userId: string;
  userName: string | null;
  userEmail: string;
};

export async function SupervisorDashboard({ userId, userName, userEmail }: Props) {
  const membership = await getCurrentMembership(userId);
  if (!membership) redirect("/login");

  const [roster, org] = await Promise.all([
    getOrgRosterWithCompliance(membership.orgId),
    db.query.organizations.findFirst({
      where: eq(schema.organizations.id, membership.orgId),
    }),
  ]);

  const totalSupervisees = roster.length;
  const atRiskCount = roster.filter(
    (r) => r.evaluation?.riskLevel === "red" || r.evaluation?.riskLevel === "yellow"
  ).length;
  const totalPendingSigs = roster.reduce((sum, r) => sum + r.pendingSignatureCount, 0);
  const compliantCount = roster.filter((r) => r.evaluation?.riskLevel === "green").length;

  const summaryCards = [
    { label: "Supervisees", value: totalSupervisees, Icon: Users, warn: false, good: false },
    { label: "Need attention", value: atRiskCount, Icon: AlertTriangle, warn: atRiskCount > 0, good: atRiskCount === 0 },
    { label: "Pending signatures", value: totalPendingSigs, Icon: FileSignature, warn: totalPendingSigs > 0, good: false },
    { label: "On track", value: compliantCount, Icon: CheckCircle2, warn: false, good: true },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 sm:py-12">
      <Badge variant="outline" className="mb-4">Dashboard</Badge>
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
        <OnboardingChecklist
          subscriptionStatus={org?.subscriptionStatus ?? null}
          roster={roster}
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {summaryCards.map((card) => {
            const color = card.warn
              ? "text-[color:var(--color-warning)]"
              : card.good
              ? "text-[color:var(--color-success)]"
              : "text-foreground";
            return (
              <Link key={card.label} href="/dashboard/roster">
                <Card className="hover:bg-accent/40 transition-colors cursor-pointer h-full">
                  <CardContent className="p-6">
                    <card.Icon className={`h-5 w-5 mb-3 ${color}`} strokeWidth={1.75} />
                    <p className={`font-display text-3xl font-bold ${color}`}>{card.value}</p>
                    <p className="mt-1 text-sm text-foreground/60">{card.label}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/dashboard/roster">
            <Users className="h-4 w-4" />
            Manage roster <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/billing">Billing</Link>
        </Button>
      </div>

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
                      {r.evaluation?.totals.practiceHours.toFixed(0)} practice hours logged
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
    </div>
  );
}
