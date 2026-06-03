"use client";

import { useActionState, useState, useEffect } from "react";
import { RotateCw, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  cancelInvitationAction,
  resendInvitationAction,
  type InvitationActionResult,
} from "@/app/actions/invitations";

export function PendingInviteActions({
  invitationId,
  email,
}: {
  invitationId: string;
  email: string;
}) {
  const [resendState, resendFormAction, resendPending] = useActionState<
    InvitationActionResult | undefined,
    FormData
  >(resendInvitationAction, undefined);
  const [cancelState, cancelFormAction, cancelPending] = useActionState<
    InvitationActionResult | undefined,
    FormData
  >(cancelInvitationAction, undefined);

  // "Just resent" feedback — shows for ~3 seconds after a successful resend
  const [lastResendOk, setLastResendOk] = useState(false);
  useEffect(() => {
    if (resendState?.ok) {
      setLastResendOk(true);
      const t = setTimeout(() => setLastResendOk(false), 3000);
      return () => clearTimeout(t);
    }
  }, [resendState]);

  const error =
    (resendState && resendState.ok === false ? resendState.error : null) ??
    (cancelState && cancelState.ok === false ? cancelState.error : null);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <form action={resendFormAction}>
        <input type="hidden" name="invitationId" value={invitationId} />
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          disabled={resendPending || cancelPending}
          title={`Resend invite to ${email}`}
        >
          <RotateCw className="h-3 w-3" />
          {resendPending ? "Sending…" : "Resend"}
        </Button>
      </form>

      <form
        action={cancelFormAction}
        onSubmit={(e) => {
          if (!confirm(`Cancel the invitation to ${email}? They won't be able to accept it.`)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="invitationId" value={invitationId} />
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          disabled={resendPending || cancelPending}
          className="text-[color:var(--color-risk)] hover:bg-[color:var(--color-risk)]/8"
          title={`Cancel invite to ${email}`}
        >
          <X className="h-3 w-3" />
          {cancelPending ? "Canceling…" : "Cancel"}
        </Button>
      </form>

      {lastResendOk && (
        <span
          className="text-xs text-[color:var(--color-success)] flex items-center gap-1"
          role="status"
        >
          <Check className="h-3 w-3" />
          Sent
        </span>
      )}

      {error && (
        <span
          className="text-xs text-[color:var(--color-risk)]"
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  );
}
