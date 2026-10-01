"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogSessionForm } from "./log-session-form";
import { ScheduleSessionForm } from "./schedule-session-form";

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
function getHashSnapshot() {
  return window.location.hash;
}
function getServerHash() {
  return "";
}

type Provider = "microsoft" | "google";
type ConnectedProvider = {
  name: Provider;
  accountEmail: string | null;
  isPreferred: boolean;
};

type Props = {
  superviseeId: string;
  viewerCanSupervise: boolean;
  viewerCanScheduleSession: boolean;
  connectedProviders: ConnectedProvider[];
  hostingSupervisorName: string | null;
  hasAssignedSupervisor: boolean;
  groupCandidates: { id: string; name: string }[];
  supervisorCredentials?: string[] | null;
  contractFiled?: boolean;
  /** When false, the halo-yellow "+ New session" trigger button is not
   *  rendered. The modal still auto-opens via the #new-session URL hash,
   *  so a parent that drives open-state externally (e.g. the calendar
   *  page's query-param launcher) can mount this without a visible trigger. */
  renderTrigger?: boolean;
  /** Seed value for the schedule form's start input. Set by the calendar
   *  launcher so a slot click lands in the modal with the clicked time
   *  pre-filled. */
  initialStartUtcIso?: string;
  /** Fires alongside the modal's own close cleanup — lets a parent clear
   *  any URL state it owns (query params the modal doesn't know about). */
  onClose?: () => void;
};

/**
 * "+ New session" halo-yellow trigger + modal that hosts both schedule-new
 * and log-past forms behind a top toggle. Replaces the old inline
 * SessionsPanel (which composed the same two forms without a modal shell).
 *
 * Auto-opens when the URL fragment is #new-session so gap-renderer links
 * (RecurringBehavior) land directly on the correct form.
 *
 * RBAC:
 *   Supervisor  → toggle visible, defaults to schedule.
 *   HR Admin    → schedule-only (no clinical logging).
 *   Supervisee  → never renders — the /roster/[id] page redirects them out.
 */
export function NewSessionModal({
  superviseeId,
  viewerCanSupervise,
  viewerCanScheduleSession,
  connectedProviders,
  hostingSupervisorName,
  hasAssignedSupervisor,
  groupCandidates,
  supervisorCredentials,
  contractFiled,
  renderTrigger = true,
  initialStartUtcIso,
  onClose: onExternalClose,
}: Props) {
  const router = useRouter();
  // Two open sources: the user clicking the trigger, OR the URL fragment
  // #new-session set by gap-renderer deep links. Merge them so either can
  // open the modal; close() clears both by resetting the user state AND
  // stripping the fragment.
  const [userOpen, setUserOpen] = useState(false);
  const hash = useSyncExternalStore(
    subscribeHash,
    getHashSnapshot,
    getServerHash
  );
  const open = userOpen || hash === "#new-session";
  // Supervisors get both; HR Admin gets schedule-only. Default = schedule if
  // the actor can schedule, otherwise log — matches the old SessionsPanel.
  const [mode, setMode] = useState<"schedule_new" | "log_past">(
    viewerCanScheduleSession ? "schedule_new" : "log_past"
  );
  const showToggle = viewerCanSupervise;
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setUserOpen(false);
    triggerRef.current?.focus();
    if (typeof window !== "undefined" && window.location.hash === "#new-session") {
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
      // useSyncExternalStore only observes hashchange events; a
      // replaceState edit doesn't fire one, so nudge the snapshot manually.
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
    onExternalClose?.();
  }, [onExternalClose]);

  const openModal = useCallback(() => {
    setUserOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  function handleSuccess() {
    close();
    router.refresh();
  }

  return (
    <>
      {renderTrigger && (
        <Button
          ref={triggerRef}
          type="button"
          onClick={openModal}
        >
          <Plus className="h-4 w-4 stroke-2" />
          New session
        </Button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-session-modal-title"
        >
          <button
            type="button"
            aria-label="Close new session modal"
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
            onClick={close}
          />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-md border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <p id="new-session-modal-title" className="label-overline">
                New session
              </p>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="text-foreground/60 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {showToggle && (
                <div
                  role="radiogroup"
                  aria-label="Session entry mode"
                  className="flex flex-wrap gap-2"
                >
                  <ModeButton
                    active={mode === "schedule_new"}
                    onClick={() => setMode("schedule_new")}
                    label="Schedule new"
                    sub="Create a calendar event + meeting link"
                  />
                  <ModeButton
                    active={mode === "log_past"}
                    onClick={() => setMode("log_past")}
                    label="Log past"
                    sub="Record a session that already happened"
                  />
                </div>
              )}

              {hostingSupervisorName && mode === "schedule_new" && (
                <div className="rounded-sm border border-secondary/30 bg-secondary/5 px-3 py-2 text-xs text-foreground/80">
                  Scheduling on behalf of{" "}
                  <span className="font-medium text-foreground">
                    {hostingSupervisorName}
                  </span>
                  . The event lands on their Outlook or Google Calendar; they
                  show up as the supervisor on the audit trail.
                </div>
              )}

              {mode === "schedule_new" && viewerCanScheduleSession ? (
                !hasAssignedSupervisor ? (
                  <p className="text-sm text-foreground/70 rounded-sm border border-border bg-card px-3 py-3">
                    No supervisor is assigned to this supervisee yet. Assign
                    one before scheduling — the calendar event needs to land
                    on the supervisor&apos;s account.
                  </p>
                ) : (
                  <ScheduleSessionForm
                    superviseeId={superviseeId}
                    connectedProviders={connectedProviders}
                    onBehalfOfName={hostingSupervisorName}
                    groupCandidates={groupCandidates}
                    initialStartUtcIso={initialStartUtcIso}
                    onSuccess={handleSuccess}
                  />
                )
              ) : (
                <LogSessionForm
                  superviseeId={superviseeId}
                  allowSupervision={viewerCanSupervise}
                  supervisorCredentials={supervisorCredentials}
                  contractFiled={contractFiled}
                  onSuccess={handleSuccess}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
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
      className={`flex-1 min-w-[160px] text-left rounded-sm border px-3 py-2 transition-colors ${
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
