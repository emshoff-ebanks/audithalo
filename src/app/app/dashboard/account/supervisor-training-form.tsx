"use client";

import { useActionState, useState, useEffect } from "react";
import { Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateSupervisorTrainingHoursAction,
  type AccountActionResult,
} from "@/app/actions/account";

export function SupervisorTrainingForm({
  initialHours,
}: {
  initialHours: number | null;
}) {
  const [state, formAction, pending] = useActionState<
    AccountActionResult | undefined,
    FormData
  >(updateSupervisorTrainingHoursAction, undefined);
  const [lastSavedState, setLastSavedState] = useState<
    AccountActionResult | undefined
  >(undefined);
  const justSaved = state !== lastSavedState && state?.ok === true;
  useEffect(() => {
    if (state?.ok) setLastSavedState(state);
  }, [state]);

  return (
    <form action={formAction} className="space-y-3">
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

      {state && state.ok === false && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          <Save className="h-3.5 w-3.5" />
          {pending ? "Saving…" : "Save"}
        </Button>
        {justSaved && (
          <span className="text-sm text-[color:var(--color-success)] flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" />
            Saved
          </span>
        )}
      </div>
    </form>
  );
}
