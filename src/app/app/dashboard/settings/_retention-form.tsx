"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateAuditRetentionAction,
  type SettingsResult,
} from "@/app/actions/audit-log-export";

export function RetentionSettingForm({
  currentValue,
}: {
  currentValue: number;
}) {
  const [state, formAction, pending] = useActionState<
    SettingsResult | undefined,
    FormData
  >(updateAuditRetentionAction, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="retention-years">Years</Label>
        <Input
          id="retention-years"
          name="years"
          type="number"
          min={1}
          max={20}
          step={1}
          required
          defaultValue={currentValue}
          className="mt-1.5 max-w-[140px]"
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
      {state?.ok && (
        <p className="text-sm text-[color:var(--color-success)] bg-[color:var(--color-success)]/8 px-3 py-2 rounded-sm">
          Saved.
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save retention"}
      </Button>
    </form>
  );
}
