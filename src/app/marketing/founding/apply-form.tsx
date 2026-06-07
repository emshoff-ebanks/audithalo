"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  applyFoundingAction,
  type FoundingApplyResult,
} from "@/app/actions/founding";

const STATE_OPTIONS = [
  { value: "NC", label: "North Carolina (LCMHCA)" },
  { value: "CA", label: "California (APCC)" },
  { value: "TX", label: "Texas (LPC-A)" },
  { value: "FL", label: "Florida (RMHCI)" },
  { value: "NY", label: "New York (LP-MHC)" },
  { value: "other", label: "Other / not listed" },
];

const ROSTER_OPTIONS = [
  { value: "1-3", label: "1-3 supervisees" },
  { value: "4-10", label: "4-10 supervisees" },
  { value: "11-25", label: "11-25 supervisees" },
] as const;

export function FoundingApplyForm() {
  const [state, formAction, pending] = useActionState<
    FoundingApplyResult | undefined,
    FormData
  >(applyFoundingAction, undefined);

  if (state?.ok) {
    return (
      <div className="rounded-lg border border-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/5 p-6">
        <p className="font-display text-xl font-semibold text-foreground">
          We've got it.
        </p>
        <p className="mt-2 text-foreground/80 leading-relaxed">
          Damon reads every Founding Supervisor application personally and
          will write back within 48 hours. Check your inbox for confirmation
          — we just sent one over.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="apply-name">Your name</Label>
          <Input
            id="apply-name"
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Jordan Reyes"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="apply-email">Email</Label>
          <Input
            id="apply-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@firm.com"
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="apply-state">State you supervise in</Label>
          <select
            id="apply-state"
            name="state"
            required
            className="mt-1.5 w-full h-10 px-3 rounded-sm border border-border bg-background text-sm"
            defaultValue=""
          >
            <option value="" disabled>
              Pick one
            </option>
            {STATE_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="apply-credential">Your credential</Label>
          <Input
            id="apply-credential"
            name="credential"
            type="text"
            required
            placeholder="LCMHCS / LPC-S / LCSW-S / …"
            className="mt-1.5"
          />
        </div>
      </div>

      <div>
        <Label>Current roster size</Label>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {ROSTER_OPTIONS.map((r, i) => (
            <label
              key={r.value}
              className="flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-2 cursor-pointer hover:bg-accent text-sm"
            >
              <input
                type="radio"
                name="rosterSize"
                value={r.value}
                defaultChecked={i === 0}
                required
                className="accent-foreground"
              />
              {r.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="apply-challenge">
          What&apos;s hard about supervision-compliance today?
        </Label>
        <textarea
          id="apply-challenge"
          name="challenge"
          required
          rows={4}
          minLength={10}
          maxLength={2000}
          placeholder="A sentence or two is fine. Whatever you'd say to a peer over coffee."
          className="mt-1.5 w-full rounded-sm border border-border bg-background px-3 py-2 text-sm leading-relaxed"
        />
      </div>

      {state && state.ok === false && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Apply for the cohort"}
      </Button>
      <p className="text-xs text-foreground/60 text-center">
        We&apos;ll reply within 48 hours. No marketing list spam — your email
        is used to evaluate the application and send our reply.
      </p>
    </form>
  );
}
