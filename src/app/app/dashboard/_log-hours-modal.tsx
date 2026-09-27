"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { LogSessionForm } from "@/app/app/dashboard/roster/[superviseeId]/log-session-form";

type Props = {
  superviseeId: string;
  onClose: () => void;
};

/**
 * "Log practice hours" modal for the supervisee dashboard. Styled to match
 * the calendar ScheduleModal (fixed overlay + centered max-w-md panel), body
 * is the existing LogSessionForm restricted to practice logging.
 *
 * On a successful log the form calls onSuccess → we close and refresh so the
 * rings, totals, and session log update immediately.
 */
export function LogHoursModal({ superviseeId, onClose }: Props) {
  const router = useRouter();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Close log hours modal"
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-md border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="label-overline">Log practice hours</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-foreground/60 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <LogSessionForm
            superviseeId={superviseeId}
            allowSupervision={false}
            onSuccess={() => {
              onClose();
              router.refresh();
            }}
          />
        </div>
      </div>
    </div>
  );
}
