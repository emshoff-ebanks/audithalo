import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { and, eq, desc, isNull } from "drizzle-orm";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSignature,
} from "lucide-react";
import { auth } from "@/auth";
import { canSupervise, getCurrentMembership, isHrAdmin, isManagerRole } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { ReassignSupervisorDropdown } from "@/app/app/dashboard/team/_invite-forms";
import {
  latestVersionForState,
  loadAllRules,
  resolveEvaluation,
  toneClasses,
} from "@/lib/rules";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AssignRuleForm } from "./assign-rule-form";
import { SessionsPanel } from "./sessions-panel";
import { RuleSummaryCard } from "./rule-summary-card";
import { SessionLog } from "@/components/app/session-log";
import { GapRenderer } from "./_gap-renderer";
import { RuleVersionBanner } from "./_rule-version-banner";
import {
  CompletedAttestations,
  type CompletedAttestation,
} from "./_completed-attestations";

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

/**
 * Server-side: derive the user-facing list of "completed compliance tasks"
 * from the assignment row. The typed columns (supervisionContractFiledAt,
 * supervisorTrainingCompletedAt + hours, permitIssuedAt + permitExpiresAt)
 * each map to one row when populated. The jsonb attestations bag handles
 * any future-extensible checks we haven't pinned typed columns for.
 *
 * Keep labels and descriptions here so they stay co-located with the
 * mapping from checkId to typed-column shape in attestAction.
 */
type AssignmentRow = NonNullable<
  Awaited<ReturnType<typeof db.query.superviseeRuleAssignments.findFirst>>
>;
function deriveCompletedAttestations(
  assignment: AssignmentRow
): CompletedAttestation[] {
  const out: CompletedAttestation[] = [];

  if (assignment.supervisionContractFiledAt) {
    out.push({
      checkId: "pre_registration_required",
      label: "Supervision contract filed",
      description:
        "The supervisor + supervisee contract was filed with the state board on this date. Hours logged before this date do not count.",
      date: assignment.supervisionContractFiledAt
        .toISOString()
        .slice(0, 10),
    });
  }

  if (assignment.supervisorTrainingCompletedAt) {
    out.push({
      checkId: "supervisor_training_course_required",
      label: "Supervisor training completed",
      description:
        "Date the assigned supervisor completed their state-required supervision training.",
      date: assignment.supervisorTrainingCompletedAt
        .toISOString()
        .slice(0, 10),
      ...(assignment.supervisorTrainingHoursAttested !== null
        ? { hours: assignment.supervisorTrainingHoursAttested }
        : {}),
    });
  }

  if (assignment.permitExpiresAt) {
    out.push({
      checkId: "permit_expiration_window",
      label: "Permit dates",
      description:
        "Issue and expiration of the supervisee's pre-licensure permit / registration.",
      date: assignment.permitExpiresAt.toISOString().slice(0, 10),
      ...(assignment.permitIssuedAt
        ? {
            permitIssuedAt: assignment.permitIssuedAt
              .toISOString()
              .slice(0, 10),
          }
        : { permitIssuedAt: "" }),
    });
  }

  // Future-extensible jsonb bag entries.
  const bag = assignment.attestations ?? {};
  for (const [checkId, entry] of Object.entries(bag)) {
    const value = entry.value as { date?: string; hours?: number };
    if (!value?.date) continue;
    out.push({
      checkId,
      label: checkId
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      date: value.date,
      ...(typeof value.hours === "number" ? { hours: value.hours } : {}),
    });
  }

  return out;
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
  const viewerCanSupervise = canSupervise(session.user.role);
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

  // Who will *host* a session scheduled from this page:
  //   - Supervisor viewing → themselves.
  //   - HR Admin viewing → the supervisee's currently-assigned supervisor.
  // For other roles the schedule form isn't shown.
  // We resolve the active supervisor here so the form can fetch the
  // right user's calendar integrations + show "Scheduling on behalf of …".
  const viewerIsHrAdminEarly = isHrAdmin(session.user.role);
  const viewerCanScheduleSession = viewerCanSupervise || viewerIsHrAdminEarly;
  let hostingSupervisorIdForPage: string | null = null;
  let hostingSupervisorNameForPage: string | null = null;
  if (viewerCanSupervise) {
    hostingSupervisorIdForPage = session.user.id;
  } else if (viewerIsHrAdminEarly) {
    const activeAssignmentForScheduling =
      await db.query.supervisorAssignments.findFirst({
        where: and(
          eq(schema.supervisorAssignments.superviseeId, superviseeId),
          eq(schema.supervisorAssignments.orgId, myMembership.orgId),
          isNull(schema.supervisorAssignments.endedAt)
        ),
      });
    if (activeAssignmentForScheduling) {
      hostingSupervisorIdForPage = activeAssignmentForScheduling.supervisorId;
      const sup = await db.query.users.findFirst({
        where: eq(schema.users.id, hostingSupervisorIdForPage),
        columns: { name: true, email: true },
      });
      hostingSupervisorNameForPage = sup?.name ?? sup?.email ?? null;
    }
  }

  // Other supervisees in the org the actor can pull into a group
  // session (Phase 5). Same scope as the calendar-page roster: a
  // supervisor sees their own assigned supervisees minus the primary;
  // HR Admin sees the whole org's supervisees minus the primary.
  let groupCandidates: { id: string; name: string }[] = [];
  if (viewerCanScheduleSession) {
    if (viewerCanSupervise) {
      const assignmentRows = await db
        .select({
          id: schema.users.id,
          name: schema.users.name,
          email: schema.users.email,
        })
        .from(schema.supervisorAssignments)
        .innerJoin(
          schema.users,
          eq(schema.users.id, schema.supervisorAssignments.superviseeId)
        )
        .where(
          and(
            eq(
              schema.supervisorAssignments.supervisorId,
              session.user.id
            ),
            eq(
              schema.supervisorAssignments.orgId,
              myMembership.orgId
            ),
            isNull(schema.supervisorAssignments.endedAt)
          )
        );
      groupCandidates = assignmentRows
        .filter((r) => r.id !== superviseeId)
        .map((r) => ({ id: r.id, name: r.name ?? r.email }));
    } else if (viewerIsHrAdminEarly) {
      const orgSupervisees = await db
        .select({
          id: schema.users.id,
          name: schema.users.name,
          email: schema.users.email,
        })
        .from(schema.orgMemberships)
        .innerJoin(
          schema.users,
          eq(schema.users.id, schema.orgMemberships.userId)
        )
        .where(
          and(
            eq(schema.orgMemberships.orgId, myMembership.orgId),
            eq(schema.orgMemberships.role, "supervisee"),
            isNull(schema.orgMemberships.deactivatedAt)
          )
        );
      groupCandidates = orgSupervisees
        .filter((r) => r.id !== superviseeId)
        .map((r) => ({ id: r.id, name: r.name ?? r.email }));
    }
  }

  // Calendar integrations the HOSTING supervisor has connected — used by
  // the schedule form to pick a meeting provider (Phase 1b/1c). Empty
  // array = the form tells the actor to (have the host) connect one
  // before scheduling a virtual session.
  const viewerConnectedProviders =
    viewerCanScheduleSession && hostingSupervisorIdForPage
      ? (
          await db
            .select({
              name: schema.userCalendarIntegrations.provider,
              accountEmail: schema.userCalendarIntegrations.accountEmail,
              isPreferred: schema.userCalendarIntegrations.isPreferred,
            })
            .from(schema.userCalendarIntegrations)
            .where(
              and(
                eq(
                  schema.userCalendarIntegrations.userId,
                  hostingSupervisorIdForPage
                ),
                isNull(schema.userCalendarIntegrations.disconnectedAt)
              )
            )
        ).filter(
          (
            r
          ): r is {
            name: "microsoft" | "google";
            accountEmail: string | null;
            isPreferred: boolean;
          } => r.name === "microsoft" || r.name === "google"
        )
      : [];

  // HR Admin only: fetch current supervisor + active supervisor options for
  // the in-page reassignment dropdown (per spec §7).
  const viewerIsHrAdmin = viewerIsHrAdminEarly;
  let currentSupervisorId: string | null = null;
  let activeSupervisorOptions: { id: string; name: string }[] = [];
  if (viewerIsHrAdmin) {
    const activeAssignment = await db.query.supervisorAssignments.findFirst({
      where: and(
        eq(schema.supervisorAssignments.superviseeId, superviseeId),
        eq(schema.supervisorAssignments.orgId, myMembership.orgId),
        isNull(schema.supervisorAssignments.endedAt)
      ),
    });
    currentSupervisorId = activeAssignment?.supervisorId ?? null;

    const supervisorRows = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
      })
      .from(schema.orgMemberships)
      .innerJoin(schema.users, eq(schema.orgMemberships.userId, schema.users.id))
      .where(
        and(
          eq(schema.orgMemberships.orgId, myMembership.orgId),
          eq(schema.orgMemberships.role, "supervisor"),
          isNull(schema.orgMemberships.deactivatedAt)
        )
      );
    activeSupervisorOptions = supervisorRows.map((s) => ({
      id: s.id,
      name: s.name ?? s.email,
    }));
  }

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

  const resolved = assignment ? resolveEvaluation(assignment, events) : null;
  const rule = resolved?.rule ?? null;
  const evalResult = resolved?.evaluation ?? null;

  const allRuleObjects = [...loadAllRules().values()];
  const allRules = allRuleObjects.map((r) => ({
    id: `${r.jurisdiction.toLowerCase()}-${r.license_code.toLowerCase()}-v${r.version}`,
    label: `${r.jurisdiction} ${r.license_code} v${r.version}`,
    summary: r.summary.split("\n")[0] ?? "",
  }));

  // Per-rule guidance for the assignment form: key_warnings + window-close
  // math from each rule's YAML. Surfaced inline so supervisors see the most
  // common audit failures at the moment they're filling out the rule.
  const ruleGuidance = allRuleObjects.map((r) => {
    const id = `${r.jurisdiction.toLowerCase()}-${r.license_code.toLowerCase()}-v${r.version}`;
    const keyWarnings = r.page_content?.key_warnings ?? [];
    const permitWindow = r.checks.find(
      (c) => c.id === "permit_expiration_window"
    );
    const permitWindowMonths =
      (permitWindow?.params?.max_months as number | undefined) ?? null;
    const preReg = r.checks.find((c) => c.id === "pre_registration_required");
    const contractFieldHelp = preReg
      ? `Required for ${r.jurisdiction} ${r.license_code} — hours before this date won't count.`
      : null;
    return { ruleId: id, keyWarnings, permitWindowMonths, contractFieldHelp };
  });

  // Read-out for the "Completed compliance tasks" section. Built from the
  // typed columns on the assignment plus any future-extensible jsonb entries.
  const completedAttestations: CompletedAttestation[] = assignment
    ? deriveCompletedAttestations(assignment)
    : [];

  // Phase 6.0 — surface a banner when the assignment is on an older version
  // than the latest available for its (state, license) pair.
  const ruleVersionDrift = (() => {
    if (!rule || !assignment) return null;
    const latest = latestVersionForState(rule.jurisdiction, rule.license_code);
    if (latest === null || latest <= rule.version) return null;
    const newRuleId =
      `${rule.jurisdiction}-${rule.license_code}-v${latest}`.toLowerCase();
    return {
      currentLabel: `${rule.jurisdiction} ${rule.license_code} v${rule.version}`,
      newLabel: `${rule.jurisdiction} ${rule.license_code} v${latest}`,
      newRuleId,
    };
  })();

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-12">
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

      {viewerIsHrAdmin && (
        <Card className="mt-6 bg-accent/40">
          <CardContent className="p-4">
            <p className="label-overline mb-2">Primary supervisor</p>
            {activeSupervisorOptions.length > 0 ? (
              <ReassignSupervisorDropdown
                superviseeId={superviseeId}
                currentSupervisorId={currentSupervisorId}
                supervisors={activeSupervisorOptions}
              />
            ) : (
              <p className="text-sm text-foreground/70">
                No active supervisors in this org yet.{" "}
                <Link
                  href="/dashboard/team"
                  className="underline text-foreground"
                >
                  Invite a supervisor
                </Link>{" "}
                before assigning.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {ruleVersionDrift && assignment && (
        <RuleVersionBanner
          assignmentId={assignment.id}
          currentLabel={ruleVersionDrift.currentLabel}
          newRuleId={ruleVersionDrift.newRuleId}
          newLabel={ruleVersionDrift.newLabel}
          viewerCanSupervise={viewerCanSupervise}
        />
      )}

      {!rule ? (
        <Card className="mt-10">
          <CardContent className="p-6">
            <Badge variant="warning" className="mb-3">
              No rule assigned
            </Badge>
            {viewerCanSupervise ? (
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
                  guidance={ruleGuidance}
                />
              </>
            ) : viewerIsManager ? (
              <>
                <h2 className="font-display text-xl font-semibold text-foreground">
                  No rule assigned yet.
                </h2>
                <p className="mt-2 text-foreground/70">
                  This supervisee's licensed supervisor hasn't picked a state rule yet.
                  Hour progress and at-risk flags will start once they do.
                </p>
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
              <RuleSummaryCard
                superviseeId={superviseeId}
                viewerCanSupervise={viewerCanSupervise}
                currentRule={{
                  jurisdiction: rule.jurisdiction,
                  licenseCode: rule.license_code,
                  version: rule.version,
                  admincode: rule.citation.admincode,
                  sourceUrl: rule.citation.url,
                  riskLevel: evalResult?.riskLevel,
                }}
                currentRuleId={assignment!.ruleId}
                currentObligationStartedAt={assignment!.obligationStartedAt
                  .toISOString()
                  .slice(0, 10)}
                currentContractFiledAt={
                  assignment!.supervisionContractFiledAt
                    ?.toISOString()
                    .slice(0, 10) ?? null
                }
                availableRules={allRules}
                guidance={ruleGuidance}
              />

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
                  <div className="space-y-2">
                    {evalResult.gaps.map((g, i) => (
                      <GapRenderer
                        key={`${g.code}-${i}`}
                        gap={g}
                        assignmentId={assignment!.id}
                        superviseeId={superviseeId}
                        viewerCanSupervise={viewerCanSupervise}
                      />
                    ))}
                  </div>
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
              <SessionsPanel
                superviseeId={superviseeId}
                viewerCanSupervise={viewerCanSupervise}
                viewerCanScheduleSession={viewerCanScheduleSession}
                connectedProviders={viewerConnectedProviders}
                hostingSupervisorName={
                  viewerCanSupervise ? null : hostingSupervisorNameForPage
                }
                hasAssignedSupervisor={
                  !!hostingSupervisorIdForPage || viewerCanSupervise
                }
                groupCandidates={groupCandidates}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Order on this page: Session log (most-touched) → Evidence packages
          (sealed history) → Completed compliance tasks (rarely-touched
          attestation receipts at the bottom). */}
      <Card className="mt-6">
        <CardContent className="p-6">
          <p className="label-overline mb-4">Session log ({events.length})</p>
          {events.length === 0 ? (
            <p className="text-sm text-foreground/60 py-4">
              No sessions logged yet.
            </p>
          ) : (
            <SessionLog
              events={events.map((e) => ({
                id: e.id,
                kind: e.kind,
                date: e.date,
                durationHours: e.durationHours,
                sessionType: e.sessionType,
                signedAt: e.signedAt,
                signatures: e.signatures ?? [],
                practiceState: e.practiceState,
              }))}
              viewerIsManager={viewerIsManager}
              viewerUserId={session.user.id}
              superviseeId={superviseeId}
              superviseeState={supervisee.state ?? null}
            />
          )}
        </CardContent>
      </Card>

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
                // documentContent's exact shape has drifted across versions
                // (the canonical hash is what audits verify, not the JSON
                // shape). Accept both the current nested shape from
                // generateEvidencePackage AND the flatter shape produced by
                // older seed/test fixtures by reading whichever is present.
                const raw = (p.documentContent ?? {}) as Record<string, unknown>;
                const nested = raw.session as
                  | { date?: string; sessionType?: string | null; kind?: string }
                  | undefined;
                const kind =
                  nested?.kind ??
                  (typeof raw.kind === "string" ? raw.kind : "supervision");
                const sessionType =
                  nested?.sessionType ??
                  (typeof raw.sessionType === "string"
                    ? raw.sessionType
                    : null);
                const date =
                  nested?.date ??
                  (typeof raw.sessionDate === "string"
                    ? raw.sessionDate
                    : "");
                return (
                  <li
                    key={p.id}
                    className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-accent/40"
                  >
                    <div className="flex gap-3 items-start min-w-0">
                      <FileSignature className="h-4 w-4 mt-1 shrink-0 text-[color:var(--color-gold)]" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {kind === "supervision"
                              ? `${sessionType ?? "supervision"} session`
                              : "Practice session"}{" "}
                            · {date.slice(0, 10)}
                          </p>
                          {/* Green "Sealed" badge so the gold icon reads as
                              "official package" rather than "still pending".
                              See feedback B3. */}
                          <Badge variant="success">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            Sealed
                          </Badge>
                        </div>
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

      {assignment && (
        <div className="mt-6">
          <CompletedAttestations
            assignmentId={assignment.id}
            superviseeId={superviseeId}
            items={completedAttestations}
            viewerCanSupervise={viewerCanSupervise}
          />
        </div>
      )}
    </div>
  );
}
