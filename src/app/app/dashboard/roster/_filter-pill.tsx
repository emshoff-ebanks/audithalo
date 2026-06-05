import Link from "next/link";
import { X } from "lucide-react";

export type RosterFilter =
  | "all"
  | "at-risk"
  | "pending-signatures"
  | "on-track";

const LABELS: Record<Exclude<RosterFilter, "all">, string> = {
  "at-risk": "Need attention",
  "pending-signatures": "Pending signatures",
  "on-track": "On track",
};

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

export function FilterPill({
  filter,
  count,
}: {
  filter: Exclude<RosterFilter, "all">;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-[color:var(--color-evidence-bg)] border border-border px-3 py-1.5 text-xs">
      <span className="text-foreground/60">Showing:</span>
      <span className="font-semibold text-foreground">
        {LABELS[filter]} ({count})
      </span>
      <Link
        href="/dashboard/roster"
        className="inline-flex items-center gap-1 text-foreground/60 hover:text-foreground"
        aria-label="Clear filter"
      >
        <X className="h-3 w-3" />
        Clear filter
      </Link>
    </div>
  );
}
