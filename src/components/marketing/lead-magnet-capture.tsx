"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  captureLeadMagnetAction,
  type LeadMagnetResult,
} from "@/app/actions/lead-magnet";

const STATE_OPTIONS = [
  { value: "NC", label: "North Carolina" },
  { value: "CA", label: "California" },
  { value: "TX", label: "Texas" },
  { value: "FL", label: "Florida" },
  { value: "NY", label: "New York" },
  { value: "other", label: "Other / not listed" },
];

type Props = {
  slug: string;
  magnetLabel: string;
  /** What renders in the green confirmation banner after submission. */
  confirmationCopy?: string;
};

/**
 * Email-capture form for a downloadable lead magnet (audit checklist /
 * log template). Lives inline on the magnet page as a section, not a
 * modal — modal management is overkill for a single CTA and inline reads
 * less aggressive to a prospect who already chose to scroll.
 */
export function LeadMagnetCapture({
  slug,
  magnetLabel,
  confirmationCopy,
}: Props) {
  const [state, formAction, pending] = useActionState<
    LeadMagnetResult | undefined,
    FormData
  >(captureLeadMagnetAction, undefined);

  if (state?.ok) {
    return (
      <div className="rounded-[14px] border border-[color:var(--ok-700)]/30 bg-[color:var(--ok-50)] p-6">
        <p className="font-display text-xl font-semibold text-foreground">
          Sent — check your inbox.
        </p>
        <p className="mt-2 text-[color:var(--ink-700)] leading-relaxed">
          {confirmationCopy ??
            `The ${magnetLabel} is on its way. If it doesn't show up in 60 seconds, check your spam folder — and tell us so we can fix it.`}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="lm-firstName">First name</Label>
          <Input
            id="lm-firstName"
            name="firstName"
            type="text"
            required
            autoComplete="given-name"
            placeholder="Jordan"
            className="mt-1.5 border-[color:var(--ink-200)] bg-[color:var(--paper-white)] focus-visible:ring-[color:var(--halo-yellow)]"
          />
        </div>
        <div>
          <Label htmlFor="lm-email">Email</Label>
          <Input
            id="lm-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@firm.com"
            className="mt-1.5 border-[color:var(--ink-200)] bg-[color:var(--paper-white)] focus-visible:ring-[color:var(--halo-yellow)]"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="lm-state">State you supervise in (optional)</Label>
        <select
          id="lm-state"
          name="state"
          className="mt-1.5 w-full h-10 px-3 rounded-sm border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] text-sm focus:ring-2 focus:ring-[color:var(--halo-yellow)] focus:outline-none"
          defaultValue=""
        >
          <option value="">Skip</option>
          {STATE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-[color:var(--ink-500)]">
          Helps us send a state-specific version when we publish it.
        </p>
      </div>

      {state && state.ok === false && (
        <p
          role="alert"
          className="text-sm text-[color:var(--risk-700)] bg-[color:var(--risk-50)] px-3 py-2 rounded-sm"
        >
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Sending…" : `Get the printable PDF`}
      </Button>
      <p className="text-xs text-[color:var(--ink-500)] text-center">
        We email you the link and add you to a low-volume list for new
        state checklists. Unsubscribe in one click.
      </p>
    </form>
  );
}
