"use client";

import { useState } from "react";
import { ChevronDown, Check, X } from "lucide-react";
import type { StatusFilter, Supervisee } from "./_types";

type Props = {
  supervisees: Supervisee[];
  selectedSuperviseeIds: Set<string>;
  onSuperviseesChange: (ids: Set<string>) => void;
  selectedStatuses: Set<StatusFilter>;
  onStatusesChange: (statuses: Set<StatusFilter>) => void;
};

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed (awaiting sign)" },
  { value: "signed", label: "Signed" },
  { value: "canceled", label: "Canceled" },
  { value: "no_show", label: "No-show" },
];

export function CalendarFilterBar({
  supervisees,
  selectedSuperviseeIds,
  onSuperviseesChange,
  selectedStatuses,
  onStatusesChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {supervisees.length > 0 && (
        <MultiSelect
          label="Supervisees"
          summary={superviseeSummary(supervisees, selectedSuperviseeIds)}
          options={supervisees.map((s) => ({ value: s.id, label: s.name }))}
          selected={selectedSuperviseeIds}
          onChange={(next) => onSuperviseesChange(next)}
        />
      )}
      <MultiSelect
        label="Status"
        summary={statusSummary(selectedStatuses)}
        options={STATUS_OPTIONS}
        selected={selectedStatuses as Set<string>}
        onChange={(next) => onStatusesChange(next as Set<StatusFilter>)}
      />
      {(selectedSuperviseeIds.size < supervisees.length ||
        selectedStatuses.size !== STATUS_OPTIONS.length - 1) && (
        <button
          type="button"
          onClick={() => {
            onSuperviseesChange(new Set(supervisees.map((s) => s.id)));
            onStatusesChange(
              new Set(
                STATUS_OPTIONS.filter((s) => s.value !== "canceled").map(
                  (s) => s.value
                )
              )
            );
          }}
          className="inline-flex items-center gap-1 text-xs text-foreground/60 hover:text-foreground px-2 py-1"
        >
          <X className="h-3 w-3" />
          Reset filters
        </button>
      )}
    </div>
  );
}

function superviseeSummary(
  supervisees: Supervisee[],
  selected: Set<string>
): string {
  if (selected.size === 0) return "None";
  if (selected.size === supervisees.length) return `All ${supervisees.length}`;
  if (selected.size === 1) {
    const id = [...selected][0]!;
    return supervisees.find((s) => s.id === id)?.name ?? "1 selected";
  }
  return `${selected.size} selected`;
}

function statusSummary(selected: Set<StatusFilter>): string {
  if (selected.size === 0) return "None";
  if (selected.size === STATUS_OPTIONS.length) return "All";
  if (selected.size === 1) {
    const v = [...selected][0]!;
    return STATUS_OPTIONS.find((o) => o.value === v)?.label ?? "1";
  }
  return `${selected.size} statuses`;
}

function MultiSelect({
  label,
  summary,
  options,
  selected,
  onChange,
}: {
  label: string;
  summary: string;
  options: { value: string; label: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);

  function toggle(v: string) {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(next);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-accent"
      >
        <span className="font-medium">{label}</span>
        <span className="text-foreground/60">·</span>
        <span className="text-foreground/70">{summary}</span>
        <ChevronDown className="h-3 w-3 text-foreground/60" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-full mt-1 z-20 min-w-[220px] max-w-sm max-h-72 overflow-y-auto rounded-md border border-border bg-card shadow-lg p-1">
            {options.map((o) => {
              const checked = selected.has(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggle(o.value)}
                  className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm rounded-sm hover:bg-accent ${
                    checked ? "text-foreground" : "text-foreground/70"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-sm border ${
                      checked
                        ? "border-foreground bg-foreground text-background"
                        : "border-border"
                    }`}
                    aria-hidden="true"
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  <span className="flex-1 truncate">{o.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
