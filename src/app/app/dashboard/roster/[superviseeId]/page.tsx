import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { and, eq, desc } from "drizzle-orm";
import { ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react";
import { auth } from "@/auth";
import { db, schema } from "@/lib/db";
import {
  evaluate,
  getRule,
  loadAllRules,
  type EvaluationContext,
  type Rule,
} from "@/lib/rules";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AssignRuleForm } from "./assign-rule-form";
import { LogSessionForm } from "./log-session-form";

export const metadata = {
  title: "Supervisee — AuditHalo",
};

function ProgressBar({ pct, label }: { pct: number; label: string }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-foreground/70">{label}</span>
        <span className="font-mono text-foreground">{clamped.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-[color:var(--color-gold)] transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export default async function SuperviseeDetailPage({
  params,
}: {
  params: Promise<{ superviseeId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { superviseeId } = await params;

  // Verify the viewer shares an org with this supervisee
  const myMembership = await db.query.orgMemberships.findFirst({
    where: eq(schema.orgMemberships.userId, session.user.id),
  });
  if (!myMembership) notFound();

  const targetMembership = await db.query.orgMemberships.findFirst({
    where: and(
      eq(schema.orgMemberships.userId, superviseeId),
      eq(schema.orgMemberships.orgId, myMembership.orgId)
    ),
  });
  if (!targetMembership) notFound();

  const supervisee = await db.query.users.findFirst({
    where: eq(schema.users.id, superviseeId),
  });
  if (!supervisee) notFound();

  const assignment = await db.query.superviseeRuleAssignments.findFirst({
    where: and(
      eq(schema.superviseeRuleAssignments.superviseeId, superviseeId),
      eq(schema.superviseeRuleAssignments.orgId, myMembership.orgId)
    ),
  });

  const events = await db.query.sessionEvents.findMany({
    where: and(
      eq(schema.sessionEvents.superviseeId, superviseeId),
      eq(schema.sessionEvents.orgId, myMembership.orgId)
    ),
    orderBy: [desc(schema.sessionEvents.date)],
  });

  let rule: Rule | null = null;
  let evalResult: ReturnType<typeof evaluate> | null = null;
  if (assignment) {
    const [, juris, lic, vRaw] = assignment.ruleId.match(/^(.+?)-(.+?)-v(\d+)$/) ?? [];
    if (juris && lic && vRaw) {
      try {
        rule = getRule(juris.toUpperCase(), lic.toUpperCase(), parseInt(vRaw, 10));
        const ctx: EvaluationContext = {
          superviseeId,
          startedAt: assignment.obligationStartedAt.toISOString(),
          supervisionContractFiledAt: assignment.supervisionContractFiledAt?.toISOString(),
          sessions: events.map((e) =>
            e.kind === "practice"
              ? {
                  kind: "practice" as const,
                  id: e.id,
                  date: e.date.toISOString(),
                  durationHours: e.durationHours,
                }
              : {
                  kind: "supervision" as const,
                  id: e.id,
                  date: e.date.toISOString(),
                  durationHours: e.durationHours,
                  sessionType:
                    (e.sessionType as "individual" | "triadic" | "group") ??
                    "individual",
                  supervisorCredentials: e.supervisorCredentials ?? [],
                  groupAttendees: e.groupAttendees ?? undefined,
                }
          ),
          asOf: new Date().toISOString(),
        };
        evalResult = evaluate(ctx, rule);
      } catch {
        // Rule not in registry — fall through to "no rule" UI
      }
    }
  }

  const allRules = [...loadAllRules().values()].map((r) => ({
    id: `${r.jurisdiction.toLowerCase()}-${r.license_code.toLowerCase()}-v${r.version}`,
    label: `${r.jurisdiction} ${r.license_code} v${r.version}`,
    summary: r.summary.split("\n")[0] ?? "",
  }));

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/dashboard/roster">
          <ArrowLeft />
          Back to roster
        </Link>
      </Button>

      <Badge variant="outline" className="mb-3">
        Supervisee
      </Badge>
      <h1 className="font-display text-4xl font-semibold text-foreground">
        {supervisee.name}
      </h1>
      <p className="mt-2 text-foreground/70">{supervisee.email}</p>

      {!rule ? (
        <Card className="mt-10">
          <CardContent className="p-6">
            <Badge variant="warning" className="mb-3">
              No rule assigned
            </Badge>
            <h2 className="font-display text-xl font-semibold text-foreground">
              Assign a state rule
            </h2>
            <p className="mt-2 text-foreground/70">
              Pick the state and license type this supervisee is working toward. Their hour
              progress and at-risk flags only start once a rule is assigned.
            </p>
            <AssignRuleForm
              superviseeId={superviseeId}
              availableRules={allRules}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Badge
                    variant={
                      evalResult?.riskLevel === "red"
                        ? "risk"
                        : evalResult?.riskLevel === "yellow"
                          ? "warning"
                          : "success"
                    }
                    className="mb-2"
                  >
                    {evalResult?.riskLevel === "red"
                      ? "At risk"
                      : evalResult?.riskLevel === "yellow"
                        ? "Watch"
                        : "On track"}
                  </Badge>
                  <h2 className="font-display text-xl font-semibold text-foreground">
                    {rule.jurisdiction} {rule.license_code} v{rule.version}
                  </h2>
                  <p className="mt-1 text-sm font-mono text-foreground/60">
                    {rule.citation.admincode}
                  </p>
                </div>
                <a
                  href={rule.citation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-secondary hover:underline"
                >
                  View source ↗
                </a>
              </div>

              <ProgressBar
                pct={evalResult?.progress.practiceProgressPct ?? 0}
                label={`Practice hours · ${evalResult?.totals.practiceHours.toFixed(1) ?? 0} of ${rule.structured.total_practice_hours_required}`}
              />
              <ProgressBar
                pct={evalResult?.progress.supervisionProgressPct ?? 0}
                label={`Supervision hours · ${evalResult?.totals.supervisionHours.toFixed(1) ?? 0} of ${rule.structured.total_supervision_hours_required}`}
              />

              {evalResult && evalResult.gaps.length > 0 && (
                <div>
                  <p className="label-overline mb-2">Gaps and warnings</p>
                  <ul className="space-y-2">
                    {evalResult.gaps.map((g, i) => (
                      <li
                        key={i}
                        className={`flex gap-3 p-3 rounded-sm text-sm border ${
                          g.severity === "blocker"
                            ? "border-[color:var(--color-risk)]/20 bg-[color:var(--color-risk)]/5"
                            : g.severity === "warning"
                              ? "border-[color:var(--color-warning)]/20 bg-[color:var(--color-warning)]/5"
                              : "border-border bg-muted/40"
                        }`}
                      >
                        <AlertTriangle
                          className={`h-4 w-4 mt-0.5 shrink-0 ${
                            g.severity === "blocker"
                              ? "text-[color:var(--color-risk)]"
                              : g.severity === "warning"
                                ? "text-[color:var(--color-warning)]"
                                : "text-foreground/40"
                          }`}
                        />
                        <span className="text-foreground/80">{g.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {evalResult && evalResult.gaps.length === 0 && (
                <div className="flex gap-3 p-3 rounded-sm text-sm border border-[color:var(--color-success)]/20 bg-[color:var(--color-success)]/5">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-[color:var(--color-success)]" />
                  <span className="text-foreground/80">
                    All checks pass. Hours are accruing correctly under{" "}
                    {rule.jurisdiction} {rule.license_code} v{rule.version}.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="label-overline mb-3">Log a session</p>
              <LogSessionForm superviseeId={superviseeId} />
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="mt-6">
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-border">
            <p className="label-overline">Session log ({events.length})</p>
          </div>
          {events.length === 0 ? (
            <p className="px-6 py-8 text-sm text-foreground/60">
              No sessions logged yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-accent">
                <tr className="text-left">
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Kind</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Hours</th>
                  <th className="px-5 py-3 font-semibold">Credentials</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-5 py-3 font-mono text-xs">
                      {e.date.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-5 py-3 capitalize">{e.kind}</td>
                    <td className="px-5 py-3 capitalize">{e.sessionType ?? "—"}</td>
                    <td className="px-5 py-3 font-mono">{e.durationHours.toFixed(1)}</td>
                    <td className="px-5 py-3 text-xs text-foreground/60">
                      {e.supervisorCredentials?.join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
