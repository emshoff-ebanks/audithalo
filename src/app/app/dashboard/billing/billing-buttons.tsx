"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startCheckoutAction, startPortalAction } from "@/app/actions/billing";

const PRACTICE_BASE_PRICE = 49;
const PRACTICE_PER_SEAT_PRICE = 25;

/**
 * Read a promo code off the current URL (`?promo=MARIA-BETA`). Returns
 * the trimmed code or null. Used by both CheckoutButton variants so the
 * Founding URL pattern works on any plan.
 */
function usePromoFromUrl(): string | null {
  const params = useSearchParams();
  const value = params.get("promo")?.trim();
  return value && value.length > 0 ? value : null;
}

type CheckoutProps = {
  plan: "solo_monthly" | "solo_yearly" | "practice";
  label: string;
  variant?: "default" | "outline";
};

export function CheckoutButton({ plan, label, variant = "default" }: CheckoutProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const promo = usePromoFromUrl();

  function go() {
    startTransition(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("plan", plan);
      if (promo) fd.set("promoCode", promo);
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

// Practice-specific: lets the supervisor pick a seat count at checkout. The
// quantity is locked in on the Stripe subscription; raising it later goes
// through the Billing Portal.
export function PracticeCheckoutButton({ label }: { label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [seatCount, setSeatCount] = useState(3);
  const promo = usePromoFromUrl();

  const monthlyTotal =
    PRACTICE_BASE_PRICE + PRACTICE_PER_SEAT_PRICE * seatCount;

  function go() {
    startTransition(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("plan", "practice");
      fd.set("seatCount", String(seatCount));
      if (promo) fd.set("promoCode", promo);
      const r = await startCheckoutAction(fd);
      if (r.ok) {
        window.location.href = r.url;
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="practice-seat-count">Seats to purchase</Label>
        <Input
          id="practice-seat-count"
          type="number"
          min={1}
          max={50}
          step={1}
          value={seatCount}
          onChange={(e) =>
            setSeatCount(
              Math.max(1, Math.min(50, Math.floor(Number(e.target.value) || 1)))
            )
          }
          className="mt-1.5"
        />
        <p className="mt-1 text-xs text-foreground/60">
          ${PRACTICE_BASE_PRICE} base + ${PRACTICE_PER_SEAT_PRICE} × {seatCount}{" "}
          = <strong>${monthlyTotal}/month</strong>. Add more later in billing.
        </p>
      </div>
      <Button
        type="button"
        onClick={go}
        disabled={pending}
        className="w-full"
      >
        {pending ? "Loading…" : label}
      </Button>
      {error && (
        <p className="mt-2 text-xs text-[color:var(--color-risk)]" role="alert">
          {error}
        </p>
      )}
    </div>
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
