import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, desc } from "drizzle-orm";
import { AlertTriangle, CalendarDays, ShieldCheck, Video } from "lucide-react";
import { getCurrentMembership } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { riskBadgeLabel } from "@/lib/rules";
import { computeHourRings } from "@/lib/rules/hour-rings";
import { resolveEvaluationWithOverrides } from "@/lib/rules/evaluation-context-with-overrides";
import { pendingSignaturesForUser } from "@/lib/supervisee";
import { isSessionPendingSignature } from "@/lib/session-pending";
import {
  mergeRecentEvidence,
  type SealedEvidenceItem,
  type PendingSignatureItem,
} from "@/lib/supervisee-evidence";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { SessionLog } from "@/components/app/session-log";
import { HourProgressRing } from "./_hour-progress-ring";
import { LogHoursHeaderAction } from "./_log-hours-header-action";

type Props = {
  userId: string;
  userName: string | null;
  userEmail: string;
};

type SessionEventRow = typeof schema.sessionEvents.$inferSelect;

const HOUR_MS = 60 * 60 * 1000;
const JOIN_LEAD_MS = 10 * 60 * 1000;

const MEETING_PROVIDER_LABEL: Record<string, string> = {
  teams: "Microsoft Teams",
  google_meet: "Google Meet",
  in_person: "In person",
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
      <div className="flex flex-col gap-6">
        <div>
          <p className="shell-eyebrow">Supervision</p>
          <h1 className="shell-page-title mt-1">
            Welcome, {firstName(userName, userEmail)}
          </h1>
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

  const isOnLeave = membership.leaveStatus === "on_leave";
  const isPrn = membership.leaveStatus === "prn";

  // ── Multi-ring model (derives only from real rule fields) ──────────────
  const ringModel =
    rule && evalResult
      ? computeHourRings(evalResult.totals, rule.structured)
      : null;

  // ── Next supervision — earliest not-yet-ended, non-canceled session ────
  // Server Components render once per request; reading the clock here is
  // intentional and stable across the render.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const upcoming = events
    .filter(
      (e) =>
        e.kind === "supervision" &&
        e.scheduledStatus !== "canceled" &&
        e.scheduledStatus !== "no_show" &&
        !e.canceledAt &&
        e.date.getTime() + (e.durationHours ?? 0) * HOUR_MS >= nowMs
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0] ?? null;

  const supervisor = upcoming
    ? await db.query.users.findFirst({
        where: eq(schema.users.id, upcoming.loggedById),
        columns: { name: true, email: true, credentials: true },
      })
    : null;

  // ── Recently sealed — sealed packages + pending sessions, merged ───────
  const packages = await db
    .select({
      sessionEventId: schema.evidencePackages.sessionEventId,
      documentHash: schema.evidencePackages.documentHash,
      createdAt: schema.evidencePackages.createdAt,
    })
    .from(schema.evidencePackages)
    .where(
      and(
        eq(schema.evidencePackages.superviseeId, userId),
        eq(schema.evidencePackages.orgId, membership.orgId)
      )
    )
    .orderBy(desc(schema.evidencePackages.createdAt))
    .limit(8);

  const eventById = new Map(events.map((e) => [e.id, e]));
  const sealedItems: SealedEvidenceItem[] = packages.map((p) => ({
    sessionId: p.sessionEventId,
    documentHash: p.documentHash,
    sealedAt: p.createdAt,
    sessionDate: eventById.get(p.sessionEventId)?.date ?? p.createdAt,
  }));

  const pendingForMe = new Set(
    pendingSignaturesForUser(events, userId).map((e) => e.id)
  );
  const pendingItems: PendingSignatureItem[] = events
    .filter((e) => isSessionPendingSignature(e))
    .map((e) => ({
      sessionId: e.id,
      sessionDate: e.date,
      awaitingSelf: pendingForMe.has(e.id),
    }));

  const recentRows = mergeRecentEvidence(sealedItems, pendingItems, 4);

  return (
    <div className="flex flex-col gap-6">
      <div>
        {rule && (
          <p className="shell-eyebrow">
            {rule.license_code} · {rule.jurisdiction}
          </p>
        )}
        <h1 className="shell-page-title mt-1">
          Welcome back, {firstName(userName, userEmail)}
        </h1>
      </div>

      {rule && <LogHoursHeaderAction superviseeId={userId} />}

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="panel">
          <p className="label-overline mb-4">
            Licensure progress{rule ? ` · ${rule.license_code}` : ""}
          </p>
          {ringModel ? (
            <HourProgressRing
              rings={ringModel.rings}
              stats={ringModel.stats}
              riskLevel={evalResult?.riskLevel}
              riskLabel={riskBadgeLabel(evalResult?.riskLevel)}
            />
          ) : (
            <p className="text-sm text-[color:var(--text-muted)]">
              Progress will appear once your hours start logging.
            </p>
          )}
        </section>

        <NextSupervision
          session={upcoming}
          supervisorName={supervisor?.name ?? supervisor?.email ?? null}
          supervisorCredential={supervisor?.credentials?.[0] ?? null}
          rule={rule}
          nowMs={nowMs}
        />
      </div>

      <RecentlySealed rows={recentRows} />

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
    </div>
  );
}

function firstName(name: string | null, email: string): string {
  const n = name?.trim();
  if (n) return n.split(/\s+/)[0];
  return email;
}

// ── Next supervision card ────────────────────────────────────────────────

function NextSupervision({
  session,
  supervisorName,
  supervisorCredential,
  rule,
  nowMs,
}: {
  session: SessionEventRow | null;
  supervisorName: string | null;
  supervisorCredential: string | null;
  rule: { jurisdiction: string; license_code: string } | null;
  nowMs: number;
}) {
  return (
    <section className="panel flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays
            className="h-4 w-4 shrink-0 text-[color:var(--text-secondary)]"
            strokeWidth={2}
          />
          <h2 className="font-display text-lg font-semibold text-[color:var(--text-primary)]">
            Next supervision
          </h2>
        </div>
        {session?.meetingProvider && (
          <span className="status-pill status-info shrink-0">
            {MEETING_PROVIDER_LABEL[session.meetingProvider] ??
              session.meetingProvider}
          </span>
        )}
      </div>

      {!session ? (
        <p className="mt-4 text-sm text-[color:var(--text-muted)]">
          No supervision scheduled. Your supervisor books sessions from their
          dashboard.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <DateChip date={session.date} />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm text-[color:var(--text-primary)]">
                {timeRange(session.date, session.durationHours)}
              </p>
              {supervisorName && (
                <div className="mt-2 flex items-center gap-2 min-w-0">
                  <InitialsAvatar name={supervisorName} size="sm" />
                  <span className="text-sm text-[color:var(--text-primary)] truncate">
                    {supervisorName}
                    {supervisorCredential ? `, ${supervisorCredential}` : ""}
                  </span>
                </div>
              )}
              {rule && (
                <p className="mt-2 font-mono text-xs text-[color:var(--text-muted)]">
                  {rule.jurisdiction} {rule.license_code}
                  {session.sessionType ? ` · ${session.sessionType}` : ""} ·
                  counts toward hours
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isJoinable(session, nowMs) && (
              <a
                href={session.meetingJoinUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-[8px] bg-[color:var(--halo-yellow)] px-3.5 h-9 text-sm font-semibold text-[color:var(--ink-900)] hover:bg-[color:var(--halo-yellow-hover)] transition-colors"
              >
                <Video className="h-4 w-4" strokeWidth={2} />
                Join
              </a>
            )}
            <Link
              href={`/sign/${session.id}`}
              className="inline-flex items-center rounded-[8px] border border-[color:var(--border)] px-3.5 h-9 text-sm font-medium text-[color:var(--text-primary)] hover:border-[color:var(--border-strong)] transition-colors"
            >
              Prep note
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

function isJoinable(session: SessionEventRow, nowMs: number): boolean {
  if (!session.meetingJoinUrl) return false;
  const startMs = session.date.getTime();
  const endMs = startMs + (session.durationHours ?? 0) * HOUR_MS;
  return nowMs >= startMs - JOIN_LEAD_MS && nowMs < endMs;
}

function DateChip({ date }: { date: Date }) {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" })
    .format(date)
    .toUpperCase();
  return (
    <div className="flex w-14 shrink-0 flex-col items-center rounded-[8px] border border-[color:var(--border)] py-2">
      <span className="label-overline">{weekday}</span>
      <span className="font-mono text-xl font-bold leading-none text-[color:var(--text-primary)]">
        {date.getDate()}
      </span>
    </div>
  );
}

function timeRange(start: Date, durationHours: number): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const end = new Date(start.getTime() + durationHours * HOUR_MS);
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

// ── Recently sealed panel ─────────────────────────────────────────────────

function RecentlySealed({
  rows,
}: {
  rows: ReturnType<typeof mergeRecentEvidence>;
}) {
  const dateFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const stampFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section className="panel flex flex-col">
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-[color:var(--divider)]">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck
            className="h-4 w-4 shrink-0 text-[color:var(--seal-gold)]"
            strokeWidth={2}
          />
          <h2 className="font-display text-lg font-semibold text-[color:var(--text-primary)]">
            Recently sealed
          </h2>
        </div>
        {rows.length > 0 && (
          <a
            href="#session-log"
            className="text-xs font-medium text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] whitespace-nowrap"
          >
            View all &rarr;
          </a>
        )}
      </div>

      <div className="pt-4 flex flex-col gap-2.5">
        {rows.length === 0 ? (
          <p className="text-sm text-[color:var(--text-muted)] py-4 text-center">
            Nothing sealed yet. Signed sessions land here as tamper-evident
            evidence.
          </p>
        ) : (
          rows.map((row) => {
            const href = `/sign/${row.sessionId}`;
            if (row.type === "sealed") {
              return (
                <Link
                  key={row.sessionId}
                  href={href}
                  className="flex items-center justify-between gap-3 rounded-[8px] border border-[color:var(--border)] p-3.5 hover:border-[color:var(--border-strong)] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[color:var(--text-primary)]">
                      Session · {dateFmt.format(row.sessionDate)}
                    </p>
                    <p
                      className="mt-1 font-mono text-xs text-[color:var(--text-muted)]"
                      title={`sha256:${row.documentHash}`}
                    >
                      sha256:{row.documentHash.slice(0, 10)}… ·{" "}
                      {stampFmt.format(row.sealedAt)}
                    </p>
                  </div>
                  <span className="status-pill status-sealed shrink-0">Sealed</span>
                </Link>
              );
            }
            return (
              <Link
                key={row.sessionId}
                href={href}
                className="flex items-center justify-between gap-3 rounded-[8px] border border-[color:var(--border)] p-3.5 hover:border-[color:var(--border-strong)] transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[color:var(--text-primary)]">
                    Session · {dateFmt.format(row.sessionDate)}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                    {row.awaitingSelf
                      ? "Awaiting your signature"
                      : "Awaiting supervisor signature"}
                  </p>
                </div>
                <span className="status-pill status-pending shrink-0">Pending</span>
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}
