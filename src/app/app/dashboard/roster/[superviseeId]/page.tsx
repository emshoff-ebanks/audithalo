import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { and, eq, desc } from "drizzle-orm";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSignature,
} from "lucide-react";
import { auth } from "@/auth";
import { getCurrentMembership, isManagerRole } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import {
  evaluate,
  getRule,
  loadAllRules,
  riskBadgeLabel,
  riskBadgeVariant,
  severityStyles,
  toneClasses,
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

  // Supervisees can only view themselves
  const viewerIsManager = isManagerRole(session.user.role);
  if (!viewerIsManager && session.user.id !== superviseeId) {
    redirect(`/dashboard/roster/${session.user.id}`);
  }

  // Verify the viewer shares an org with this supervisee
  const myMembership = await getCurrentMembership(session.user.id);
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

  const evidencePackages = await db.query.evidencePackages.findMany({
    where: and(
      eq(schema.evidencePackages.superviseeId, superviseeId),
      eq(schema.evidencePackages.orgId, myMembership.orgId)
    ),
    orderBy: [desc(schema.evidencePackages.createdAt)],
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
      {viewerIsManager && (
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
          <Link href="/dashboard/roster">
            <ArrowLeft />
            Back to roster
          </Link>
        </Button>
      )}

      <Badge variant="outline" className="mb-3">
        {viewerIsManager ? "Supervisee" : "Your account"}
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
            {viewerIsManager ? (
              <>
                <h2 className="font-display text-xl font-semibold text-foreground">
                  Assign a state rule
                </h2>
                <p className="mt-2 text-foreground/70">
                  Pick the state and license type this supervisee is working toward. Their
                  hour progress and at-risk flags only start once a rule is assigned.
                </p>
                <AssignRuleForm
                  superviseeId={superviseeId}
                  availableRules={allRules}
                />
              </>
            ) : (
              <>
                <h2 className="font-display text-xl font-semibold text-foreground">
                  Your supervisor hasn't assigned your state rule yet.
                </h2>
                <p className="mt-2 text-foreground/70">
                  Reach out to your supervisor so they can pick the right rule (e.g., NC
                  LCMHCA). Once they do, your hour progress and at-risk flags will start
                  filling in here.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Badge
                    variant={riskBadgeVariant(evalResult?.riskLevel)}
                    className="mb-2"
                  >
                    {riskBadgeLabel(evalResult?.riskLevel)}
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
                    {evalResult.gaps.map((g, i) => {
                      const t = toneClasses(severityStyles(g.severity).tone);
                      return (
                        <li
                          key={i}
                          className={`flex gap-3 p-3 rounded-sm text-sm border ${t.border} ${t.bg}`}
                        >
                          <AlertTriangle
                            className={`h-4 w-4 mt-0.5 shrink-0 ${t.text}`}
                          />
                          <span className="text-foreground/80">{g.message}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {evalResult && evalResult.gaps.length === 0 && (
                <div className={(() => {
                  const t = toneClasses("success");
                  return `flex gap-3 p-3 rounded-sm text-sm border ${t.border} ${t.bg}`;
                })()}>
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
              <p className="label-overline mb-3">
                {viewerIsManager ? "Log a session" : "Log practice hours"}
              </p>
              <LogSessionForm
                superviseeId={superviseeId}
                allowSupervision={viewerIsManager}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="mt-6">
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <p className="label-overline">
              Evidence packages ({evidencePackages.length})
            </p>
            {evidencePackages.length === 0 && (
              <p className="text-xs text-foreground/50">
                Minted when a session is fully signed
              </p>
            )}
          </div>
          {evidencePackages.length > 0 && (
            <ul className="divide-y divide-border">
              {evidencePackages.map((p) => {
                const doc = p.documentContent as {
                  session: { date: string; sessionType: string | null; kind: string };
                };
                return (
                  <li
                    key={p.id}
                    className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-accent/40"
                  >
                    <div className="flex gap-3 items-start min-w-0">
                      <FileSignature className="h-4 w-4 mt-1 shrink-0 text-[color:var(--color-gold)]" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {doc.session.kind === "supervision"
                            ? `${doc.session.sessionType ?? "supervision"} session`
                            : "Practice session"}{" "}
                          · {doc.session.date.slice(0, 10)}
                        </p>
                        <p className="font-mono text-xs text-foreground/50 truncate">
                          {p.documentHash}
                        </p>
                      </div>
                    </div>
                    <a
                      href={`/api/evidence/${p.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary hover:underline shrink-0"
                    >
                      <Download className="h-3.5 w-3.5" />
                      PDF
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

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
                  <th className="px-5 py-3 font-semibold">Signatures</th>
                  <th className="px-5 py-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const sigs = e.signatures ?? [];
                  const myselfHasSigned = sigs.some(
                    (s) => s.signerId === session.user.id
                  );
                  const fullySigned = !!e.signedAt;
                  const isSelfSupervisee = session.user.id === e.superviseeId;
                  const canSign =
                    !fullySigned &&
                    !myselfHasSigned &&
                    (isSelfSupervisee || viewerIsManager);
                  return (
                    <tr key={e.id} className="border-t border-border">
                      <td className="px-5 py-3 font-mono text-xs">
                        {e.date.toISOString().slice(0, 10)}
                      </td>
                      <td className="px-5 py-3 capitalize">{e.kind}</td>
                      <td className="px-5 py-3 capitalize">{e.sessionType ?? "—"}</td>
                      <td className="px-5 py-3 font-mono">{e.durationHours.toFixed(1)}</td>
                      <td className="px-5 py-3">
                        {fullySigned ? (
                          <Badge variant="success">Sealed</Badge>
                        ) : sigs.length === 0 ? (
                          <Badge variant="warning">Awaiting all signatures</Badge>
                        ) : (
                          <Badge variant="warning">
                            {sigs.length} of 2 signed
                          </Badge>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {canSign ? (
                          <Link
                            href={`/sign/${e.id}`}
                            className="text-secondary text-xs font-medium hover:underline"
                          >
                            Sign →
                          </Link>
                        ) : (
                          <Link
                            href={`/sign/${e.id}`}
                            className="text-foreground/50 text-xs hover:underline"
                          >
                            View
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
