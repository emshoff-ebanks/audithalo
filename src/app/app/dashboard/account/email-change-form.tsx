"use client";

import { useActionState, useEffect, useState } from "react";
import { Mail, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestEmailChangeAction,
  type AccountActionResult,
} from "@/app/actions/account";

export function EmailChangeForm({ currentEmail }: { currentEmail: string }) {
  const [state, formAction, pending] = useActionState<
    AccountActionResult | undefined,
    FormData
  >(requestEmailChangeAction, undefined);
  const [justSent, setJustSent] = useState(false);

  useEffect(() => {
    if (state?.ok) setJustSent(true);
  }, [state]);

  if (justSent) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 p-3 rounded-sm border border-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/5">
          <Check className="h-4 w-4 mt-0.5 shrink-0 text-[color:var(--color-success)]" />
          <p className="text-sm text-foreground/80">
            Verification email sent. Click the link in your new email to
            complete the change. Your current email ({currentEmail}) stays
            active until you verify.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setJustSent(false)}
        >
          Request another change
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="newEmail">New email</Label>
        <Input
          id="newEmail"
          name="newEmail"
          type="email"
          autoComplete="email"
          required
          placeholder="you@new-address.com"
          className="mt-2"
        />
        <p className="mt-1.5 text-xs text-foreground/60">
          We&apos;ll send a verification link to the new address. Your current
          email ({currentEmail}) stays active until you click the link.
        </p>
      </div>

      <div>
        <Label htmlFor="emailChangeCurrentPassword">Current password</Label>
        <Input
          id="emailChangeCurrentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="mt-2"
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

      <Button type="submit" size="sm" disabled={pending}>
        <Mail className="h-3.5 w-3.5" />
        {pending ? "Sending…" : "Send verification email"}
      </Button>
    </form>
  );
}
