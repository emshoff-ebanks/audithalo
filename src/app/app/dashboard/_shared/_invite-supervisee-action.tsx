"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InviteForm } from "../roster/invite-form";

type AvailableRule = { id: string; label: string; summary: string };
type SupervisorOption = { id: string; name: string };

type Props = {
  availableRules: AvailableRule[];
  supervisorOptions?: SupervisorOption[];
};

export function InviteSuperviseeAction({ availableRules, supervisorOptions }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    const raf = requestAnimationFrame(() => {
      document.getElementById("invite-email")?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf);
    };
  }, [open, close]);

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4 stroke-2" />
        Invite supervisee
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-supervisee-modal-title"
        >
          <button
            type="button"
            aria-label="Close invite modal"
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
            onClick={close}
          />
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-md border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <p id="invite-supervisee-modal-title" className="label-overline">
                  Invite supervisee
                </p>
                {supervisorOptions && (
                  <p className="text-xs text-foreground/60 mt-0.5">
                    Supervisor and HR invitations happen from Team.
                  </p>
                )}
              </div>
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
              <InviteForm
                availableRules={availableRules}
                supervisorOptions={supervisorOptions}
                onSuccess={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                  router.refresh();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
