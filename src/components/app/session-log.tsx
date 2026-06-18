"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  FileSignature,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isSessionPendingSignature } from "@/lib/session-pending";

type SessionEvent = {
  id: string;
  kind: string;
  date: Date | string;
  durationHours: number;
  sessionType: string | null;
  signedAt: Date | string | null;
  signatures: unknown[];
  scheduledStatus?: string | null;
  practiceState?: string | null;
};

type Props = {
  events: SessionEvent[];
  viewerIsManager: boolean;
  viewerUserId: string;
  superviseeId: string;
  superviseeState?: string | null;
  /** Session IDs flagged from a "Review flagged sessions" gap link — these
   *  rows get a sticky amber border + are scrolled into view on mount. */
  flaggedSessionIds?: string[];
};

type Filter = "all" | "pending" | "signed";

export function SessionLog({
  events,
  viewerIsManager,
  viewerUserId,
  superviseeId,
  superviseeState,
  flaggedSessionIds = [],
}: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const flaggedSet = useMemo(
    () => new Set(flaggedSessionIds),
    [flaggedSessionIds]
  );
  const firstFlaggedRowRef = useRef<HTMLTableRowElement | null>(null);

  // Today at start-of-day in local tz — used to hide future-dated rows from
  // the "Needs your attention" pending list (scheduled meetings haven't
  // happened yet so they don't need a signature). Recomputed once per render.
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  function isFuture(e: SessionEvent): boolean {
    const d = typeof e.date === "string" ? parseISO(e.date) : e.date;
    return d.getTime() > todayStart.getTime();
  }

  // Canonical "row needs somebody's signature" predicate — shared with
  // pendingSignaturesForUser and roster-queries pendingSignatureCount so
  // every surface agrees on which rows are pending. Excludes canceled,
  // no_show, future-end, practice, and already-signed rows.
  const pendingItems = useMemo(
    () => events.filter((e) => isSessionPendingSignature(e)),
    [events]
  );

  const filteredEvents = useMemo(() => {
    if (filter === "pending") {
      const pendingIds = new Set(pendingItems.map((e) => e.id));
      return events.filter((e) => pendingIds.has(e.id));
    }
    if (filter === "signed") return events.filter((e) => e.signedAt !== null);
    return events;
  }, [events, filter, pendingItems]);

  const grouped = useMemo(() => {
    const map = new Map<string, SessionEvent[]>();
    for (const e of filteredEvents) {
      const d = typeof e.date === "string" ? parseISO(e.date) : e.date;
      const key = format(d, "yyyy-MM");
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredEvents]);

  // Per-month pending count for the month header badge. Replaces the
  // top-of-page "Needs your attention — N pending" callout on the
  // supervisee dashboard: temporal context lives next to the month
  // accordion the user is already scanning.
  const pendingByMonth = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of pendingItems) {
      const d = typeof e.date === "string" ? parseISO(e.date) : e.date;
      const key = format(d, "yyyy-MM");
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [pendingItems]);

  const currentMonthKey = format(new Date(), "yyyy-MM");
  // Month keys for any month that contains a flagged session — those need
  // to auto-open so the highlighted row is actually visible after scroll.
  const flaggedMonthKeys = useMemo(() => {
    const out = new Set<string>();
    for (const e of events) {
      if (!flaggedSet.has(e.id)) continue;
      const d = typeof e.date === "string" ? parseISO(e.date) : e.date;
      out.add(format(d, "yyyy-MM"));
    }
    return out;
  }, [events, flaggedSet]);

  function toggleMonth(key: string) {
    const next = new Set(expanded);
    if (key === currentMonthKey) {
      // Current month is open by default → toggle stores the "closed" sentinel
      // so re-clicking re-opens it.
      const sentinel = `${key}-closed`;
      if (next.has(sentinel)) next.delete(sentinel);
      else next.add(sentinel);
    } else {
      if (next.has(key)) next.delete(key);
      else next.add(key);
    }
    setExpanded(next);
  }

  function isExpanded(key: string) {
    // Auto-open: current month + any month containing a flagged session.
    // For the current month, the "closed" sentinel is the user explicitly
    // collapsing it; otherwise stays open by default.
    if (key === currentMonthKey) return !expanded.has(`${key}-closed`);
    if (flaggedMonthKeys.has(key)) return !expanded.has(`${key}-closed-flag`);
    return expanded.has(key);
  }

  // Scroll the first flagged row into view + focus it on mount. Runs once
  // per change in flagged set (typically once on landing from a gap link).
  useEffect(() => {
    if (flaggedSet.size === 0) return;
    if (!firstFlaggedRowRef.current) return;
    firstFlaggedRowRef.current.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [flaggedSet]);

  return (
    <div>
      {/* Zone 1: Needs your attention */}
      {pendingItems.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle
              className="h-4 w-4 text-[color:var(--color-warn-500)]"
              strokeWidth={2}
            />
            <p className="label-overline text-[color:var(--color-warn-700)]">
              Needs your attention — {pendingItems.length} pending
            </p>
          </div>
          <ul className="space-y-2">
            {pendingItems.slice(0, 5).map((p) => {
              const d = typeof p.date === "string" ? parseISO(p.date) : p.date;
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-sm border-l-[3px] border-l-[color:var(--color-warn-500)] bg-[color:var(--color-warn-50)]/30 cursor-pointer hover:bg-[color:var(--color-warn-50)]/60 transition-colors"
                  onClick={(ev) => {
                    const target = ev.target as HTMLElement;
                    if (target.closest("a, button")) return;
                    router.push(`/sign/${p.id}`);
                  }}
                >
                  <div>
                    <Link
                      href={`/sign/${p.id}`}
                      className="text-sm font-medium text-foreground hover:underline"
                    >
                      {p.sessionType ?? "supervision"} session — {format(d, "MMM d, yyyy")}
                    </Link>
                    <p className="text-xs text-foreground/60 font-mono">
                      {p.durationHours.toFixed(1)} hrs awaiting signature
                    </p>
                  </div>
                  <Link
                    href={`/sign/${p.id}`}
                    className="text-sm font-medium text-secondary hover:underline"
                  >
                    Sign →
                  </Link>
                </li>
              );
            })}
            {pendingItems.length > 5 && (
              <li className="text-xs text-foreground/60 px-3">
                + {pendingItems.length - 5} more pending — filter by &quot;Pending&quot; below to see all
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Zone 2: Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4 pb-3 border-b border-border">
        {(["all", "pending", "signed"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs font-medium rounded-sm border transition-colors ${
              filter === f
                ? "border-foreground bg-foreground text-background"
                : "border-border text-foreground/70 hover:bg-accent/40"
            }`}
          >
            {f === "all" ? "All" : f === "pending" ? "Pending" : "Signed"}
            {f === "all" && ` (${events.length})`}
            {f === "pending" && ` (${pendingItems.length})`}
            {f === "signed" && ` (${events.length - pendingItems.length})`}
          </button>
        ))}
      </div>

      {/* Zone 3: Month-grouped accordion */}
      {grouped.length === 0 ? (
        <p className="text-sm text-foreground/50 py-8 text-center">
          No sessions match this filter.
        </p>
      ) : (
        <div className="space-y-2">
          {grouped.map(([monthKey, items]) => {
            const isOpen = isExpanded(monthKey);
            const totalHours = items.reduce((s, e) => s + e.durationHours, 0);
            const isCurrentMonth = monthKey === currentMonthKey;
            const hasFlagged = flaggedMonthKeys.has(monthKey);
            return (
              <div
                key={monthKey}
                className={`border rounded-sm overflow-hidden ${
                  isCurrentMonth
                    ? "border-secondary/40 ring-1 ring-secondary/20"
                    : "border-border"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleMonth(monthKey)}
                  className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
                    isCurrentMonth
                      ? "bg-secondary/10 hover:bg-secondary/15"
                      : "bg-accent hover:bg-accent/80"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className="font-medium text-sm text-foreground">
                      {format(parseISO(`${monthKey}-01`), "MMMM yyyy")}
                    </span>
                    {isCurrentMonth && (
                      <Badge variant="outline" className="text-[10px] border-secondary/40 text-secondary">
                        This month
                      </Badge>
                    )}
                    {hasFlagged && !isCurrentMonth && (
                      <Badge variant="outline-warn" className="text-[10px]">
                        Flagged
                      </Badge>
                    )}
                    {(pendingByMonth.get(monthKey) ?? 0) > 0 && (
                      <Badge variant="outline-warn" className="text-[10px]">
                        {pendingByMonth.get(monthKey)} pending
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-foreground/60 font-mono">
                    {items.length} session{items.length !== 1 ? "s" : ""} ·{" "}
                    {totalHours.toFixed(1)} hrs
                  </span>
                </button>
                {isOpen && (
                  <table className="w-full text-sm">
                    <tbody>
                      {items.map((e) => {
                        const d = typeof e.date === "string" ? parseISO(e.date) : e.date;
                        const sigs = (e.signatures as { signerId: string }[]) ?? [];
                        const fullySigned = !!e.signedAt;
                        const myselfHasSigned = sigs.some(
                          (s) => s.signerId === viewerUserId
                        );
                        const isSelfSupervisee = viewerUserId === superviseeId;
                        const isFutureRow = isFuture(e);
                        const isCanceled = e.scheduledStatus === "canceled";
                        const isNoShow = e.scheduledStatus === "no_show";
                        // No signing on future, canceled, or no-show rows.
                        // The sign page server-rejects canceled / no_show
                        // anyway; the UI shouldn't be tempting the user to
                        // click into a dead end.
                        const canSign =
                          !fullySigned &&
                          !myselfHasSigned &&
                          !isFutureRow &&
                          !isCanceled &&
                          !isNoShow &&
                          (isSelfSupervisee || viewerIsManager);
                        const isFlagged = flaggedSet.has(e.id);
                        const rowRef =
                          isFlagged && !firstFlaggedRowRef.current
                            ? firstFlaggedRowRef
                            : null;
                        return (
                          <tr
                            key={e.id}
                            ref={rowRef}
                            className={`border-t first:border-t-0 cursor-pointer transition-colors ${
                              isFlagged
                                ? "border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/10 hover:bg-[color:var(--color-warning)]/15"
                                : "border-border hover:bg-accent/40"
                            }`}
                            onClick={(ev) => {
                              // Only navigate on row clicks that didn't hit a
                              // nested interactive element (the action Link
                              // handles its own click). Lets keyboard focus +
                              // middle-click on the date Link still work.
                              const target = ev.target as HTMLElement;
                              if (target.closest("a, button")) return;
                              router.push(`/sign/${e.id}`);
                            }}
                          >
                            <td className="px-4 py-2 font-mono text-xs">
                              <Link
                                href={`/sign/${e.id}`}
                                className="hover:underline"
                              >
                                {format(d, "MMM d")}
                              </Link>
                            </td>
                            <td className="px-4 py-2 capitalize">
                              {e.kind}
                              {e.kind === "practice" &&
                                e.practiceState &&
                                e.practiceState !== superviseeState && (
                                  <Badge
                                    variant="outline"
                                    className="ml-2 text-[10px]"
                                  >
                                    in {e.practiceState}
                                  </Badge>
                                )}
                            </td>
                            <td className="px-4 py-2 capitalize text-foreground/70">
                              {e.sessionType ?? "—"}
                            </td>
                            <td className="px-4 py-2 font-mono">
                              {e.durationHours.toFixed(1)}
                            </td>
                            <td className="px-4 py-2">
                              {fullySigned ? (
                                <Badge variant="success">
                                  <FileSignature className="h-3 w-3" />
                                  Sealed
                                </Badge>
                              ) : isCanceled ? (
                                <Badge variant="outline">Canceled</Badge>
                              ) : isNoShow ? (
                                <Badge variant="outline">No-show</Badge>
                              ) : isFutureRow ? (
                                <Badge variant="outline">Scheduled</Badge>
                              ) : (
                                <Badge variant="outline-warn">
                                  <AlertTriangle className="h-3 w-3" />
                                  Pending
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <Link
                                href={`/sign/${e.id}`}
                                className={`text-xs font-medium ${
                                  canSign
                                    ? "text-secondary hover:underline"
                                    : "text-foreground/50 hover:underline"
                                }`}
                              >
                                {canSign ? "Sign →" : "View"}
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
