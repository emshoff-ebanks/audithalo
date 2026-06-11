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
  onEmptySlotClick: (slotStartUtcIso: string) => void;
};

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 21; // exclusive — last row label is 8pm
const ROW_HEIGHT_PX = 36;

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const dow = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - dow);
  out.setHours(0, 0, 0, 0);
  return out;
}

function localKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function CalendarWeekView({
  anchor,
  events,
  now,
  viewerIsHrAdmin,
  onEventClick,
  onEmptySlotClick,
}: Props) {
  const days = useMemo(() => {
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [anchor]);

  // Expand display range when events sit outside the default 7-9 window.
  const { startHour, endHour } = useMemo(() => {
    let minH = DAY_START_HOUR;
    let maxH = DAY_END_HOUR;
    for (const e of events) {
      const s = new Date(e.startIso);
      const sh = s.getHours();
      if (sh < minH) minH = Math.max(0, sh);
      const endLocal = new Date(e.endIso);
      const eh = endLocal.getHours() + (endLocal.getMinutes() > 0 ? 1 : 0);
      if (eh > maxH) maxH = Math.min(24, eh);
    }
    return { startHour: minH, endHour: maxH };
  }, [events]);

  const hours = useMemo(
    () => Array.from({ length: endHour - startHour }, (_, i) => startHour + i),
    [startHour, endHour]
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const k = localKey(new Date(e.startIso));
      const arr = map.get(k) ?? [];
      arr.push(e);
      map.set(k, arr);
    }
    return map;
  }, [events]);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[840px]">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
          <div />
          {days.map((d) => {
            const isToday = localKey(d) === localKey(new Date(now));
            const dayFmt = new Intl.DateTimeFormat(undefined, {
              weekday: "short",
            }).format(d);
            return (
              <div
                key={localKey(d)}
                className={`px-2 py-2 text-xs text-center border-l border-border ${
                  isToday ? "bg-secondary/5" : ""
                }`}
              >
                <div className="text-foreground/60 uppercase tracking-wider">
                  {dayFmt}
                </div>
                <div
                  className={`mt-0.5 text-sm font-medium ${
                    isToday ? "text-secondary" : "text-foreground"
                  }`}
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
          <div>
            {hours.map((h) => (
              <div
                key={h}
                className="border-b border-border text-[10px] text-foreground/50 font-mono pr-1 text-right pt-0.5"
                style={{ height: ROW_HEIGHT_PX }}
              >
                {formatHour(h)}
              </div>
            ))}
          </div>

          {days.map((d) => {
            const dayEvents = eventsByDay.get(localKey(d)) ?? [];
            return (
              <div
                key={localKey(d)}
                className="relative border-l border-border"
              >
                {hours.map((h) => (
                  <div
                    key={h}
                    className="border-b border-border hover:bg-accent/30 cursor-pointer"
                    style={{ height: ROW_HEIGHT_PX }}
                    onClick={() => {
                      const slot = new Date(d);
                      slot.setHours(h, 0, 0, 0);
                      onEmptySlotClick(slot.toISOString());
                    }}
                  />
                ))}
                {dayEvents.map((e) => {
                  const s = new Date(e.startIso);
                  const en = new Date(e.endIso);
                  const startMin =
                    s.getHours() * 60 + s.getMinutes() - startHour * 60;
                  const endMin =
                    en.getHours() * 60 + en.getMinutes() - startHour * 60;
                  const top = (startMin / 60) * ROW_HEIGHT_PX;
                  const height = Math.max(
                    18,
                    ((endMin - startMin) / 60) * ROW_HEIGHT_PX
                  );
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEventClick(e.id);
                      }}
                      className={`absolute left-1 right-1 rounded-sm border-l-2 px-1.5 py-0.5 text-[11px] text-left overflow-hidden ${blockClasses(
                        e,
                        now
                      )}`}
                      style={{ top, height }}
                    >
                      <div className="font-medium truncate">
                        {e.superviseeName}
                      </div>
                      <div className="text-[10px] opacity-80 truncate">
                        {new Intl.DateTimeFormat(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        }).format(s)}
                        {viewerIsHrAdmin && e.supervisorName
                          ? ` · ${initialsOf(e.supervisorName)}`
                          : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatHour(h: number): string {
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  if (h < 12) return `${h}a`;
  return `${h - 12}p`;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
