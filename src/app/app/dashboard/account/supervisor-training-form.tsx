"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Save, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateSupervisorTrainingHoursAction,
  type AccountActionResult,
} from "@/app/actions/account";

const SAVED_TOAST_MS = 3500;

export function SupervisorTrainingForm({
  initialHours,
}: {
  initialHours: number | null;
}) {
  const [state, formAction, pending] = useActionState<
    AccountActionResult | undefined,
    FormData
  >(updateSupervisorTrainingHoursAction, undefined);

  // Hide the "Saved" pill after a few seconds — but keep the stored-value
  // readout below the form persistent so the supervisor always knows what's
  // on file.
  const [showSaved, setShowSaved] = useState(false);
  const lastResultRef = useRef<AccountActionResult | undefined>(undefined);
  useEffect(() => {
    if (state && state !== lastResultRef.current && state.ok === true) {
      lastResultRef.current = state;
      setShowSaved(true);
      const t = setTimeout(() => setShowSaved(false), SAVED_TOAST_MS);
      return () => clearTimeout(t);
    }
    lastResultRef.current = state;
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="hours">Training hours completed</Label>
        <Input
          id="hours"
          name="hours"
          type="number"
          min="0"
          step="1"
          defaultValue={initialHours ?? ""}
          placeholder="0"
          className="mt-2 max-w-[200px]"
        />
        <p className="mt-1.5 text-xs text-foreground/60">
          Self-reported. Future versions will verify against transcripts from
          accredited providers.
        </p>
      </div>

      {/*
        Persistent "currently on file" readout. The page re-fetches
        initialHours on every save (the server action revalidates), so the
        value displayed here is always the latest stored value, even after
        the "Saved" toast disappears.
      */}
      <div className="rounded-sm border border-border bg-[color:var(--color-evidence-bg)]/40 px-3 py-2 text-sm">
        <span className="text-foreground/60">Currently on file:</span>{" "}
        {initialHours === null || initialHours === undefined ? (
          <span className="font-medium text-foreground/60">
            Not yet recorded
          </span>
        ) : (
          <span className="font-mono font-semibold text-foreground">
            {initialHours} {initialHours === 1 ? "hour" : "hours"}
          </span>
        )}
      </div>

      {state && state.ok === false && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm flex items-start gap-2"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          <Save className="h-3.5 w-3.5" />
          {pending ? "Saving…" : "Save"}
        </Button>
        {showSaved && (
          <span
            role="status"
            aria-live="polite"
            className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-success)]/10 px-2.5 py-1 text-xs font-medium text-[color:var(--color-success)]"
          >
            <Check className="h-3 w-3" />
            Saved
          </span>
        )}
      </div>
    </form>
  );
}
