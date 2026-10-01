import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { and, eq, desc, isNull } from "drizzle-orm";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSignature,
  ShieldAlert,
} from "lucide-react";
import { auth } from "@/auth";
import {
  canSupervise,
  getCurrentMembership,
  isHrAdmin,
  isManagerRole,
} from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { ReassignSupervisorDropdown } from "@/app/app/dashboard/team/_invite-forms";
import {
  isCustomRuleId,
  latestVersionForState,
  loadAllRules,
  riskBadgeLabel,
} from "@/lib/rules";
import { resolveEvaluationWithOverrides } from "@/lib/rules/evaluation-context-with-overrides";
import { computeHourRings } from "@/lib/rules/hour-rings";
import { pendingSignaturesForSupervisor } from "@/lib/supervisor-signatures";
import { AssignRuleForm } from "./assign-rule-form";
import { HourProgressRing } from "@/app/app/dashboard/_hour-progress-ring";
import { GapGroupRenderer } from "./_gap-renderer";
import { groupGaps } from "@/lib/rules/gap-grouping";
import { RuleVersionBanner } from "./_rule-version-banner";
import {
  CompletedAttestations,
  type CompletedAttestation,
} from "./_completed-attestations";
import { NewSessionModal } from "./_new-session-modal";
import { NeedsYourActionPanel } from "./_needs-your-action-panel";
import { PracticeReviewQueue } from "./_practice-review-queue";
import {
  SessionsPendingPanel,
  type PendingSessionRow,
} from "./_sessions-pending-panel";
import { SessionLogModal } from "./_session-log-modal";

export const metadata = {
  title: "Supervisee — AuditHalo",
};

type AssignmentRow = NonNullable<
  Awaited<ReturnType<typeof db.query.superviseeRuleAssignments.findFirst>>
>;

/**
 * Server-side: derive the user-facing list of "completed compliance tasks"
 * from the assignment row. Typed columns (supervisionContractFiledAt,
 * supervisorTrainingCompletedAt + hours, permitIssuedAt + permitExpiresAt)
 * each map to one row when populated. The jsonb attestations bag handles
 * any future-extensible checks we haven't pinned typed columns for.
 */
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
      date: assignment.supervisionContractFiledAt.toISOString().slice(0, 10),
    });
  }

  if (assignment.supervisorTrainingCompletedAt) {
    out.push({
      checkId: "supervisor_training_course_required",
      label: "Supervisor training completed",
      description:
        "Date the assigned supervisor completed their state-required supervision training.",
      date: assignment.supervisorTrainingCompletedAt.toISOString().slice(0, 10),
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
  searchParams,
}: {
  params: Promise<{ superviseeId: string }>;
  searchParams: Promise<{ flagged?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Supervisees never view this page — their dashboard is the canonical
  // read-out surface (multi-ring tracker, next supervision, recently sealed,
  // session log, log-practice-hours modal). Redirecting rather than gating
  // means the page never needs to render a supervisee-safe layout.
  const viewerIsManager = isManagerRole(session.user.role);
  if (!viewerIsManager) redirect("/dashboard");

  const { superviseeId } = await params;
  const { flagged } = await searchParams;
  // ?flagged=id1,id2 — set by the DataCorrection gap action so the session-log
  // modal auto-opens with the flagged rows scrolled into view + highlighted.
  const flaggedSessionIds = flagged
    ? flagged.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const viewerCanSupervise = canSupervise(session.user.role);
  const viewerIsHrAdmin = isHrAdmin(session.user.role);
  const viewerCanScheduleSession = viewerCanSupervise || viewerIsHrAdmin;

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

  // Who hosts sessions scheduled from this page:
  //   Supervisor viewing → themselves.
  //   HR Admin viewing   → the supervisee's currently-assigned supervisor.
  // Resolved here so the modal form can fetch the right user's calendar
  // integrations + show "Scheduling on behalf of …".
  let hostingSupervisorId: string | null = null;
  let hostingSupervisorName: string | null = null;
  if (viewerCanSupervise) {
    hostingSupervisorId = session.user.id;
  } else if (viewerIsHrAdmin) {
    const activeAssignmentForScheduling =
      await db.query.supervisorAssignments.findFirst({
        where: and(
          eq(schema.supervisorAssignments.superviseeId, superviseeId),
          eq(schema.supervisorAssignments.orgId, myMembership.orgId),
          isNull(schema.supervisorAssignments.endedAt)
        ),
      });
    if (activeAssignmentForScheduling) {
      hostingSupervisorId =
        activeAssignmentForScheduling.supervisorId ?? null;
      const sup = hostingSupervisorId
        ? await db.query.users.findFirst({
            where: eq(schema.users.id, hostingSupervisorId),
            columns: { name: true, email: true },
          })
        : null;
      hostingSupervisorName = sup?.name ?? sup?.email ?? null;
    }
  }

  // Group-session candidates (Phase 5): same scope as the calendar-page roster.
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
            eq(schema.supervisorAssignments.supervisorId, session.user.id),
            eq(schema.supervisorAssignments.orgId, myMembership.orgId),
            isNull(schema.supervisorAssignments.endedAt)
          )
        );
      groupCandidates = assignmentRows
        .filter((r) => r.id !== superviseeId)
        .map((r) => ({ id: r.id, name: r.name ?? r.email }));
    } else if (viewerIsHrAdmin) {
      const orgSupervisees = await db
        .select({
          id: schema.users.id,
          name: schema.users.name,
          email: schema.users.email,
        })
        .from(schema.orgMemberships)
        .innerJoin(schema.users, eq(schema.users.id, schema.orgMemberships.userId))
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

  // Calendar integrations for the hosting supervisor — feeds the schedule
  // form's provider picker. Empty = form tells the actor to (have the host)
  // connect one before scheduling a virtual session.
  const connectedProviders =
    viewerCanScheduleSession && hostingSupervisorId
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
                  hostingSupervisorId
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

  // Viewer's professional credentials — auto-populate the log-session form.
  const viewerCredentials = viewerCanSupervise
    ? (
        await db.query.users.findFirst({
          where: eq(schema.users.id, session.user.id),
          columns: { credentials: true },
        })
      )?.credentials as string[] | null
    : null;

  // HR Admin only: current supervisor + active supervisor options for the
  // in-page reassignment dropdown.
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

  const resolved = assignment
    ? await resolveEvaluationWithOverrides(assignment, events)
    : null;
  const rule = resolved?.rule ?? null;
  const evalResult = resolved?.evaluation ?? null;

  const allRuleObjects = [...loadAllRules().values()];
  const canonicalRules = allRuleObjects.map((r) => ({
    id: `${r.jurisdiction.toLowerCase()}-${r.license_code.toLowerCase()}-v${r.version}`,
    label: `${r.jurisdiction} ${r.license_code} v${r.version}`,
    summary: r.summary.split("\n")[0] ?? "",
  }));

  const orgCustomRows = await db
    .select()
    .from(schema.orgRuleOverrides)
    .where(
      and(
        eq(schema.orgRuleOverrides.orgId, myMembership.orgId),
        eq(schema.orgRuleOverrides.isActive, true),
        isNull(schema.orgRuleOverrides.canonicalRuleId)
      )
    );
  const customRules = orgCustomRows.map((r) => ({
    id: `org:${myMembership.orgId}:custom:${r.jurisdiction.toLowerCase()}-${r.licenseCode.toLowerCase()}-v${r.version}`,
    label: `${r.label} (org-created)`,
    summary:
      (r.customMetadata as { summary?: string } | null)?.summary?.split("\n")[0] ??
      "Org-created custom rule",
  }));
  const allRules = [...canonicalRules, ...customRules];

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

  const completedAttestations: CompletedAttestation[] = assignment
    ? deriveCompletedAttestations(assignment)
    : [];

  const currentCanonicalOverride =
    rule && assignment && !isCustomRuleId(assignment.ruleId)
      ? await db.query.orgRuleOverrides.findFirst({
          where: and(
            eq(schema.orgRuleOverrides.orgId, myMembership.orgId),
            eq(
              schema.orgRuleOverrides.canonicalRuleId,
              `${rule.jurisdiction}-${rule.license_code}-v${rule.version}`.toLowerCase()
            ),
            eq(schema.orgRuleOverrides.isActive, true)
          ),
        })
      : null;

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
      currentOverrideId: currentCanonicalOverride?.id ?? null,
    };
  })();

  // Ring model — derived honestly from rule.structured + evaluation.totals;
  // degrades to legend-only stats when the rule provides no denominator.
  const ringModel =
    rule && evalResult ? computeHourRings(evalResult.totals, rule.structured) : null;

  // "Sessions to sign" for this viewer on THIS supervisee. Empty for HR
  // Admins (they don't sign). The full-org query is React-cached so the
  // layout's nav-badge query is shared.
  const pendingSignaturesForThisSupervisee = viewerCanSupervise
    ? (
        await pendingSignaturesForSupervisor(session.user.id, myMembership.orgId)
      ).filter((r) => r.superviseeId === superviseeId)
    : [];

  // Practice-hour approvals owed by supervisors on this supervisee.
  const pendingPractice = viewerCanSupervise
    ? events
        .filter((e) => e.kind === "practice" && !e.approvedAt)
        .map((e) => ({
          id: e.id,
          date: e.date.toISOString().slice(0, 10),
          durationHours: e.durationHours,
          directContactHours: e.directContactHours,
          practiceState: e.practiceState,
        }))
    : [];

  // Sessions pending — upcoming supervision that hasn't happened yet and
  // isn't canceled or no-show. Server Component renders once per request;
  // reading the clock here is intentional and stable across the render.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const sessionsPending: PendingSessionRow[] = events
    .filter(
      (e) =>
        e.kind === "supervision" &&
        e.scheduledStatus !== "canceled" &&
        e.scheduledStatus !== "no_show" &&
        e.date.getTime() >= nowMs
    )
    .map((e) => ({
      id: e.id,
      date: e.date,
      durationHours: e.durationHours,
      sessionType: e.sessionType,
      meetingProvider: e.meetingProvider,
      scheduledStatus: e.scheduledStatus,
    }));

  const subLine =
    supervisee.state && rule?.license_code
      ? `${supervisee.state} · ${rule.license_code}`
      : supervisee.email;

  return (
    <>
      <div>
        <p className="shell-eyebrow">Supervisee</p>
        <h1 className="shell-page-title mt-1">
          {supervisee.name ?? supervisee.email}
        </h1>
        <p className="shell-page-sub">
          {supervisee.state && rule?.license_code ? (
            <span className="font-mono">{subLine}</span>
          ) : (
            subLine
          )}
        </p>
      </div>

      {viewerIsHrAdmin && (
        <div className="panel panel-tight">
          <p className="label-overline mb-2">Primary supervisor</p>
          {activeSupervisorOptions.length > 0 ? (
            <ReassignSupervisorDropdown
              superviseeId={superviseeId}
              currentSupervisorId={currentSupervisorId}
              supervisors={activeSupervisorOptions}
            />
          ) : (
            <p className="text-sm text-[color:var(--text-secondary)]">
              No active supervisors in this org yet.{" "}
              <Link
                href="/dashboard/team"
                className="underline text-[color:var(--text-primary)]"
              >
                Invite a supervisor
              </Link>{" "}
              before assigning.
            </p>
          )}
        </div>
      )}

      {ruleVersionDrift && assignment && (
        <RuleVersionBanner
          assignmentId={assignment.id}
          currentLabel={ruleVersionDrift.currentLabel}
          newRuleId={ruleVersionDrift.newRuleId}
          newLabel={ruleVersionDrift.newLabel}
          viewerCanSupervise={viewerCanSupervise}
          currentOverrideId={ruleVersionDrift.currentOverrideId}
        />
      )}

      {!rule ? (
        <div className="panel border-l-[3px] border-l-[color:var(--warn-500)]">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--warn-500)]" />
            <div>
              <p className="font-medium text-[color:var(--text-primary)]">
                No state rule assigned
              </p>
              <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                {viewerCanSupervise
                  ? "This supervisee's compliance tracking is paused. Assign a state rule below to start tracking hours and audit readiness."
                  : "The assigned supervisor needs to set a state rule before compliance tracking can begin."}
              </p>
            </div>
          </div>
          {viewerCanSupervise && (
            <AssignRuleForm
              superviseeId={superviseeId}
              availableRules={allRules}
              guidance={ruleGuidance}
            />
          )}
        </div>
      ) : (
        <>
          {/* Sections 5 + 7: tracker + rule-id + gaps on the left, Needs-your-
              action on the right. Stacks on mobile; 2:1 grid on lg so the
              action panel absorbs the leftover room next to the ring. */}
          <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
          {/* Section 5: tracker + rule ID row + gaps in ONE panel. */}
          <div className="panel space-y-6 lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="label-overline">Licensure progress</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[color:var(--text-secondary)]">
                  <span className="font-mono text-[color:var(--text-primary)]">
                    {rule.jurisdiction} {rule.license_code} v{rule.version}
                  </span>
                  <span className="font-mono text-xs text-[color:var(--text-muted)]">
                    {rule.citation.admincode}
                  </span>
                  {currentCanonicalOverride && (
                    <span className="status-pill status-warn">
                      Override active
                    </span>
                  )}
                  {assignment && isCustomRuleId(assignment.ruleId) && (
                    <span className="status-pill status-warn inline-flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" />
                      Org-created · not board-verified
                    </span>
                  )}
                  <a
                    href={rule.citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] underline decoration-dotted"
                  >
                    View source
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>
              {viewerCanScheduleSession && (
                <NewSessionModal
                  superviseeId={superviseeId}
                  viewerCanSupervise={viewerCanSupervise}
                  viewerCanScheduleSession={viewerCanScheduleSession}
                  connectedProviders={connectedProviders}
                  hostingSupervisorName={
                    viewerCanSupervise ? null : hostingSupervisorName
                  }
                  hasAssignedSupervisor={
                    !!hostingSupervisorId || viewerCanSupervise
                  }
                  groupCandidates={groupCandidates}
                  supervisorCredentials={viewerCredentials}
                  contractFiled={!!assignment?.supervisionContractFiledAt}
                />
              )}
            </div>

            {ringModel && (
              <HourProgressRing
                rings={ringModel.rings}
                stats={ringModel.stats}
                riskLevel={evalResult?.riskLevel}
                riskLabel={riskBadgeLabel(evalResult?.riskLevel)}
              />
            )}

            {evalResult && evalResult.gaps.length > 0 && (
              <div id="gaps">
                <p className="label-overline mb-2">Gaps and warnings</p>
                <div className="space-y-2">
                  {groupGaps(evalResult.gaps).map((group) => (
                    <GapGroupRenderer
                      key={group.code}
                      group={group}
                      assignmentId={assignment!.id}
                      superviseeId={superviseeId}
                      viewerCanSupervise={viewerCanSupervise}
                    />
                  ))}
                </div>
              </div>
            )}

            {evalResult && evalResult.gaps.length === 0 && (
              <div className="flex gap-3 p-3 rounded-[8px] text-sm border border-[color:var(--ok-700)]/30 bg-[color:var(--ok-50)] dark:bg-[rgba(30,138,84,0.1)]">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-[color:var(--ok-700)]" />
                <span className="text-[color:var(--text-primary)]">
                  All checks pass. Hours are accruing correctly under{" "}
                  {rule.jurisdiction} {rule.license_code} v{rule.version}.
                </span>
              </div>
            )}
          </div>

            <NeedsYourActionPanel
              pendingSignatures={pendingSignaturesForThisSupervisee}
            />
          </div>

          {/* Practice-hours approvals live full-width here (not inside the
              side panel) because the queue is table-shaped and doesn't fit
              a narrow column cleanly. */}
          {pendingPractice.length > 0 && (
            <div className="panel">
              <p className="label-overline mb-3">
                Practice hours to approve ({pendingPractice.length})
              </p>
              <PracticeReviewQueue entries={pendingPractice} />
            </div>
          )}

          <SessionsPendingPanel rows={sessionsPending} />
        </>
      )}

      {/* Evidence packages — seal-gold treatment. id="evidence" wires the
          notifications-bell deep link (/roster/[id]#evidence). */}
      <div
        id="evidence"
        className="panel panel-flush overflow-hidden border-t-2 border-t-[color:var(--seal-gold)]"
      >
        <div className="px-5 py-4 border-b border-[color:var(--border)] flex items-center justify-between">
          <p className="label-overline">
            Evidence packages ({evidencePackages.length})
          </p>
          {evidencePackages.length === 0 && (
            <p className="text-xs text-[color:var(--text-muted)]">
              Minted when a session is fully signed
            </p>
          )}
        </div>
        {evidencePackages.length > 0 && (
          <ul className="row-zebra">
            {evidencePackages.map((p) => {
              // documentContent's shape has drifted across versions (the
              // canonical hash is what audits verify, not the JSON shape).
              // Accept both the nested shape from generateEvidencePackage AND
              // the flatter shape produced by older seed/test fixtures.
              const raw = (p.documentContent ?? {}) as Record<string, unknown>;
              const nested = raw.session as
                | { date?: string; sessionType?: string | null; kind?: string }
                | undefined;
              const kind =
                nested?.kind ??
                (typeof raw.kind === "string" ? raw.kind : "supervision");
              const sessionType =
                nested?.sessionType ??
                (typeof raw.sessionType === "string" ? raw.sessionType : null);
              const date =
                nested?.date ??
                (typeof raw.sessionDate === "string" ? raw.sessionDate : "");
              return (
                <li
                  key={p.id}
                  className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-[color:var(--surface-muted)] transition-colors"
                >
                  <div className="flex gap-3 items-start min-w-0">
                    <FileSignature className="h-4 w-4 mt-1 shrink-0 text-[color:var(--seal-gold)]" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-[color:var(--text-primary)]">
                          {kind === "supervision"
                            ? `${sessionType ?? "supervision"} session`
                            : "Practice session"}{" "}
                          · {date.slice(0, 10)}
                        </p>
                        <span className="status-pill status-sealed">Sealed</span>
                      </div>
                      <p
                        className="font-mono text-xs text-[color:var(--text-muted)] truncate"
                        title={p.documentHash}
                      >
                        {p.documentHash}
                      </p>
                    </div>
                  </div>
                  <a
                    href={`/api/evidence/${p.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--text-primary)] hover:underline shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" />
                    PDF
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Session log lives inside a modal — the button also acts as the
          "Recently sealed → View all" target via the #session-log fragment. */}
      <div className="flex items-center justify-between gap-3">
        <p className="label-overline">Session history</p>
        <SessionLogModal
          events={events.map((e) => ({
            id: e.id,
            kind: e.kind,
            date: e.date,
            durationHours: e.durationHours,
            sessionType: e.sessionType,
            signedAt: e.signedAt,
            signatures: e.signatures ?? [],
            scheduledStatus: e.scheduledStatus,
            practiceState: e.practiceState,
            approvedAt: e.approvedAt,
          }))}
          viewerUserId={session.user.id}
          superviseeId={superviseeId}
          superviseeState={supervisee.state ?? null}
          flaggedSessionIds={flaggedSessionIds}
          totalCount={events.length}
        />
      </div>

      {assignment && (
        <CompletedAttestations
          assignmentId={assignment.id}
          superviseeId={superviseeId}
          items={completedAttestations}
          viewerCanSupervise={viewerCanSupervise}
        />
      )}
    </>
  );
}
