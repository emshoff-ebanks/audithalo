"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

export type RosterFilter =
  | "all"
  | "at-risk"
  | "pending-signatures"
  | "on-track";

const PILLS: { value: Exclude<RosterFilter, "all">; label: string }[] = [
  { value: "at-risk", label: "Need attention" },
  { value: "pending-signatures", label: "Pending signatures" },
  { value: "on-track", label: "On track" },
];

export function parseRosterFilter(value: string | undefined): RosterFilter {
  if (
    value === "at-risk" ||
    value === "pending-signatures" ||
    value === "on-track"
  ) {
    return value;
  }
  return "all";
}

export function FilterBar({
  activeFilter,
  filteredCount,
  totalCount,
  searchQuery,
}: {
  activeFilter: RosterFilter;
  filteredCount: number;
  totalCount: number;
  searchQuery: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(searchQuery);

  function applySearch(next: string) {
    setQ(next);
    startTransition(() => {
      const params = new URLSearchParams();
      if (activeFilter !== "all") params.set("filter", activeFilter);
      if (next.trim()) params.set("q", next.trim());
      router.push(
        params.toString() ? `/dashboard/roster?${params.toString()}` : "/dashboard/roster"
      );
    });
  }

  function buildHref(filter: RosterFilter) {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("filter", filter);
    if (q.trim()) params.set("q", q.trim());
    return params.toString()
      ? `/dashboard/roster?${params.toString()}`
      : "/dashboard/roster";
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
  );
}
