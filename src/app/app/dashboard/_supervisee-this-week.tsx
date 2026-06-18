import Link from "next/link";
import { and, asc, eq, gte, inArray, isNull, lt, ne } from "drizzle-orm";
import { Video } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db, schema } from "@/lib/db";

type Props = {
  superviseeId: string;
  orgId: string;
};

/**
 * "This week" panel on the supervisee dashboard.
 *
 * Renders a 7-cell Sun→Sat row with any supervision sessions on each
 * day. Today's column is highlighted. Read-only — supervisees don't
 * schedule or cancel; clicking a session navigates to the sign screen.
 *
 * Hides entirely when the week has zero scheduled / completed
 * supervision sessions (per UX-principle "no empty widgets").
 */
export async function SuperviseeThisWeek({ superviseeId, orgId }: Props) {
  const now = new Date();
  const startOfWeek = new Date(now);
  // Snap to Sunday at 00:00 local.
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const sessions = await db
    .select({
      id: schema.sessionEvents.id,
      date: schema.sessionEvents.date,
      durationHours: schema.sessionEvents.durationHours,
      sessionType: schema.sessionEvents.sessionType,
      scheduledStatus: schema.sessionEvents.scheduledStatus,
      signedAt: schema.sessionEvents.signedAt,
      meetingJoinUrl: schema.sessionEvents.meetingJoinUrl,
      meetingProvider: schema.sessionEvents.meetingProvider,
      loggedById: schema.sessionEvents.loggedById,
    })
    .from(schema.sessionEvents)
    .where(
      and(
        eq(schema.sessionEvents.superviseeId, superviseeId),
        eq(schema.sessionEvents.orgId, orgId),
        eq(schema.sessionEvents.kind, "supervision"),
        gte(schema.sessionEvents.date, startOfWeek),
        lt(schema.sessionEvents.date, endOfWeek),
        isNull(schema.sessionEvents.canceledAt),
        // Exclude no-show rows — they would otherwise render as yellow
        // "Needs sign" cards and link to /sign/{id}, which now correctly
        // refuses to sign no-show sessions but would still confuse the
        // supervisee.
        ne(schema.sessionEvents.scheduledStatus, "no_show")
      )
    )
    .orderBy(asc(schema.sessionEvents.date));

  if (sessions.length === 0) {
    return (
      <div className="mt-10">
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">
          This week
        </h2>
        <Card>
          <CardContent className="p-5 text-sm text-foreground/70">
            No supervision sessions scheduled this week. Your supervisor adds
            them to your calendar from their dashboard.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Resolve supervisor display names for any sessions that have a logger.
  // Most supervisees stick with one supervisor; this query is tiny.
  const loggerIds = Array.from(new Set(sessions.map((s) => s.loggedById)));
  const loggers = loggerIds.length
    ? await db
        .select({
          id: schema.users.id,
          name: schema.users.name,
          email: schema.users.email,
        })
        .from(schema.users)
        .where(inArray(schema.users.id, loggerIds))
    : [];
  const loggerById = new Map(
    loggers.map((u) => [u.id, u.name ?? u.email ?? "Your supervisor"])
  );

  // Bucket sessions by day index (0=Sun..6=Sat) relative to startOfWeek.
  const sessionsByDay = new Map<number, typeof sessions>();
  for (const s of sessions) {
    const day = Math.floor(
      (s.date.getTime() - startOfWeek.getTime()) / (24 * 60 * 60_000)
    );
    if (day < 0 || day > 6) continue;
    const bucket = sessionsByDay.get(day) ?? [];
    bucket.push(s);
    sessionsByDay.set(day, bucket);
  }

  const todayIdx = Math.floor(
    (now.getTime() - startOfWeek.getTime()) / (24 * 60 * 60_000)
  );
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const nowMs = now.getTime();

  return (
    <div className="mt-10">
      <h2 className="font-display text-xl font-semibold text-foreground mb-4">
        This week
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {Array.from({ length: 7 }, (_, dayIdx) => {
          const dayDate = new Date(startOfWeek);
          dayDate.setDate(startOfWeek.getDate() + dayIdx);
          const isToday = dayIdx === todayIdx;
          const daySessions = sessionsByDay.get(dayIdx) ?? [];

          return (
            <Card
              key={dayIdx}
              className={
                isToday
                  ? "border-secondary/40 bg-secondary/5"
                  : "bg-card"
              }
            >
              <CardContent className="p-3 min-h-[110px]">
                <div className="flex items-baseline justify-between mb-2">
                  <p
                    className={`text-[10px] uppercase tracking-wide ${
                      isToday
                        ? "text-secondary font-semibold"
                        : "text-foreground/50"
                    }`}
                  >
                    {dayLabels[dayIdx]}
                  </p>
                  <p
                    className={`font-mono text-sm ${
                      isToday ? "text-foreground font-semibold" : "text-foreground/70"
                    }`}
                  >
                    {dayDate.getDate()}
                  </p>
                </div>
                {daySessions.length === 0 ? (
                  <p className="text-xs text-foreground/30">—</p>
                ) : (
                  <ul className="space-y-1.5">
                    {daySessions.map((s) => {
                      const startMs = s.date.getTime();
                      const endMs =
                        startMs + Math.round(s.durationHours * 60 * 60_000);
                      const joinable =
                        !!s.meetingJoinUrl &&
                        nowMs >= startMs - 10 * 60_000 &&
                        nowMs < endMs;
                      const isSigned = !!s.signedAt;
                      const isPast = endMs < nowMs;
                      const isHappeningNow =
                        nowMs >= startMs && nowMs < endMs;
                      return (
                        <li key={s.id}>
                          {joinable ? (
                            <Button
                              asChild
                              size="sm"
                              className="w-full h-auto py-1.5 px-2 flex flex-col items-start gap-0"
                            >
                              <a
                                href={s.meetingJoinUrl!}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <span className="flex items-center gap-1 text-xs">
                                  <Video className="h-3 w-3" />
                                  Join
                                </span>
                                <span className="text-[10px] font-mono opacity-80">
                                  {formatTime(s.date)}
                                </span>
                              </a>
                            </Button>
                          ) : (
                            <Link
                              href={`/sign/${s.id}`}
                              className={`block rounded-sm border px-2 py-1.5 text-xs transition-colors ${
                                isSigned
                                  ? "border-border bg-card/50 text-foreground/50 hover:text-foreground/70"
                                  : isPast
                                    ? "border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/5 hover:bg-[color:var(--color-warning)]/10 text-foreground"
                                    : isHappeningNow
                                      ? "border-secondary/40 bg-secondary/10 text-foreground"
                                      : "border-border hover:bg-accent text-foreground"
                              }`}
                            >
                              <p className="font-mono">{formatTime(s.date)}</p>
                              <p className="text-[10px] text-foreground/60 truncate">
                                {loggerById.get(s.loggedById) ?? "Supervisor"}
                              </p>
                              {isSigned ? (
                                <p className="text-[9px] uppercase tracking-wide text-foreground/50 mt-0.5">
                                  Signed
                                </p>
                              ) : isPast ? (
                                <p className="text-[9px] uppercase tracking-wide text-[color:var(--color-warning)] mt-0.5">
                                  Needs sign
                                </p>
                              ) : null}
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function formatTime(d: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}
