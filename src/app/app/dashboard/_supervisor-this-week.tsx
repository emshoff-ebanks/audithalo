import Link from "next/link";
import { and, asc, eq, gte, inArray, isNull, lt, ne, or } from "drizzle-orm";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { db, schema } from "@/lib/db";

type Props = {
  orgId: string;
  /** Supervisees the viewer may see sessions for. null = whole org (HR
   *  Admin path — skip the inArray filter). */
  allowedSuperviseeIds: string[] | null;
  /** Week offset from the current week: 0 = this week, -1 = last, etc.
   *  Bookmarkable via ?wk=<int> (design-system-v2.md §9 URL-state). */
  weekOffset: number;
};

const TZ = "America/New_York";
const DAY_MS = 24 * 60 * 60_000;
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * Roster-wide "This week" rollup on the supervisor overview. Seven Mon→Sun
 * day cells with a supervision-session count badge, today's cell filled,
 * plus a week total / distinct-supervisees / group-session summary. Read
 * from the same session_events data as the calendar; week starts Monday in
 * the org timezone to match _todays-schedule.tsx.
 */
export async function SupervisorThisWeek({
  orgId,
  allowedSuperviseeIds,
  weekOffset,
}: Props) {
  const now = new Date();
  const nowInTz = new Date(now.toLocaleString("en-US", { timeZone: TZ }));
  const tzOffsetMs = nowInTz.getTime() - now.getTime();

  // Monday 00:00 (org-local) of the target week.
  const startLocal = new Date(nowInTz);
  startLocal.setHours(0, 0, 0, 0);
  const dow = (startLocal.getDay() + 6) % 7; // 0 = Monday
  startLocal.setDate(startLocal.getDate() - dow + weekOffset * 7);
  const endLocal = new Date(startLocal);
  endLocal.setDate(endLocal.getDate() + 7);

  const startUtc = new Date(startLocal.getTime() - tzOffsetMs);
  const endUtc = new Date(endLocal.getTime() - tzOffsetMs);

  const rows =
    allowedSuperviseeIds && allowedSuperviseeIds.length === 0
      ? []
      : await db
          .select({
            id: schema.sessionEvents.id,
            superviseeId: schema.sessionEvents.superviseeId,
            date: schema.sessionEvents.date,
            sessionType: schema.sessionEvents.sessionType,
            timeZone: schema.sessionEvents.timeZone,
          })
          .from(schema.sessionEvents)
          .where(
            and(
              eq(schema.sessionEvents.orgId, orgId),
              eq(schema.sessionEvents.kind, "supervision"),
              gte(schema.sessionEvents.date, startUtc),
              lt(schema.sessionEvents.date, endUtc),
              isNull(schema.sessionEvents.canceledAt),
              // NULL-safe no-show exclusion: legacy after-the-fact logs have
              // scheduled_status = NULL and must stay visible (a bare
              // `<> 'no_show'` would drop them, since NULL <> x is UNKNOWN).
              or(
                isNull(schema.sessionEvents.scheduledStatus),
                ne(schema.sessionEvents.scheduledStatus, "no_show")
              ),
              allowedSuperviseeIds
                ? inArray(
                    schema.sessionEvents.superviseeId,
                    allowedSuperviseeIds as [string, ...string[]]
                  )
                : undefined
            )
          )
          .orderBy(asc(schema.sessionEvents.date));

  // Bucket by day index 0..6 relative to Monday. Uses the now-anchored tz
  // offset (DST shifts within a single week are rare and non-material).
  const countByDay = new Array(7).fill(0);
  for (const r of rows) {
    const idx = Math.floor((r.date.getTime() - startUtc.getTime()) / DAY_MS);
    if (idx >= 0 && idx < 7) countByDay[idx] += 1;
  }

  const todayIdx = Math.floor((now.getTime() - startUtc.getTime()) / DAY_MS);
  const distinctSupervisees = new Set(rows.map((r) => r.superviseeId)).size;
  const groupSessions = rows.filter((r) => r.sessionType === "group");

  const rangeLabel = formatRange(startLocal, endLocal);

  return (
    <section className="panel flex flex-col">
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-[color:var(--divider)]">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="h-4 w-4 shrink-0 text-[color:var(--text-secondary)]" strokeWidth={2} />
          <h2 className="font-display text-lg font-semibold text-[color:var(--text-primary)]">
            This week
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <WeekNavLink offset={weekOffset - 1} label="Previous week">
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          </WeekNavLink>
          <span className="font-mono text-xs text-[color:var(--text-secondary)] tabular-nums whitespace-nowrap">
            {rangeLabel}
          </span>
          <WeekNavLink offset={weekOffset + 1} label="Next week">
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </WeekNavLink>
        </div>
      </div>

      <div className="pt-4 grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }, (_, idx) => {
          const dayDate = new Date(startLocal);
          dayDate.setDate(startLocal.getDate() + idx);
          const isToday = idx === todayIdx;
          const c = countByDay[idx];
          const iso = toIsoDay(dayDate);
          return (
            <Link
              key={idx}
              href={`/dashboard/calendar?date=${iso}`}
              aria-label={`${c} session${c === 1 ? "" : "s"} on ${iso}`}
              className={`flex flex-col items-center gap-1.5 rounded-[8px] border px-1 py-2.5 transition-colors ${
                isToday
                  ? "border-[color:var(--ink-900)] bg-[color:var(--ink-900)] text-[color:var(--paper-50)]"
                  : "border-[color:var(--border)] hover:border-[color:var(--border-strong)]"
              }`}
            >
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide ${
                  isToday ? "opacity-80" : "text-[color:var(--text-muted)]"
                }`}
              >
                {DAY_LABELS[idx]}
              </span>
              <span className="font-mono text-sm tabular-nums">
                {dayDate.getDate()}
              </span>
              {c > 0 ? (
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-[11px] font-semibold ${
                    isToday
                      ? "bg-[color:var(--paper-50)] text-[color:var(--ink-900)]"
                      : "bg-[color:var(--halo-yellow)] text-[color:var(--ink-900)]"
                  }`}
                >
                  {c}
                </span>
              ) : (
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isToday
                      ? "bg-[color:var(--paper-50)]/40"
                      : "bg-[color:var(--ink-300)]"
                  }`}
                  aria-hidden
                />
              )}
            </Link>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-[color:var(--divider)] flex flex-col gap-2 text-sm text-[color:var(--text-secondary)]">
        <SummaryLine n={rows.length} unit="supervision session" />
        <SummaryLine n={distinctSupervisees} unit="different supervisee" />
        {groupSessions.length > 0 && (
          <p>
            <span className="font-mono tabular-nums text-[color:var(--text-primary)]">
              {groupSessions.length}
            </span>{" "}
            group session{groupSessions.length === 1 ? "" : "s"}
            {" · "}
            <span className="font-mono">
              {formatDayTime(groupSessions[0].date, groupSessions[0].timeZone)}
            </span>
          </p>
        )}
      </div>
    </section>
  );
}

function WeekNavLink({
  offset,
  label,
  children,
}: {
  offset: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={offset === 0 ? "/dashboard" : `/dashboard?wk=${offset}`}
      scroll={false}
      aria-label={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--text-secondary)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-primary)] transition-colors"
    >
      {children}
    </Link>
  );
}

function SummaryLine({ n, unit }: { n: number; unit: string }) {
  return (
    <p>
      <span className="font-mono tabular-nums text-[color:var(--text-primary)]">
        {n}
      </span>{" "}
      {unit}
      {n === 1 ? "" : "s"}
    </p>
  );
}

/** "Sep 14–20" or "Sep 28 – Oct 4" across a month boundary. `end` is the
 *  exclusive Monday of the next week, so the visible Sunday is end-1. */
function formatRange(start: Date, end: Date): string {
  const lastDay = new Date(end);
  lastDay.setDate(lastDay.getDate() - 1);
  const mon = new Intl.DateTimeFormat("en-US", { month: "short" });
  const startMonth = mon.format(start);
  const endMonth = mon.format(lastDay);
  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()}–${lastDay.getDate()}`;
  }
  return `${startMonth} ${start.getDate()} – ${endMonth} ${lastDay.getDate()}`;
}

function toIsoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDayTime(d: Date, timeZone?: string | null): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timeZone ?? TZ,
  }).format(d);
}
