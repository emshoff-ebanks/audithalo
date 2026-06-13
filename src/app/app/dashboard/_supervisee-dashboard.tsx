import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, desc } from "drizzle-orm";
import { ArrowRight, FileSignature, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getCurrentMembership } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { riskBadgeLabel, riskBadgeVariant } from "@/lib/rules";
import { resolveEvaluationWithOverrides } from "@/lib/rules/evaluation-context-with-overrides";
import { pendingSignaturesForUser } from "@/lib/supervisee";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogSessionForm } from "@/app/app/dashboard/roster/[superviseeId]/log-session-form";

type Props = {
  userId: string;
  userName: string | null;
  userEmail: string;
};

export async function SuperviseeDashboard({ userId, userName, userEmail }: Props) {
  const membership = await getCurrentMembership(userId);
  if (!membership) redirect("/login");

  const assignment = await db.query.superviseeRuleAssignments.findFirst({
    where: and(
      eq(schema.superviseeRuleAssignments.superviseeId, userId),
      eq(schema.superviseeRuleAssignments.orgId, membership.orgId)
    ),
  });

  if (!assignment) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-12">
        <Badge variant="outline" className="mb-3">Your account</Badge>
        <h1 className="font-display text-4xl font-semibold text-foreground">
          Welcome, {userName ?? userEmail}
        </h1>
        <p className="mt-2 text-foreground/70">{userEmail}</p>
        <Card className="mt-10">
          <CardContent className="p-6">
            <Badge variant="warning" className="mb-3">No rule assigned</Badge>
            <h2 className="font-display text-xl font-semibold text-foreground">
              Your supervisor hasn&apos;t assigned your state rule yet.
            </h2>
            <p className="mt-2 text-foreground/70">
              Reach out to your supervisor so they can pick the right rule (e.g., NC
              LCMHCA). Once they do, your hour progress and at-risk flags will start
              filling in here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const events = await db.query.sessionEvents.findMany({
    where: and(
      eq(schema.sessionEvents.superviseeId, userId),
      eq(schema.sessionEvents.orgId, membership.orgId)
    ),
    orderBy: [desc(schema.sessionEvents.date)],
  });

  const resolved = await resolveEvaluationWithOverrides(assignment, events);
  const rule = resolved?.rule ?? null;
  const evalResult = resolved?.evaluation ?? null;

  const pendingForMe = pendingSignaturesForUser(events, userId);
  const recent = events.slice(0, 5);

  const practiceRequired = rule?.structured.total_practice_hours_required ?? 0;
  const supervisionRequired = rule?.structured.total_supervision_hours_required ?? 0;
  const practiceHours = evalResult?.totals.practiceHours ?? 0;
  const supervisionHours = evalResult?.totals.supervisionHours ?? 0;
  const practicePct = evalResult?.progress.practiceProgressPct ?? 0;
  const supervisionPct = evalResult?.progress.supervisionProgressPct ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-12">
      <Badge variant="outline" className="mb-3">Your account</Badge>
      <h1 className="font-display text-4xl font-semibold text-foreground">
        Welcome, {userName ?? userEmail}
      </h1>
      <p className="mt-2 text-foreground/70">{userEmail}</p>
      {rule && (
        <p className="mt-1 text-foreground/70">
          Tracking against {rule.jurisdiction} {rule.license_code} v{rule.version} —{" "}
          <Link
            href={`/dashboard/roster/${userId}`}
            className="text-secondary hover:underline"
          >
            View full record →
          </Link>
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="label-overline mb-2">Practice hours</p>
            <p className="font-display text-3xl font-bold text-foreground">
              {practiceHours.toFixed(0)}{" "}
              <span className="text-base font-normal text-foreground/60">
                / {practiceRequired}
              </span>
            </p>
            <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-[color:var(--color-gold)] transition-all"
                style={{ width: `${Math.min(100, practicePct)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="label-overline mb-2">Supervision hours</p>
            <p className="font-display text-3xl font-bold text-foreground">
              {supervisionHours.toFixed(0)}{" "}
              <span className="text-base font-normal text-foreground/60">
                / {supervisionRequired}
              </span>
            </p>
            <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-[color:var(--color-gold)] transition-all"
                style={{ width: `${Math.min(100, supervisionPct)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="label-overline mb-2">Status</p>
            {evalResult ? (
              <>
                <Badge variant={riskBadgeVariant(evalResult.riskLevel)}>
                  {riskBadgeLabel(evalResult.riskLevel)}
                </Badge>
                {evalResult.gaps.length > 0 && (
                  <p className="mt-3 text-xs text-foreground/60">
                    {evalResult.gaps.length} gap
                    {evalResult.gaps.length !== 1 ? "s" : ""} flagged
                  </p>
                )}
              </>
            ) : (
              <Badge variant="outline">No rule</Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="label-overline mb-2">Pending signatures</p>
            <p
              className={`font-display text-3xl font-bold ${
                pendingForMe.length > 0
                  ? "text-[color:var(--color-warning)]"
                  : "text-foreground"
              }`}
            >
              {pendingForMe.length}
            </p>
            <p className="mt-1 text-sm text-foreground/60">
              {pendingForMe.length === 0 ? "All caught up" : "supervision sessions"}
            </p>
          </CardContent>
        </Card>
      </div>

      {pendingForMe.length > 0 && (
        <div className="mt-10">
          <h2 className="font-display text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle
              className="h-5 w-5 text-[color:var(--color-warning)]"
              strokeWidth={1.75}
            />
            Needs your signature
          </h2>
          <div className="space-y-3">
            {pendingForMe.map((p) => (
              <Link
                key={p.id}
                href={`/sign/${p.id}`}
                className="flex items-center justify-between p-4 rounded-sm border-l-[3px] border-l-[color:var(--color-warning)] bg-[color:var(--color-warning)]/5 hover:bg-[color:var(--color-warning)]/10 transition-colors"
              >
                <div>
                  <p className="font-medium text-foreground capitalize">
                    {p.sessionType ?? "supervision"} session
                  </p>
                  <p className="text-xs text-foreground/60 font-mono">
                    {p.date.toISOString().slice(0, 10)} ·{" "}
                    {p.durationHours.toFixed(1)} hrs
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-foreground/40 shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <p className="label-overline mb-3">Log practice hours</p>
            <LogSessionForm superviseeId={userId} allowSupervision={false} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="label-overline mb-3">Recent activity</p>
            {recent.length === 0 ? (
              <p className="text-sm text-foreground/60 py-2">
                No sessions yet. Log your first practice hours →
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {recent.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      {e.signedAt ? (
                        <FileSignature className="h-4 w-4 text-[color:var(--color-gold)] shrink-0" />
                      ) : e.kind === "supervision" ? (
                        <AlertTriangle className="h-4 w-4 text-[color:var(--color-warning)] shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-foreground/40 shrink-0" />
                      )}
                      <div>
                        <p className="text-foreground capitalize">
                          {e.kind === "supervision"
                            ? `${e.sessionType ?? "supervision"} session`
                            : "Practice"}
                        </p>
                        <p className="text-xs text-foreground/60 font-mono">
                          {e.date.toISOString().slice(0, 10)}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-xs text-foreground/70">
                      {e.durationHours.toFixed(1)} hr
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 pt-4 border-t border-border">
              <Button asChild variant="ghost" size="sm" className="-ml-3">
                <Link href={`/dashboard/roster/${userId}`}>
                  View full record <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
