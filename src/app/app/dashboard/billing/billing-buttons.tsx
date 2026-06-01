"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { startCheckoutAction, startPortalAction } from "@/app/actions/billing";

type CheckoutProps = {
  plan: "solo_monthly" | "solo_yearly" | "practice";
  label: string;
  variant?: "default" | "outline";
};

export function CheckoutButton({ plan, label, variant = "default" }: CheckoutProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go() {
    startTransition(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("plan", plan);
      const r = await startCheckoutAction(fd);
      if (r.ok) {
        window.location.href = r.url;
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        onClick={go}
        disabled={pending}
        variant={variant}
        className="w-full"
      >
        {pending ? "Loading…" : label}
      </Button>
      {error && (
        <p className="mt-2 text-xs text-[color:var(--color-risk)]" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

export function PortalButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go() {
    startTransition(async () => {
      setError(null);
      const r = await startPortalAction();
      if (r.ok) {
        window.location.href = r.url;
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <>
      <Button type="button" onClick={go} disabled={pending}>
        {pending ? "Loading…" : "Manage subscription"}
      </Button>
      {error && (
        <p className="mt-2 text-xs text-[color:var(--color-risk)]" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
