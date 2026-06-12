"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarFilterBar } from "./_filter-bar";
import { CalendarListView } from "./_list-view";
import { CalendarWeekView } from "./_week-view";
import { CalendarMonthView } from "./_month-view";
import { SessionDrawer } from "./_session-drawer";
import { ScheduleModal } from "./_schedule-modal";
import type {
  CalendarEvent,
  StatusFilter,
  Supervisee,
  ViewMode,
} from "./_types";

type Props = {
  view: ViewMode;
  anchorIso: string;
  rangeStartIso: string;
  rangeEndIso: string;
  events: CalendarEvent[];
  supervisees: Supervisee[];
  viewerIsManager: boolean;
  viewerIsHrAdmin: boolean;
};

const DEFAULT_STATUSES: StatusFilter[] = [
  "scheduled",
  "completed",
  "signed",
  "no_show",
]; // canceled hidden by default

function clockSubscribe(cb: () => void): () => void {
  const id = setInterval(cb, 60_000);
  return () => clearInterval(id);
}

export function CalendarView({
  view,
  anchorIso,
  events,
  supervisees,
  viewerIsManager,
  viewerIsHrAdmin,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const anchor = useMemo(() => new Date(anchorIso), [anchorIso]);

  const [selectedSuperviseeIds, setSelectedSuperviseeIds] = useState<
    Set<string>
  >(new Set(supervisees.map((s) => s.id)));
  const [selectedStatuses, setSelectedStatuses] = useState<Set<StatusFilter>>(
    new Set(DEFAULT_STATUSES)
  );
  const [drawerEventId, setDrawerEventId] = useState<string | null>(null);
  const [scheduleModalSlot, setScheduleModalSlot] = useState<{
    startUtcIso: string;
  } | null>(null);

  // Live clock so the "happening now" / "starts soon" styling stays
  // accurate. Reads via useSyncExternalStore so render stays pure.
  const now = useSyncExternalStore(
    clockSubscribe,
    () => Date.now(),
    () => Date.parse(anchorIso)
  );

  const visibleEvents = useMemo(() => {
    return events.filter((e) => {
      if (!selectedSuperviseeIds.has(e.superviseeId)) return false;
      // Map raw scheduledStatus + signed → StatusFilter buckets.
      const bucket: StatusFilter =
        e.scheduledStatus === "canceled"
          ? "canceled"
          : e.scheduledStatus === "no_show"
            ? "no_show"
            : e.signed
              ? "signed"
              : e.scheduledStatus === "scheduled"
                ? "scheduled"
                : "completed";
      return selectedStatuses.has(bucket);
    });
  }, [events, selectedSuperviseeIds, selectedStatuses]);

  const selectedEvent = useMemo(
    () => visibleEvents.find((e) => e.id === drawerEventId) ?? null,
    [visibleEvents, drawerEventId]
  );

  function navigate(direction: "prev" | "next" | "today") {
    const next = new Date(anchor);
    if (direction === "today") {
      const today = new Date();
      pushUrl(view, today);
      return;
    }
    const sign = direction === "next" ? 1 : -1;
    if (view === "week") next.setDate(next.getDate() + 7 * sign);
    else if (view === "month") next.setMonth(next.getMonth() + sign);
    else next.setDate(next.getDate() + 14 * sign);
    pushUrl(view, next);
  }

  function setView(v: ViewMode) {
    pushUrl(v, anchor);
  }

  function pushUrl(v: ViewMode, d: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", v);
    params.set("date", isoDateString(d));
    router.push(`?${params.toString()}`, { scroll: false });
  }

  const headerLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(undefined, {
      month: "long",
      year: "numeric",
    });
    if (view === "week") {
      const weekStart = startOfWeek(anchor);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const monthSame = weekStart.getMonth() === weekEnd.getMonth();
      const dayFmt = new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      });
      return monthSame
        ? `${dayFmt.format(weekStart)} – ${weekEnd.getDate()}, ${weekStart.getFullYear()}`
        : `${dayFmt.format(weekStart)} – ${dayFmt.format(weekEnd)}, ${weekStart.getFullYear()}`;
    }
    return fmt.format(anchor);
  }, [view, anchor]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-overline mb-1">Calendar</p>
          <h1 className="font-display text-3xl font-semibold text-foreground">
            {viewerIsHrAdmin ? "Org calendar" : "Your calendar"}
          </h1>
          <p className="text-sm text-foreground/60 mt-1">
            {viewerIsHrAdmin
              ? "Every supervision session across your organization."
              : "Supervision sessions on your roster."}
          </p>
        </div>
        {viewerIsManager && (
          <Button
            type="button"
            onClick={() => {
              const start = new Date();
              start.setHours(start.getHours() + 1, 0, 0, 0);
              setScheduleModalSlot({ startUtcIso: start.toISOString() });
            }}
          >
            <Plus className="h-4 w-4" />
            New session
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="inline-flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("today")}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("prev")}
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("next")}
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm font-medium text-foreground">
            {headerLabel}
          </span>
        </div>
        <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-xs">
          {(["week", "month", "list"] as ViewMode[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1 rounded-sm transition-colors capitalize ${
                view === v
                  ? "bg-foreground text-background"
                  : "text-foreground/70 hover:bg-accent"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <CalendarFilterBar
        supervisees={supervisees}
        selectedSuperviseeIds={selectedSuperviseeIds}
        onSuperviseesChange={setSelectedSuperviseeIds}
        selectedStatuses={selectedStatuses}
        onStatusesChange={setSelectedStatuses}
      />

      <div className="rounded-md border border-border bg-card">
        {visibleEvents.length === 0 ? (
          <div className="px-6 py-12 text-center text-foreground/60 text-sm">
            <CalIcon className="h-6 w-6 mx-auto mb-2 text-foreground/40" />
            No sessions match these filters in this range.
          </div>
        ) : view === "week" ? (
          // Week + Month grids are too wide for phones (the week grid is
          // pinned at min-w-[840px]). On <md viewports render List instead,
          // which conveys the same data at a usable density. Toggle in the
          // segmented control still works to switch back to Month on the
          // detail-friendly fragments of a wider mobile + landscape.
          <>
            <div className="hidden md:block">
              <CalendarWeekView
                anchor={anchor}
                events={visibleEvents}
                now={now}
                viewerIsHrAdmin={viewerIsHrAdmin}
                onEventClick={setDrawerEventId}
                onEmptySlotClick={(slotStartUtcIso) =>
                  viewerIsManager &&
                  setScheduleModalSlot({ startUtcIso: slotStartUtcIso })
                }
              />
            </div>
            <div className="md:hidden">
              <CalendarListView
                events={visibleEvents}
                now={now}
                viewerIsHrAdmin={viewerIsHrAdmin}
                onEventClick={setDrawerEventId}
              />
            </div>
          </>
        ) : view === "month" ? (
          <>
            <div className="hidden md:block">
              <CalendarMonthView
                anchor={anchor}
                events={visibleEvents}
                now={now}
                viewerIsHrAdmin={viewerIsHrAdmin}
                onEventClick={setDrawerEventId}
              />
            </div>
            <div className="md:hidden">
              <CalendarListView
                events={visibleEvents}
                now={now}
                viewerIsHrAdmin={viewerIsHrAdmin}
                onEventClick={setDrawerEventId}
              />
            </div>
          </>
        ) : (
          <CalendarListView
            events={visibleEvents}
            now={now}
            viewerIsHrAdmin={viewerIsHrAdmin}
            onEventClick={setDrawerEventId}
          />
        )}
      </div>

      <SessionDrawer
        event={selectedEvent}
        onClose={() => setDrawerEventId(null)}
        viewerIsHrAdmin={viewerIsHrAdmin}
        now={now}
      />

      {scheduleModalSlot && (
        <ScheduleModal
          startUtcIso={scheduleModalSlot.startUtcIso}
          supervisees={supervisees}
          onClose={() => setScheduleModalSlot(null)}
        />
      )}
    </div>
  );
}

function isoDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const dow = (out.getDay() + 6) % 7; // Mon-start
  out.setDate(out.getDate() - dow);
  out.setHours(0, 0, 0, 0);
  return out;
}
