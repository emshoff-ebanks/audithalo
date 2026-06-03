"use client";

/**
 * Disable-2FA form. Hidden behind a "Disable two-factor" button so the user
 * doesn't fat-finger it. Requires the current password — defence against a
 * session-hijack attacker who would otherwise be able to remove 2FA on a
 * compromised account.
 */

import { useActionState, useState } from "react";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  disableTotpAction,
  type AccountActionResult,
} from "@/app/actions/account";

export function TotpDisableForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    AccountActionResult | undefined,
    FormData
  >(disableTotpAction, undefined);

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <ShieldOff className="h-3.5 w-3.5" />
        Disable two-factor
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 border-t pt-4">
      <p className="text-sm text-foreground/70">
        Confirm your current password to disable two-factor authentication.
        This will sign you out of all other devices.
      </p>
      <div>
        <Label htmlFor="totp-disable-password">Current password</Label>
        <Input
          id="totp-disable-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="mt-2 max-w-sm"
        />
      </div>

      {state?.ok === false && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {state.error}
        </p>
      )}
      {state?.ok === true && state.message && (
        <p
          role="status"
          className="text-sm text-foreground bg-secondary/8 px-3 py-2 rounded-sm"
        >
          {state.message}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Disabling…" : "Disable two-factor"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
