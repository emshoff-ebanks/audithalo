"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionLog } from "@/components/app/session-log";

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
  approvedAt?: Date | string | null;
};

type Props = {
  events: SessionEvent[];
  viewerUserId: string;
  superviseeId: string;
  superviseeState?: string | null;
  /** True on supervisor / HR-Admin surfaces, false on the supervisee's own
   *  dashboard. Forwarded to <SessionLog /> so manager-only affordances
   *  (e.g. row-level actions) render only where appropriate. */
  viewerIsManager: boolean;
  /** Session IDs passed through from ?flagged= — trigger auto-open + row
   *  scroll/highlight inside SessionLog. Supervisee surface currently has no
   *  flagged deep-link, so default to []. */
  flaggedSessionIds?: string[];
  /** Total event count, shown on the trigger button when > 0. */
  totalCount: number;
};

/**
 * Trigger + modal wrapping the full session log. Auto-opens on either:
 *   1. ?flagged=<ids> present in the URL (data-correction gap deep link), OR
 *   2. #session-log fragment (legacy anchor from supervisee dashboard "View all",
 *      or in-app <Link> that toggles the hash).
 *
 * Inside the modal, SessionLog is rendered with hideAttentionZone so the page-
 * level "Needs your action" panel isn't duplicated when the modal is open.
 */
export function SessionLogModal({
  events,
  viewerUserId,
  superviseeId,
  superviseeState,
  viewerIsManager,
  flaggedSessionIds = [],
  totalCount,
}: Props) {
  // Three open sources merged into a derived boolean:
  //   1. ?flagged= is present (initial mount, from DataCorrection gap link),
  //   2. user clicked the trigger,
  //   3. URL fragment is #session-log (bare "View all" links).
  const [userOpen, setUserOpen] = useState(false);
  const [flaggedDismissed, setFlaggedDismissed] = useState(false);
  const hash = useSyncExternalStore(
    subscribeHash,
    getHashSnapshot,
    getServerHash
  );
  const flaggedActive =
    !flaggedDismissed && flaggedSessionIds.length > 0;
  const open = userOpen || flaggedActive || hash === "#session-log";
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setUserOpen(false);
    setFlaggedDismissed(true);
    triggerRef.current?.focus();
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const needsFlaggedClear = url.searchParams.has("flagged");
      const needsHashClear = url.hash === "#session-log";
      if (needsFlaggedClear || needsHashClear) {
        url.searchParams.delete("flagged");
        history.replaceState(null, "", url.pathname + url.search);
        if (needsHashClear) {
          // replaceState doesn't fire hashchange; nudge useSyncExternalStore.
          window.dispatchEvent(new HashChangeEvent("hashchange"));
        }
      }
    }
  }, []);

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

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        onClick={openModal}
      >
        <FileText className="h-4 w-4" />
        View full session log
        {totalCount > 0 && (
          <span className="font-mono text-xs text-foreground/60">
            ({totalCount})
          </span>
        )}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-log-modal-title"
        >
          <button
            type="button"
            aria-label="Close session log modal"
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
            onClick={close}
          />
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-md border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
              <p id="session-log-modal-title" className="label-overline">
                Session log ({totalCount})
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

            <div className="p-5">
              {events.length === 0 ? (
                <p className="text-sm text-[color:var(--text-muted)] py-4">
                  No sessions logged yet.
                </p>
              ) : (
                <SessionLog
                  events={events}
                  viewerIsManager={viewerIsManager}
                  viewerUserId={viewerUserId}
                  superviseeId={superviseeId}
                  superviseeState={superviseeState ?? null}
                  flaggedSessionIds={flaggedSessionIds}
                  hideAttentionZone
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
