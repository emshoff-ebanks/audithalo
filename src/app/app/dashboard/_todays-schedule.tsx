import Link from "next/link";
import { and, asc, eq, gt, gte, inArray, isNull, lt } from "drizzle-orm";
import { CalendarClock, Video } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db, schema } from "@/lib/db";

type Props = {
  orgId: string;
  /** Which supervisees the viewer is allowed to see sessions for. When
   *  null, the widget reads every session in the org (HR Admin path). */
  allowedSuperviseeIds: string[] | null;
};

/**
 * "Today" widget on the supervisor / HR Admin dashboard home.
 *
 * Renders the supervision sessions scheduled for today, chronologically.
 * If the day is empty, surfaces the next scheduled session so the user
 * isn't staring at a blank card. Per UX-principle no.3 (no empty
 * sections), the whole widget hides when there are no upcoming sessions
 * at all.
 */
export async function TodaysSchedule({ orgId, allowedSuperviseeIds }: Props) {
  if (allowedSuperviseeIds && allowedSuperviseeIds.length === 0) return null;

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const whereToday = and(
    eq(schema.sessionEvents.orgId, orgId),
    eq(schema.sessionEvents.kind, "supervision"),
    gte(schema.sessionEvents.date, startOfToday),
    lt(schema.sessionEvents.date, startOfTomorrow),
    isNull(schema.sessionEvents.canceledAt),
    allowedSuperviseeIds
      ? inArray(
          schema.sessionEvents.superviseeId,
          allowedSuperviseeIds as [string, ...string[]]
        )
      : undefined
  );

  const todayRows = await db
    .select({
      id: schema.sessionEvents.id,
      superviseeId: schema.sessionEvents.superviseeId,
      date: schema.sessionEvents.date,
      durationHours: schema.sessionEvents.durationHours,
      sessionType: schema.sessionEvents.sessionType,
      scheduledStatus: schema.sessionEvents.scheduledStatus,
      signedAt: schema.sessionEvents.signedAt,
      meetingJoinUrl: schema.sessionEvents.meetingJoinUrl,
      meetingProvider: schema.sessionEvents.meetingProvider,
      superviseeName: schema.users.name,
      superviseeEmail: schema.users.email,
    })
    .from(schema.sessionEvents)
    .innerJoin(
      schema.users,
      eq(schema.users.id, schema.sessionEvents.superviseeId)
    )
    .where(whereToday)
    .orderBy(asc(schema.sessionEvents.date));

  // When nothing's scheduled for today, surface the next upcoming so the
  // section still tells a story instead of rendering a hollow "nothing
  // today" pane.
  let nextUpcoming: typeof todayRows[number] | null = null;
  if (todayRows.length === 0) {
    const upcomingRows = await db
      .select({
        id: schema.sessionEvents.id,
        superviseeId: schema.sessionEvents.superviseeId,
        date: schema.sessionEvents.date,
        durationHours: schema.sessionEvents.durationHours,
        sessionType: schema.sessionEvents.sessionType,
        scheduledStatus: schema.sessionEvents.scheduledStatus,
        signedAt: schema.sessionEvents.signedAt,
        meetingJoinUrl: schema.sessionEvents.meetingJoinUrl,
        meetingProvider: schema.sessionEvents.meetingProvider,
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
          eq(schema.sessionEvents.orgId, orgId),
          eq(schema.sessionEvents.kind, "supervision"),
          gt(schema.sessionEvents.date, startOfTomorrow),
          eq(schema.sessionEvents.scheduledStatus, "scheduled"),
          isNull(schema.sessionEvents.canceledAt),
          allowedSuperviseeIds
            ? inArray(
                schema.sessionEvents.superviseeId,
                allowedSuperviseeIds as [string, ...string[]]
              )
            : undefined
        )
      )
      .orderBy(asc(schema.sessionEvents.date))
      .limit(1);
    nextUpcoming = upcomingRows[0] ?? null;
  }

  // Hide entirely when there is no current or upcoming activity — the
  // dashboard shouldn't pad itself with empty widgets.
  if (todayRows.length === 0 && !nextUpcoming) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Today
        </h2>
        <Link
          href="/dashboard/calendar"
          className="text-xs text-foreground/60 hover:text-foreground"
        >
          Open calendar &rarr;
        </Link>
      </div>

      {todayRows.length === 0 && nextUpcoming ? (
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <CalendarClock className="h-5 w-5 text-foreground/60" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">
                No supervision sessions today.
              </p>
              <p className="text-xs text-foreground/60 mt-0.5">
                Next: {nextUpcoming.superviseeName ?? nextUpcoming.superviseeEmail}
                {" · "}
                {formatDateTime(nextUpcoming.date)}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/roster/${nextUpcoming.superviseeId}`}>
                Open
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {todayRows.map((row) => {
            const startMs = row.date.getTime();
            const endMs = startMs + row.durationHours * 60 * 60_000;
            const nowMs = now.getTime();
            const joinable =
              !!row.meetingJoinUrl &&
              nowMs >= startMs - 10 * 60_000 &&
              nowMs < endMs;
            const happeningNow = nowMs >= startMs && nowMs < endMs;
            return (
              <li key={row.id}>
                <Card
                  className={
                    happeningNow
                      ? "border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/5"
                      : ""
                  }
                >
                  <CardContent className="p-4 flex flex-wrap items-center gap-3">
                    <div className="flex flex-col items-start min-w-[100px]">
                      <p className="font-mono text-sm text-foreground">
                        {formatTime(row.date)}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-foreground/50">
                        {row.durationHours}h{" "}
                        {row.sessionType ?? "supervision"}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/dashboard/roster/${row.superviseeId}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {row.superviseeName ?? row.superviseeEmail}
                      </Link>
                      {happeningNow && (
                        <p className="text-xs text-[color:var(--color-warning)] font-medium mt-0.5">
                          Happening now
                        </p>
                      )}
                      {!happeningNow && row.signedAt && (
                        <p className="text-xs text-[color:var(--color-success)] mt-0.5">
                          Signed
                        </p>
                      )}
                    </div>
                    {joinable && row.meetingJoinUrl && (
                      <Button asChild size="sm">
                        <a
                          href={row.meetingJoinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Video className="h-3.5 w-3.5" />
                          Join
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatTime(d: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}
