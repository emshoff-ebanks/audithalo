"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestPasswordResetAction,
  type AccountActionResult,
} from "@/app/actions/account";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<
    AccountActionResult | undefined,
    FormData
  >(requestPasswordResetAction, undefined);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@firm.com"
          className="mt-2"
        />
      </div>

      {state && state.ok === true && state.message && (
        <p
          role="status"
          className="text-sm text-foreground bg-secondary/8 px-3 py-2 rounded-sm"
        >
          {state.message}
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
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
