"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  resetPasswordAction,
  type AccountActionResult,
} from "@/app/actions/account";

type Props = {
  token: string;
};

export function ResetPasswordForm({ token }: Props) {
  const [state, formAction, pending] = useActionState<
    AccountActionResult | undefined,
    FormData
  >(resetPasswordAction, undefined);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirm = String(formData.get("confirmPassword") ?? "");
    if (newPassword !== confirm) {
      setConfirmError("Passwords don't match.");
      return;
    }
    setConfirmError(null);
    formAction(formData);
  }

  if (state && state.ok === true) {
    return (
      <div className="space-y-4">
        <p
          role="status"
          className="text-sm text-foreground bg-secondary/8 px-3 py-2 rounded-sm"
        >
          Password reset. Sign in with your new password.
        </p>
        <Button asChild className="w-full">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          className="mt-2"
        />
      </div>
      <div>
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Repeat your new password"
          className="mt-2"
        />
      </div>

      {confirmError && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {confirmError}
        </p>
      )}
      {state && state.ok === false && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Resetting…" : "Reset password"}
      </Button>
    </form>
  );
}
