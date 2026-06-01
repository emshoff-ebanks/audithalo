"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  inviteSuperviseeAction,
  type InviteResult,
} from "@/app/actions/invitations";

export function InviteForm() {
  const [state, formAction, pending] = useActionState<
    InviteResult | undefined,
    FormData
  >(inviteSuperviseeAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="invite-name">Name (optional)</Label>
        <Input
          id="invite-name"
          name="name"
          type="text"
          autoComplete="off"
          placeholder="Jordan Reyes"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="invite-email">Email</Label>
        <Input
          id="invite-email"
          name="email"
          type="email"
          autoComplete="off"
          required
          placeholder="supervisee@firm.com"
          className="mt-1.5"
        />
      </div>

      {state && state.ok === false && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {state.error}
        </p>
      )}

      {state && state.ok === true && (
        <p
          role="status"
          className="text-sm text-[color:var(--color-success)] bg-[color:var(--color-success)]/8 px-3 py-2 rounded-sm"
        >
          Invitation sent to {state.sentTo}.
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send invitation"}
      </Button>
    </form>
  );
}
