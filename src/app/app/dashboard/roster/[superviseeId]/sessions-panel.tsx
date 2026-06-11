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
  /** Actor's own clinical-supervisor permission. Drives the log-past
   *  sub-form's "kind" picker (only true supervisors can log
   *  supervision sessions; HR Admin cannot log clinical events). */
  viewerCanSupervise: boolean;
  /** Actor can use the SCHEDULE form. True for supervisor + HR Admin. */
  viewerCanScheduleSession: boolean;
  /** Connected providers belonging to the HOSTING supervisor (themselves
   *  when supervisor; the supervisee's assigned supervisor when HR Admin). */
  connectedProviders: ConnectedProvider[];
  /** Display name of the supervisor whose calendar will host the
   *  session, when scheduling on behalf. Null when the actor IS the
   *  hosting supervisor. */
  hostingSupervisorName: string | null;
  /** False only when the actor is HR Admin AND no active supervisor is
   *  assigned to this supervisee. Used to gate the schedule form with a
   *  clearer error than "Connect a calendar". */
  hasAssignedSupervisor: boolean;
};

/**
 * Unified "Sessions" panel that replaces the old standalone Log-session
 * form. Mode toggle picks between logging a past session (existing flow)
 * and scheduling a new one (Phase 1 of docs/strategy/08).
 *
 * Supervisor: full panel (schedule + log).
 * HR Admin:   schedule on behalf of the supervisee's assigned supervisor.
 *             Cannot log clinical supervision events (authz firewall —
 *             same as supervisee.ts) so the toggle is hidden.
 * Supervisee: log own practice hours only.
 */
export function SessionsPanel({
  superviseeId,
  viewerCanSupervise,
  viewerCanScheduleSession,
  connectedProviders,
  hostingSupervisorName,
  hasAssignedSupervisor,
}: Props) {
  const [mode, setMode] = useState<"log_past" | "schedule_new">(
    viewerCanScheduleSession ? "schedule_new" : "log_past"
  );
  const onBehalf = !!hostingSupervisorName;
  // HR Admin gets schedule-only — they can't log clinical events.
  const showToggle = viewerCanSupervise;

  return (
    <div className="space-y-4">
      <p className="label-overline">Sessions</p>

      {onBehalf && (
        <div className="rounded-sm border border-secondary/30 bg-secondary/5 px-3 py-2 text-xs text-foreground/80">
          Scheduling on behalf of{" "}
          <span className="font-medium text-foreground">
            {hostingSupervisorName}
          </span>
          . The event lands on their Outlook or Google Calendar; they show
          up as the supervisor on the audit trail.
        </div>
      )}

      {showToggle && (
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
        {mode === "schedule_new" && viewerCanScheduleSession ? (
          !hasAssignedSupervisor ? (
            <p className="text-sm text-foreground/70 rounded-sm border border-border bg-card px-3 py-3">
              No supervisor is assigned to this supervisee yet. Assign one
              from the right-hand panel before scheduling — the calendar
              event needs to land on the supervisor&apos;s account.
            </p>
          ) : (
            <ScheduleSessionForm
              superviseeId={superviseeId}
              connectedProviders={connectedProviders}
              onBehalfOfName={hostingSupervisorName}
            />
          )
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
