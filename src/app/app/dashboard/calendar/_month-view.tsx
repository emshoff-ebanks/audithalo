"use client";

import { useMemo } from "react";
import { blockClasses } from "./_status-badge";
import type { CalendarEvent } from "./_types";

type Props = {
  anchor: Date;
  events: CalendarEvent[];
  now: number;
  viewerIsHrAdmin: boolean;
  onEventClick: (id: string) => void;
};

function localKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const dow = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - dow);
  out.setHours(0, 0, 0, 0);
  return out;
}

const MAX_EVENT_CHIPS = 3;

export function CalendarMonthView({
  anchor,
  events,
  now,
  viewerIsHrAdmin,
  onEventClick,
}: Props) {
  const { weeks, monthIdx } = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const start = startOfWeek(first);
    const end = startOfWeek(last);
    end.setDate(end.getDate() + 7);
    const days: Date[] = [];
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return { weeks: rows, monthIdx: anchor.getMonth() };
  }, [anchor]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const k = localKey(new Date(e.startIso));
      const arr = map.get(k) ?? [];
      arr.push(e);
      map.set(k, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.startIso.localeCompare(b.startIso));
    }
    return map;
  }, [events]);

  const dayNames = useMemo(() => {
    const base = new Date(2026, 5, 1); // a Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(d);
    });
  }, []);

  const todayKey = localKey(new Date(now));

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-border text-[10px] uppercase tracking-wider text-foreground/60">
        {dayNames.map((n) => (
          <div key={n} className="px-2 py-1.5 text-center">
            {n}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((d) => {
          const key = localKey(d);
          const inMonth = d.getMonth() === monthIdx;
          const evs = byDay.get(key) ?? [];
          const shown = evs.slice(0, MAX_EVENT_CHIPS);
          const more = evs.length - shown.length;
          return (
            <div
              key={key}
              className={`min-h-[96px] border-b border-l border-border p-1.5 text-xs ${
                inMonth ? "" : "bg-muted/30"
              } ${key === todayKey ? "ring-1 ring-inset ring-secondary/40" : ""}`}
            >
              <div
                className={`text-right text-[11px] mb-1 ${
                  inMonth ? "text-foreground" : "text-foreground/40"
                } ${key === todayKey ? "font-semibold text-secondary" : ""}`}
              >
                {d.getDate()}
              </div>
              <div className="space-y-1">
                {shown.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onEventClick(e.id)}
                    className={`block w-full text-left rounded-sm border-l-2 px-1 py-0.5 text-[10px] truncate ${blockClasses(
                      e,
                      now
                    )}`}
                  >
                    <span className="font-mono mr-1">
                      {new Intl.DateTimeFormat(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                        timeZone: e.timeZone ?? undefined,
                      }).format(new Date(e.startIso))}
                    </span>
                    {viewerIsHrAdmin && e.supervisorName
                      ? `${e.superviseeName} · ${initialsOf(e.supervisorName)}`
                      : e.superviseeName}
                  </button>
                ))}
                {more > 0 && (
                  <p className="text-[10px] text-foreground/60 px-1">
                    +{more} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
