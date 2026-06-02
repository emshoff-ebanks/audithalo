"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signupAction, type AuthActionResult } from "@/app/actions/auth";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<
    AuthActionResult | undefined,
    FormData
  >(signupAction, undefined);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <div>
        <Label htmlFor="name">Full name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          placeholder="Jordan Reyes, LCMHCS"
          className="mt-2"
        />
      </div>
      <div>
        <Label htmlFor="email">Work email</Label>
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
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          className="mt-2"
        />
        <p className="mt-1.5 text-xs text-foreground/60">Use at least 8 characters.</p>
      </div>

      {state && state.ok === false && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-xs text-foreground/60">
        By creating an account you agree to our{" "}
        <a
          href="https://audithalo.com/legal/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-secondary hover:underline"
        >
          Terms
        </a>{" "}
        and{" "}
        <a
          href="https://audithalo.com/legal/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-secondary hover:underline"
        >
          Privacy Policy
        </a>
        .
      </p>
    </form>
  );
}
