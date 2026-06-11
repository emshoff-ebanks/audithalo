"use client";

import { useState } from "react";
import { LogSessionForm } from "./log-session-form";
import { ScheduleSessionForm } from "./schedule-session-form";

type Provider = "microsoft" | "google";

type ConnectedProvider = {
  name: Provider;
  accountEmail: string | null;
  isPreferred: boolean;
};

type Props = {
  superviseeId: string;
  viewerCanSupervise: boolean;
  connectedProviders: ConnectedProvider[];
};

/**
 * Unified "Sessions" panel that replaces the old standalone Log-session
 * form. Mode toggle picks between logging a past session (existing flow)
 * and scheduling a new one (Phase 1 of docs/strategy/08).
 *
 * Supervisees who hit this page see the log-only sub-form for their own
 * practice hours; they can't schedule supervision sessions.
 */
export function SessionsPanel({
  superviseeId,
  viewerCanSupervise,
  connectedProviders,
}: Props) {
  const [mode, setMode] = useState<"log_past" | "schedule_new">(
    viewerCanSupervise ? "schedule_new" : "log_past"
  );

  return (
    <div className="space-y-4">
      <p className="label-overline">Sessions</p>

      {viewerCanSupervise && (
        <div
          role="radiogroup"
          aria-label="Session entry mode"
          className="flex flex-wrap gap-2"
        >
          <ModeButton
            active={mode === "schedule_new"}
            onClick={() => setMode("schedule_new")}
            label="Schedule a new session"
            sub="Create a calendar event + meeting link"
          />
          <ModeButton
            active={mode === "log_past"}
            onClick={() => setMode("log_past")}
            label="Log a past session"
            sub="Record a session that already happened"
          />
        </div>
      )}

      <div>
        {mode === "schedule_new" && viewerCanSupervise ? (
          <ScheduleSessionForm
            superviseeId={superviseeId}
            connectedProviders={connectedProviders}
          />
        ) : (
          <LogSessionForm
            superviseeId={superviseeId}
            allowSupervision={viewerCanSupervise}
          />
        )}
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex-1 min-w-[180px] text-left rounded-sm border px-3 py-2 transition-colors ${
        active
          ? "border-foreground bg-accent/40"
          : "border-border hover:bg-accent/40"
      }`}
    >
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-foreground/60 mt-0.5">{sub}</p>
    </button>
  );
}
