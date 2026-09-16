import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, desc } from "drizzle-orm";
import { ArrowRight, AlertOctagon, AlertTriangle, CheckCircle2, FileSignature } from "lucide-react";
import { getCurrentMembership } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { riskBadgeLabel } from "@/lib/rules";
import { resolveEvaluationWithOverrides } from "@/lib/rules/evaluation-context-with-overrides";
import { pendingSignaturesForUser } from "@/lib/supervisee";
import { LogSessionForm } from "@/app/app/dashboard/roster/[superviseeId]/log-session-form";
import { SessionLog } from "@/components/app/session-log";
import { SuperviseeThisWeek } from "./_supervisee-this-week";

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
      <>
        <div>
          <h1 className="shell-page-title">Welcome, {userName ?? userEmail}</h1>
          <p className="shell-page-sub">{userEmail}</p>
        </div>
        <div className="panel">
          <span className="status-pill status-warn mb-3 inline-flex">
            <AlertTriangle className="h-3 w-3" />
            No rule assigned
          </span>
          <h2 className="font-display text-xl font-semibold text-[color:var(--text-primary)] mt-1">
            Your supervisor hasn&apos;t assigned your state rule yet.
          </h2>
          <p className="mt-2 text-[color:var(--text-secondary)]">
            Reach out to your supervisor so they can pick the right rule (e.g., NC
            LCMHCA). Once they do, your hour progress and at-risk flags will start
            filling in here.
          </p>
        </div>
      </>
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

  const practiceRequired = rule?.structured.total_practice_hours_required ?? 0;
  const supervisionRequired = rule?.structured.total_supervision_hours_required ?? 0;
  const practiceHours = evalResult?.totals.practiceHours ?? 0;
  const supervisionHours = evalResult?.totals.supervisionHours ?? 0;
  const practicePct = evalResult?.progress.practiceProgressPct ?? 0;
  const supervisionPct = evalResult?.progress.supervisionProgressPct ?? 0;

  const isOnLeave = membership.leaveStatus === "on_leave";
  const isPrn = membership.leaveStatus === "prn";

  const level = evalResult?.riskLevel;
  const statusPill =
    level === "red" ? "status-risk" : level === "yellow" ? "status-warn" : level === "green" ? "status-ok" : "status-pending";
  const StatusIcon = level === "red" ? AlertOctagon : level === "yellow" ? AlertTriangle : CheckCircle2;
  const hasGaps = !!(evalResult && evalResult.gaps.length > 0);

  const statusBody = (
    <div className="panel flex flex-col gap-2 h-full">
      <p className="label-overline">Status</p>
      {evalResult ? (
        <>
          <span className={`status-pill ${statusPill} inline-flex`}>
            <StatusIcon className="h-3 w-3" />
            {riskBadgeLabel(evalResult.riskLevel)}
          </span>
          <p className="text-xs text-[color:var(--text-secondary)]">
            {hasGaps
              ? `${evalResult.gaps.length} gap${evalResult.gaps.length !== 1 ? "s" : ""} flagged · click to review`
              : "No open gaps"}
          </p>
        </>
      ) : (
        <span className="status-pill status-pending">No rule</span>
      )}
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="shell-page-title">Welcome, {userName ?? userEmail}</h1>
          <p className="shell-page-sub">{userEmail}</p>
          {rule && (
            <p className="mt-1 text-sm font-mono text-[color:var(--text-secondary)]">
              {rule.jurisdiction} {rule.license_code} · v{rule.version}
            </p>
          )}
        </div>
        {rule && (
          <Link
            href={`/dashboard/roster/${userId}`}
            className="inline-flex items-center gap-1.5 rounded-sm bg-[color:var(--ink-900)] text-[color:var(--paper-50)] dark:bg-[color:var(--paper-50)] dark:text-[color:var(--ink-900)] hover:opacity-90 px-3 h-9 text-sm font-medium"
          >
            View full record
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {isOnLeave && (
        <div className="panel border-l-[3px] border-l-[color:var(--warn-500)]">
          <span className="status-pill status-warn mb-2 inline-flex">
            <AlertTriangle className="h-3 w-3" />
            On leave
          </span>
          <p className="text-sm text-[color:var(--text-primary)]">
            Your supervision hour clock is paused. Reminders and cadence checks
            stop until HR flips your status back to active in Paycor.
          </p>
        </div>
      )}
      {isPrn && (
        <p className="text-sm text-[color:var(--text-secondary)] flex items-center gap-2 flex-wrap">
          <span className="status-pill status-pending">PRN</span>
          You&apos;ll still receive supervision reminders so they happen whenever
          you next pick up shifts.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="panel flex flex-col gap-2">
          <p className="label-overline">Practice hours</p>
          <p className="font-mono text-3xl font-bold leading-none text-[color:var(--text-primary)]">
            {practiceHours.toFixed(1)}
            <span className="text-base font-normal text-[color:var(--text-muted)]"> / {practiceRequired}</span>
          </p>
          <div className="mt-1 h-2 rounded-full overflow-hidden bg-[color:var(--ink-100)] dark:bg-[rgba(250,247,240,0.12)]">
            <div className="h-full bg-[color:var(--seal-gold)]" style={{ width: `${Math.min(100, practicePct)}%` }} />
          </div>
        </div>

        <div className="panel flex flex-col gap-2">
          <p className="label-overline">Supervision hours</p>
          <p className="font-mono text-3xl font-bold leading-none text-[color:var(--text-primary)]">
            {supervisionHours.toFixed(1)}
            <span className="text-base font-normal text-[color:var(--text-muted)]"> / {supervisionRequired}</span>
          </p>
          <div className="mt-1 h-2 rounded-full overflow-hidden bg-[color:var(--ink-100)] dark:bg-[rgba(250,247,240,0.12)]">
            <div className="h-full bg-[color:var(--seal-gold)]" style={{ width: `${Math.min(100, supervisionPct)}%` }} />
          </div>
        </div>

        {hasGaps ? (
          <Link href={`/dashboard/roster/${userId}#gaps`} aria-label="Open compliance gaps" className="block h-full">
            {statusBody}
          </Link>
        ) : (
          statusBody
        )}

        {pendingForMe.length > 0 ? (
          <a href="#session-log" aria-label="Jump to pending signatures" className="block h-full">
            <div className="panel panel-hero flex flex-col gap-2 h-full transition-[filter] hover:brightness-[0.97]">
              <FileSignature className="h-5 w-5 text-[color:var(--ink-900)]" strokeWidth={2} />
              <p className="font-display text-3xl font-bold leading-none text-[color:var(--ink-900)]">
                {pendingForMe.length}
              </p>
              <p className="label-overline !text-[color:var(--ink-900)]/70">Pending signatures · sign now</p>
            </div>
          </a>
        ) : (
          <div className="panel flex flex-col gap-2 h-full">
            <p className="label-overline">Pending signatures</p>
            <p className="font-display text-3xl font-bold leading-none text-[color:var(--text-primary)]">0</p>
            <p className="text-sm text-[color:var(--text-secondary)]">All caught up</p>
          </div>
        )}
      </div>

      <SuperviseeThisWeek
        superviseeId={userId}
        orgId={membership.orgId}
        leaveStatus={
          membership.leaveStatus as "active" | "on_leave" | "prn" | undefined
        }
      />

      {events.length > 0 && (
        <section id="session-log">
          <h2 className="font-display text-xl font-semibold text-[color:var(--text-primary)] mb-4">
            Session log
          </h2>
          <SessionLog
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
            }))}
            viewerIsManager={false}
            viewerUserId={userId}
            superviseeId={userId}
            superviseeState={null}
          />
        </section>
      )}

      <div className="panel">
        <p className="label-overline mb-3">Log practice hours</p>
        <LogSessionForm superviseeId={userId} allowSupervision={false} />
      </div>
    </>
  );
}
