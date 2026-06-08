"use client";

import { useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { upgradeToPracticeAction } from "@/app/actions/billing";

const PRESET_SEATS = [3, 5, 10];

export function UpgradeToPracticeForm({
  currentSeatCount,
}: {
  currentSeatCount: number | null;
}) {
  const [seatCount, setSeatCount] = useState<number>(
    Math.max(currentSeatCount ?? 3, 3)
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card className="mt-6 border-secondary/30">
      <CardContent className="p-6">
        <p className="label-overline mb-2">Upgrade to Practice</p>
        <h3 className="font-display text-xl font-semibold text-foreground">
          Need more than 3 supervisees?
        </h3>
        <p className="mt-2 text-sm text-foreground/70">
          Practice is <strong>$49/mo base + $25/supervisee/mo</strong>. Unlimited
          supervisees, all 5 supported states, HR + exec dashboards, 7-year
          audit log retention. Switch is prorated — you'll get credit for the
          unused portion of your Solo plan.
        </p>

        <form
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await upgradeToPracticeAction(formData);
              if (result.ok) {
                window.location.href = result.url;
              } else {
                setError(result.error);
              }
            });
          }}
          className="mt-5 space-y-4"
        >
          <div>
            <p className="label-overline mb-2">How many supervisees?</p>
            <div className="flex flex-wrap gap-2 items-center">
              {PRESET_SEATS.map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="sm"
                  variant={seatCount === n ? "default" : "outline"}
                  onClick={() => setSeatCount(n)}
                  disabled={pending}
                >
                  {n}
                </Button>
              ))}
              <input
                type="number"
                name="seatCount"
                min={1}
                max={50}
                value={seatCount}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) setSeatCount(v);
                }}
                className="h-9 w-20 px-2 rounded-sm border border-border bg-background text-sm"
                disabled={pending}
              />
              <span className="text-sm text-foreground/60">
                ${49 + 25 * seatCount}/mo total
              </span>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="text-sm text-[color:var(--color-risk)]"
            >
              {error}
            </p>
          )}

          <Button type="submit" disabled={pending}>
            {pending ? "Upgrading…" : "Upgrade to Practice"}
            {!pending && <ArrowRight />}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
