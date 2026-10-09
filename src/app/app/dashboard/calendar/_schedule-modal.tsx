"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Supervisee } from "./_types";

type Props = {
  startUtcIso: string;
  supervisees: Supervisee[];
  onClose: () => void;
};

/**
 * Picker shim that sits in front of the shared NewSessionModal. The user
 * picks who the session is with, we rewrite the calendar URL to
 * ?newSessionSuperviseeId=...&start=... (preserving the current view/date
 * filters), and the calendar page's server-side launcher takes over —
 * resolves the modal's per-supervisee context and renders the SAME modal
 * the supervisee detail page uses, right here on the calendar page. No
 * navigation to the detail page.
 */
export function ScheduleModal({ startUtcIso, supervisees, onClose }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [picked, setPicked] = useState<string>("");

  const slotLabel = useMemo(() => {
    const d = new Date(startUtcIso);
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  }, [startUtcIso]);

  function openNewSessionModal() {
    if (!picked) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("newSessionSuperviseeId", picked);
    params.set("start", startUtcIso);
    // router.replace instead of push so pressing Back doesn't trap the
    // user in an invisible-modal history state.
    router.replace(`/dashboard/calendar?${params.toString()}`, {
      scroll: false,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Close schedule modal"
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-md border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="label-overline">Schedule a session</p>
            <p className="text-xs text-foreground/60 mt-0.5">{slotLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-foreground/60 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {supervisees.length === 0 ? (
            <p className="text-sm text-foreground/70">
              You don&apos;t have any supervisees on your roster yet. Invite
              one from{" "}
              <span className="font-mono text-xs">/dashboard/roster</span>{" "}
              before scheduling.
            </p>
          ) : (
            <>
              <div>
                <Label htmlFor="modal-supervisee">Supervisee</Label>
                <select
                  id="modal-supervisee"
                  value={picked}
                  onChange={(e) => setPicked(e.target.value)}
                  className="mt-1.5 flex h-10 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground"
                >
                  <option value="">— Pick a supervisee —</option>
                  {supervisees.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-foreground/60">
                We&apos;ll open the new-session form for them with this start
                time pre-filled. You can adjust modality, duration, provider,
                and notes before submitting.
              </p>
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="ghost" onClick={onClose} type="button">
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={openNewSessionModal}
                  disabled={!picked}
                >
                  Continue
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
