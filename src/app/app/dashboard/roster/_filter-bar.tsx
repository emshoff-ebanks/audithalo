"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { RosterFilter } from "./_roster-filter";

const PILLS: { value: Exclude<RosterFilter, "all">; label: string }[] = [
  { value: "at-risk", label: "Need attention" },
  { value: "pending-signatures", label: "Pending signatures" },
  { value: "on-track", label: "On track" },
];

type SupervisorOption = { id: string; name: string };

export function FilterBar({
  activeFilter,
  filteredCount,
  totalCount,
  searchQuery,
  supervisorOptions,
  activeSupervisorId,
}: {
  activeFilter: RosterFilter;
  filteredCount: number;
  totalCount: number;
  searchQuery: string;
  /** HR Admin only — list of supervisors in this org. Null for non-HR
   *  viewers (their roster is already implicitly filtered to themselves). */
  supervisorOptions: SupervisorOption[] | null;
  activeSupervisorId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(searchQuery);

  function buildUrl({
    filter,
    query,
    supervisorId,
  }: {
    filter: RosterFilter;
    query: string;
    supervisorId: string | null;
  }) {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("filter", filter);
    if (query.trim()) params.set("q", query.trim());
    if (supervisorId) params.set("supervisor", supervisorId);
    return params.toString()
      ? `/dashboard/roster?${params.toString()}`
      : "/dashboard/roster";
  }

  function applySearch(next: string) {
    setQ(next);
    startTransition(() => {
      router.push(
        buildUrl({
          filter: activeFilter,
          query: next,
          supervisorId: activeSupervisorId,
        })
      );
    });
  }

  function applySupervisor(next: string) {
    startTransition(() => {
      router.push(
        buildUrl({
          filter: activeFilter,
          query: q,
          supervisorId: next ? next : null,
        })
      );
    });
  }

  function buildHref(filter: RosterFilter) {
    return buildUrl({ filter, query: q, supervisorId: activeSupervisorId });
  }

  return (
    <div className="rounded-sm bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)] p-4 sm:p-5 mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <ul className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link
              href={buildHref("all")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                activeFilter === "all"
                  ? "bg-white text-foreground"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              All ({totalCount})
            </Link>
          </li>
          {PILLS.map((p) => (
            <li key={p.value}>
              <Link
                href={buildHref(p.value)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  activeFilter === p.value
                    ? "bg-white text-foreground"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {p.label}
                {activeFilter === p.value && (
                  <span className="font-mono">({filteredCount})</span>
                )}
              </Link>
            </li>
          ))}
          {activeFilter !== "all" && (
            <li>
              <Link
                href={buildHref("all")}
                className="inline-flex items-center gap-1 text-xs text-white/70 hover:text-white px-2 py-1.5"
                aria-label="Clear filter"
              >
                <X className="h-3 w-3" />
                Clear
              </Link>
            </li>
          )}
        </ul>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {supervisorOptions && supervisorOptions.length > 0 && (
            <select
              aria-label="Filter by supervisor"
              className="h-8 rounded-sm bg-white/10 border border-white/20 px-2 text-xs text-white disabled:opacity-50"
              value={activeSupervisorId ?? ""}
              onChange={(e) => applySupervisor(e.currentTarget.value)}
              disabled={pending}
            >
              <option value="" className="text-foreground">
                All supervisors
              </option>
              {supervisorOptions.map((s) => (
                <option key={s.id} value={s.id} className="text-foreground">
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/60" />
            <Input
              type="search"
              placeholder="Search by name or email"
              className="h-8 pl-8 text-xs bg-white/10 border-white/20 placeholder:text-white/60 text-white"
              value={q}
              onChange={(e) => applySearch(e.currentTarget.value)}
              disabled={pending}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
