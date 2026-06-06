"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  FileSignature,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type SessionEvent = {
  id: string;
  kind: string;
  date: Date | string;
  durationHours: number;
  sessionType: string | null;
  signedAt: Date | string | null;
  signatures: unknown[];
  practiceState?: string | null;
};

type Props = {
  events: SessionEvent[];
  viewerIsManager: boolean;
  viewerUserId: string;
  superviseeId: string;
  superviseeState?: string | null;
};

type Filter = "all" | "pending" | "signed";

export function SessionLog({
  events,
  viewerIsManager,
  viewerUserId,
  superviseeId,
  superviseeState,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filteredEvents = useMemo(() => {
    if (filter === "pending") return events.filter((e) => e.signedAt === null);
    if (filter === "signed") return events.filter((e) => e.signedAt !== null);
    return events;
  }, [events, filter]);

  const pendingItems = useMemo(
    () => events.filter((e) => e.kind === "supervision" && e.signedAt === null),
    [events]
  );

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

  const currentMonthKey = format(new Date(), "yyyy-MM");

  function toggleMonth(key: string) {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpanded(next);
  }

  function isExpanded(key: string) {
    return key === currentMonthKey ? !expanded.has(`${key}-closed`) : expanded.has(key);
  }

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
                  className="flex items-center justify-between p-3 rounded-sm border-l-[3px] border-l-[color:var(--color-warn-500)] bg-[color:var(--color-warn-50)]/30"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {p.sessionType ?? "supervision"} session — {format(d, "MMM d, yyyy")}
                    </p>
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
            return (
              <div key={monthKey} className="border border-border rounded-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleMonth(monthKey)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-accent hover:bg-accent/80 transition-colors"
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
                        const canSign =
                          !fullySigned &&
                          !myselfHasSigned &&
                          (isSelfSupervisee || viewerIsManager);
                        return (
                          <tr
                            key={e.id}
                            className="border-t border-border first:border-t-0"
                          >
                            <td className="px-4 py-2 font-mono text-xs">
                              {format(d, "MMM d")}
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
