"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
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
 * Standalone "schedule a new session" modal opened from the calendar
 * (either via the top-right "+ New session" button or an empty-slot
 * click). Differs from the supervisee-detail-page version by adding a
 * supervisee picker at the top — once a supervisee is selected, the
 * embedded ScheduleSessionForm renders for that supervisee.
 *
 * The form intentionally doesn't pre-fill the start time yet: passing
 * a derived datetime through useSyncExternalStore would need an action-
 * level refactor. The slot context is shown above the picker so the
 * supervisor knows they're filling out the form for that slot, and
 * the form's own default is "tomorrow at the next 30-min slot" which
 * stays inside the same calendar week most of the time.
 *
 * connectedProviders is NOT passed at this layer — the supervisee-
 * detail-page is the canonical entry point for booking with calendar
 * provider context. This modal exists for "I clicked an empty slot
 * but don't have a specific supervisee in mind yet" and routes the
 * user to the detail page on submit.
 */
export function ScheduleModal({ startUtcIso, supervisees, onClose }: Props) {
  const router = useRouter();
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

  function goToDetail() {
    if (!picked) return;
    router.push(`/dashboard/roster/${picked}`);
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
                We&apos;ll open the supervisee&apos;s page where the full
                schedule form (with their assigned calendar provider) lives.
                Carry-over of the picked slot into that form lands in the
                next phase — for now, you&apos;ll re-enter the start time
                there.
              </p>
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="ghost" onClick={onClose} type="button">
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={goToDetail}
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

