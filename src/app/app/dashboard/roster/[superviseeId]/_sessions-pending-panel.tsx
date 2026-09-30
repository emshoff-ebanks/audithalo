import Link from "next/link";
import { format } from "date-fns";
import { CalendarDays, ChevronRight } from "lucide-react";

const MEETING_PROVIDER_LABEL: Record<string, string> = {
  teams: "Microsoft Teams",
  google_meet: "Google Meet",
  in_person: "In person",
};

export type PendingSessionRow = {
  id: string;
  date: Date;
  durationHours: number;
  sessionType: string | null;
  meetingProvider: string | null;
  scheduledStatus: string | null;
};

type Props = {
  rows: PendingSessionRow[];
};

/**
 * Upcoming supervision sessions that have neither happened nor been
 * canceled. Sorted soonest-first. Rows link into /sign/<id> as a stand-in
 * detail view (the sign page already renders the session card + status).
 *
 * Zero-state: panel hides entirely — no empty containers on this page.
 */
export function SessionsPendingPanel({ rows }: Props) {
  if (rows.length === 0) return null;

  const sorted = [...rows].sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="panel panel-flush overflow-hidden">
      <div className="px-5 py-4 border-b border-[color:var(--border)] flex items-center justify-between">
        <p className="label-overline">Sessions pending ({rows.length})</p>
      </div>
      <ul className="row-zebra">
        {sorted.map((r) => (
          <li key={r.id}>
            <Link
              href={`/sign/${r.id}`}
              className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-[color:var(--surface-muted)] transition-colors"
            >
              <div className="flex items-start gap-3 min-w-0">
                <CalendarDays
                  className="h-4 w-4 mt-0.5 shrink-0 text-[color:var(--text-secondary)]"
                  strokeWidth={2}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[color:var(--text-primary)]">
                    {r.sessionType ?? "supervision"} session
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-[color:var(--text-muted)]">
                    {format(r.date, "EEE MMM d · h:mm a")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {r.meetingProvider && (
                  <span className="status-pill status-info">
                    {MEETING_PROVIDER_LABEL[r.meetingProvider] ??
                      r.meetingProvider}
                  </span>
                )}
                <ChevronRight
                  className="h-4 w-4 text-[color:var(--text-muted)]"
                  strokeWidth={2}
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
