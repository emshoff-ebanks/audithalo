"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  requestEmailVerificationAction,
  type AccountActionResult,
} from "@/app/actions/account";

export function ResendVerificationButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AccountActionResult | null>(null);

  function handleClick() {
    startTransition(async () => {
      const r = await requestEmailVerificationAction();
      setResult(r);
    });
  }

  if (result?.ok) {
    return (
      <p
        role="status"
        className="text-sm text-foreground bg-secondary/8 px-3 py-2 rounded-sm"
      >
        {result.message ?? "Verification email sent."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        className="w-full"
        disabled={pending}
        onClick={handleClick}
      >
        {pending ? "Sending…" : "Send a new verification email"}
      </Button>
      {result && result.ok === false && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {result.error}
        </p>
      )}
    </div>
  );
}
