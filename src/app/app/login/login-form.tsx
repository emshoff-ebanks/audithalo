"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type AuthActionResult } from "@/app/actions/auth";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<
    AuthActionResult | undefined,
    FormData
  >(loginAction, undefined);
  const [showTotp, setShowTotp] = useState(false);
  const totpRef = useRef<HTMLInputElement>(null);

  const needsTotp = state && !state.ok && "needsTotp" in state && state.needsTotp;

  useEffect(() => {
    if (needsTotp) {
      setShowTotp(true);
      setTimeout(() => totpRef.current?.focus(), 0);
    }
  }, [needsTotp]);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      {needsTotp && (
        <p className="text-sm text-foreground/70 bg-secondary/5 px-3 py-2 rounded-sm">
          Enter the 6-digit code from your authenticator app to continue.
        </p>
      )}

      <div className={needsTotp ? "sr-only" : undefined}>
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
      <div className={needsTotp ? "sr-only" : undefined}>
        <div className="flex items-baseline justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-secondary font-medium hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="mt-2"
        />
      </div>

      {showTotp ? (
        <div>
          <Label htmlFor="totpCode">Two-factor code</Label>
          <Input
            ref={totpRef}
            id="totpCode"
            name="totpCode"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className="mt-2 font-mono tracking-widest"
            required={needsTotp || undefined}
          />
          <p className="mt-1.5 text-xs text-foreground/60">
            Enter the 6-digit code from your authenticator app, or one of your
            8-character backup codes.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowTotp(true)}
          className="block text-xs text-secondary font-medium hover:underline"
        >
          Have two-factor enabled? Enter a code
        </button>
      )}

      {state && state.ok === false && "error" in state && state.error && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : needsTotp ? "Verify" : "Sign in"}
      </Button>

      {needsTotp && (
        <button
          type="button"
          onClick={() => {
            setShowTotp(false);
            window.location.reload();
          }}
          className="block w-full text-center text-xs text-foreground/50 hover:underline"
        >
          Use a different account
        </button>
      )}
    </form>
  );
}
