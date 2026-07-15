"use client";

import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { EventStatusBadge } from "./_status-badge";
import type { CalendarEvent } from "./_types";

type Props = {
  events: CalendarEvent[];
  now: number;
  viewerIsHrAdmin: boolean;
  onEventClick: (id: string) => void;
};

function localDayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function CalendarListView({
  events,
  now,
  viewerIsHrAdmin,
  onEventClick,
}: Props) {
  const groups = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const k = localDayKey(e.startIso);
      const arr = map.get(k) ?? [];
      arr.push(e);
      map.set(k, arr);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, arr]) => ({
        key: k,
        label: new Intl.DateTimeFormat(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
        }).format(new Date(`${k}T12:00:00`)),
        items: arr.sort((a, b) => a.startIso.localeCompare(b.startIso)),
      }));
  }, [events]);

  return (
    <div className="divide-y divide-border">
      {groups.map((g) => (
        <div key={g.key}>
          <div className="sticky top-0 bg-card/95 backdrop-blur px-4 py-2 text-xs font-medium uppercase tracking-wider text-foreground/60 border-b border-border z-10">
            {g.label}
          </div>
          <ul>
            {g.items.map((e) => {
              const startFmt = new Intl.DateTimeFormat(undefined, {
                hour: "numeric",
                minute: "2-digit",
                timeZone: e.timeZone ?? undefined,
              }).format(new Date(e.startIso));
              return (
                <li
                  key={e.id}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/40 transition-colors"
                  onClick={() => onEventClick(e.id)}
                >
                  <div className="font-mono text-sm w-16 shrink-0 text-foreground/80">
                    {startFmt}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {e.superviseeName}
                      </p>
                      {viewerIsHrAdmin && e.supervisorName && (
                        <span className="text-xs text-foreground/60">
                          ↔ {e.supervisorName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-foreground/60 capitalize">
                      {e.sessionType ?? "supervision"}
                      <span className="mx-1.5">·</span>
                      {e.durationMinutes} min
                    </p>
                  </div>
                  <EventStatusBadge event={e} now={now} />
                  <ChevronRight className="h-4 w-4 text-foreground/40" />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
