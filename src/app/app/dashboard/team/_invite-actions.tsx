"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InviteHrAdminForm,
  InviteSupervisorForm,
  InviteExecutiveForm,
} from "./_invite-forms";

type ModalShellProps = {
  title: string;
  titleId: string;
  autofocusId: string;
  triggerLabel: string;
  children: (close: () => void) => React.ReactNode;
};

function InviteModalShell({
  title,
  titleId,
  autofocusId,
  triggerLabel,
  children,
}: ModalShellProps) {
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
      document.getElementById(autofocusId)?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf);
    };
  }, [open, close, autofocusId]);

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4 stroke-2" />
        {triggerLabel}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <button
            type="button"
            aria-label="Close invite modal"
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
            onClick={close}
          />
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-md border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <p id={titleId} className="label-overline">
                {title}
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
            <div className="p-5">{children(close)}</div>
          </div>
        </div>
      )}
    </>
  );
}

export function InviteHrAdminAction() {
  const router = useRouter();
  return (
    <InviteModalShell
      title="Invite HR Admin"
      titleId="invite-hr-admin-modal-title"
      autofocusId="hra-email"
      triggerLabel="Invite HR Admin"
    >
      {(close) => (
        <InviteHrAdminForm
          onSuccess={() => {
            close();
            router.refresh();
          }}
        />
      )}
    </InviteModalShell>
  );
}

export function InviteSupervisorAction() {
  const router = useRouter();
  return (
    <InviteModalShell
      title="Invite supervisor"
      titleId="invite-supervisor-modal-title"
      autofocusId="sup-email"
      triggerLabel="Invite supervisor"
    >
      {(close) => (
        <InviteSupervisorForm
          onSuccess={() => {
            close();
            router.refresh();
          }}
        />
      )}
    </InviteModalShell>
  );
}

export function InviteExecutiveAction({ seatsLeft }: { seatsLeft: number }) {
  const router = useRouter();
  return (
    <InviteModalShell
      title="Invite executive"
      titleId="invite-executive-modal-title"
      autofocusId="exec-email"
      triggerLabel="Invite executive"
    >
      {(close) => (
        <InviteExecutiveForm
          seatsLeft={seatsLeft}
          onSuccess={() => {
            close();
            router.refresh();
          }}
        />
      )}
    </InviteModalShell>
  );
}
