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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <ul className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href={buildHref("all")} className={`chip ${activeFilter === "all" ? "chip-active" : ""}`}>
            All <span className="chip-count">{totalCount}</span>
          </Link>
        </li>
        {PILLS.map((p) => (
          <li key={p.value}>
            <Link href={buildHref(p.value)} className={`chip ${activeFilter === p.value ? "chip-active" : ""}`}>
              {p.label}
              {activeFilter === p.value && <span className="chip-count">{filteredCount}</span>}
            </Link>
          </li>
        ))}
        {activeFilter !== "all" && (
          <li>
            <Link
              href={buildHref("all")}
              className="inline-flex items-center gap-1 text-xs text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] px-2 py-1.5"
              aria-label="Clear filter"
            >
              <X className="h-3 w-3" />
              Clear
            </Link>
          </li>
        )}
      </ul>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
        {supervisorOptions && supervisorOptions.length > 0 && (
          <select
            aria-label="Filter by supervisor"
            className="h-9 rounded-sm border border-[color:var(--border)] bg-[color:var(--paper-white)] dark:bg-[color:var(--surface-muted)] px-2 text-sm text-[color:var(--text-primary)] disabled:opacity-50 focus:ring-2 focus:ring-[color:var(--halo-yellow)] focus:outline-none"
            value={activeSupervisorId ?? ""}
            onChange={(e) => applySupervisor(e.currentTarget.value)}
            disabled={pending}
          >
            <option value="">All supervisors</option>
            {supervisorOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[color:var(--text-muted)] z-10" />
          <Input
            type="search"
            placeholder="Search by name or email"
            className="h-9 pl-8 text-sm"
            value={q}
            onChange={(e) => applySearch(e.currentTarget.value)}
            disabled={pending}
          />
        </div>
      </div>
    </div>
  );
}
