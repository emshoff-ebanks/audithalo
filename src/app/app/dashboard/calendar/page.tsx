import { and, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  canSupervise,
  getCurrentMembership,
  isHrAdmin,
} from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { CalendarView } from "./_calendar-view";
import type { CalendarEvent, ViewMode } from "./_types";

export const metadata = { title: "Calendar — AuditHalo" };

const VALID_VIEWS: ViewMode[] = ["week", "month", "list"];

function parseAnchor(s: string | undefined): Date {
  if (!s) return new Date();
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function rangeFor(view: ViewMode, anchor: Date): { start: Date; end: Date } {
  if (view === "month") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
    // Pad to whole weeks so the grid fills cleanly. Mon-start.
    const startDow = (start.getDay() + 6) % 7;
    const endDow = (end.getDay() + 6) % 7;
    start.setDate(start.getDate() - startDow);
    end.setDate(end.getDate() + (endDow === 0 ? 0 : 7 - endDow));
    return { start, end };
  }
  if (view === "week") {
    const start = new Date(anchor);
    const dow = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - dow);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }
  // list: 30 days centered on anchor (14 back, 16 forward).
  const start = new Date(anchor);
  start.setDate(start.getDate() - 14);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 30);
  return { start, end };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) redirect("/dashboard");

  const role = membership.role;
  const viewerIsManager = canSupervise(role) || isHrAdmin(role);

  const sp = await searchParams;
  const view: ViewMode = VALID_VIEWS.includes(sp.view as ViewMode)
    ? (sp.view as ViewMode)
    : "week";
  const anchor = parseAnchor(sp.date);
  const { start, end } = rangeFor(view, anchor);

  // Which supervisees this viewer can see sessions for:
  //   - Supervisor: those they're currently assigned to (Phase 1d uses
  //     supervisor_assignments as the source of truth).
  //   - HR Admin: every supervisee in the org.
  //   - Supervisee: themselves only.
  let allowedSuperviseeIds: string[];
  if (canSupervise(role)) {
    const rows = await db
      .select({ superviseeId: schema.supervisorAssignments.superviseeId })
      .from(schema.supervisorAssignments)
      .where(
        and(
          eq(schema.supervisorAssignments.supervisorId, session.user.id),
          eq(schema.supervisorAssignments.orgId, membership.orgId),
          isNull(schema.supervisorAssignments.endedAt)
        )
      );
    allowedSuperviseeIds = rows.map((r) => r.superviseeId);
  } else if (isHrAdmin(role)) {
    const rows = await db
      .select({ userId: schema.orgMemberships.userId })
      .from(schema.orgMemberships)
      .where(
        and(
          eq(schema.orgMemberships.orgId, membership.orgId),
          eq(schema.orgMemberships.role, "supervisee"),
          isNull(schema.orgMemberships.deactivatedAt)
        )
      );
    allowedSuperviseeIds = rows.map((r) => r.userId);
  } else {
    // Supervisee or Executive — calendar limited to own sessions for now.
    allowedSuperviseeIds = [session.user.id];
  }

  // Sessions in window + roster. Drizzle has no DATE BETWEEN helper that
  // composes well, so use gte+lt against session_events.date.
  let events: CalendarEvent[] = [];
  if (allowedSuperviseeIds.length > 0) {
    const rows = await db
      .select({
        id: schema.sessionEvents.id,
        superviseeId: schema.sessionEvents.superviseeId,
        startUtc: schema.sessionEvents.date,
        durationHours: schema.sessionEvents.durationHours,
        sessionType: schema.sessionEvents.sessionType,
        kind: schema.sessionEvents.kind,
        scheduledStatus: schema.sessionEvents.scheduledStatus,
        signedAt: schema.sessionEvents.signedAt,
        meetingProvider: schema.sessionEvents.meetingProvider,
        meetingJoinUrl: schema.sessionEvents.meetingJoinUrl,
        timeZone: schema.sessionEvents.timeZone,
        loggedById: schema.sessionEvents.loggedById,
        recurringSeriesId: schema.sessionEvents.recurringSeriesId,
        superviseeName: schema.users.name,
        superviseeEmail: schema.users.email,
      })
      .from(schema.sessionEvents)
      .innerJoin(
        schema.users,
        eq(schema.users.id, schema.sessionEvents.superviseeId)
      )
      .where(
        and(
          inArray(schema.sessionEvents.superviseeId, allowedSuperviseeIds),
          eq(schema.sessionEvents.orgId, membership.orgId),
          gte(schema.sessionEvents.date, start),
          lte(schema.sessionEvents.date, end),
          // Exclude pure practice events from the schedule view — the
          // calendar is for supervision sessions. Practice still shows
          // up on the supervisee detail page.
          or(
            eq(schema.sessionEvents.kind, "supervision"),
            // Scheduled-but-not-clinical (unusual) — keep visible.
            isNull(schema.sessionEvents.scheduledStatus)
          )
        )
      )
      .orderBy(desc(schema.sessionEvents.date));

    // HR Admin variant adds the supervisor column. We pull supervisor
    // info via the active supervisor_assignments row, NOT loggedById,
    // because loggedById can be the HR Admin who scheduled on behalf.
    const supervisorMap = new Map<string, { id: string; name: string | null; email: string }>();
    if (isHrAdmin(role) && rows.length > 0) {
      const superviseeIds = Array.from(
        new Set(rows.map((r) => r.superviseeId))
      );
      const assignments = await db
        .select({
          superviseeId: schema.supervisorAssignments.superviseeId,
          supervisorId: schema.supervisorAssignments.supervisorId,
          supervisorName: schema.users.name,
          supervisorEmail: schema.users.email,
        })
        .from(schema.supervisorAssignments)
        .innerJoin(
          schema.users,
          eq(schema.users.id, schema.supervisorAssignments.supervisorId)
        )
        .where(
          and(
            inArray(
              schema.supervisorAssignments.superviseeId,
              superviseeIds
            ),
            eq(schema.supervisorAssignments.orgId, membership.orgId),
            isNull(schema.supervisorAssignments.endedAt)
          )
        );
      for (const a of assignments) {
        supervisorMap.set(a.superviseeId, {
          id: a.supervisorId,
          name: a.supervisorName,
          email: a.supervisorEmail,
        });
      }
    }

    events = rows
      .filter((r) => r.kind === "supervision")
      .flatMap((r): CalendarEvent[] => {
        // Defensive: Drizzle+Neon return timestamp columns as Date, but
        // the surrounding code crashed in production when a row with an
        // unexpected shape (string date? null duration?) hit Math/Date
        // math. Skip+log instead of nuking the whole page render.
        try {
          const startDate =
            r.startUtc instanceof Date ? r.startUtc : new Date(r.startUtc as unknown as string);
          if (Number.isNaN(startDate.getTime())) {
            console.warn("[calendar] skipping row with bad date:", r.id, r.startUtc);
            return [];
          }
          const durationHoursRaw =
            typeof r.durationHours === "number"
              ? r.durationHours
              : Number(r.durationHours);
          if (!Number.isFinite(durationHoursRaw) || durationHoursRaw <= 0) {
            console.warn(
              "[calendar] skipping row with bad duration:",
              r.id,
              r.durationHours
            );
            return [];
          }
          const startMs = startDate.getTime();
          const endMs = startMs + Math.round(durationHoursRaw * 60 * 60_000);
          const sup = supervisorMap.get(r.superviseeId) ?? null;
          const ev: CalendarEvent = {
            id: r.id,
            superviseeId: r.superviseeId,
            superviseeName: r.superviseeName ?? r.superviseeEmail,
            startIso: startDate.toISOString(),
            endIso: new Date(endMs).toISOString(),
            durationMinutes: Math.round(durationHoursRaw * 60),
            sessionType: r.sessionType,
            scheduledStatus: r.scheduledStatus,
            signed: r.signedAt !== null,
            meetingProvider: r.meetingProvider,
            meetingJoinUrl: r.meetingJoinUrl,
            timeZone: r.timeZone,
            supervisorName: sup ? sup.name ?? sup.email : null,
            supervisorId: sup?.id ?? null,
            recurringSeriesId: r.recurringSeriesId ?? null,
          };
          return [ev];
        } catch (err) {
          console.error(
            "[calendar] failed to map session row, skipping:",
            r.id,
            err
          );
          return [];
        }
      });
  }

  // Supervisee picker options (for filter bar + standalone schedule modal).
  const supervisees =
    allowedSuperviseeIds.length === 0
      ? []
      : await db
          .select({
            id: schema.users.id,
            name: schema.users.name,
            email: schema.users.email,
          })
          .from(schema.users)
          .where(inArray(schema.users.id, allowedSuperviseeIds));

  return (
    <CalendarView
      view={view}
      anchorIso={anchor.toISOString()}
      rangeStartIso={start.toISOString()}
      rangeEndIso={end.toISOString()}
      events={events}
      supervisees={supervisees.map((s) => ({
        id: s.id,
        name: s.name ?? s.email,
      }))}
      viewerIsManager={viewerIsManager}
      viewerIsHrAdmin={isHrAdmin(role)}
    />
  );
}
