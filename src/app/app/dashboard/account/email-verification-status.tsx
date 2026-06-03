"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  requestEmailVerificationAction,
  type AccountActionResult,
} from "@/app/actions/account";

type Props = {
  verified: boolean;
};

export function EmailVerificationStatus({ verified }: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AccountActionResult | null>(null);

  if (verified) {
    return (
      <p className="text-sm text-foreground/70">
        Your email is verified — supervision notifications and account alerts
        will be delivered here.
      </p>
    );
  }

  function handleClick() {
    startTransition(async () => {
      const r = await requestEmailVerificationAction();
      setResult(r);
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground/70">
        Verify your email so AuditHalo can deliver supervision notifications,
        evidence packages, and account alerts.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={handleClick}
      >
        {pending ? "Sending…" : "Send verification email"}
      </Button>
      {result && result.ok === true && result.message && (
        <p
          role="status"
          className="text-sm text-foreground bg-secondary/8 px-3 py-2 rounded-sm"
        >
          {result.message}
        </p>
      )}
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
