"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assignRuleAction, type ActionResult } from "@/app/actions/supervisee";

type Props = {
  superviseeId: string;
  availableRules: { id: string; label: string; summary: string }[];
};

export function AssignRuleForm({ superviseeId, availableRules }: Props) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(assignRuleAction, undefined);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="superviseeId" value={superviseeId} />
      <div>
        <Label htmlFor="ruleId">State rule</Label>
        <select
          id="ruleId"
          name="ruleId"
          required
          defaultValue={availableRules[0]?.id}
          className="mt-1.5 flex h-10 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground"
        >
          {availableRules.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label} — {r.summary}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="obligationStartedAt">Obligation started</Label>
          <Input
            id="obligationStartedAt"
            name="obligationStartedAt"
            type="date"
            required
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="supervisionContractFiledAt">Contract filed (optional)</Label>
          <Input
            id="supervisionContractFiledAt"
            name="supervisionContractFiledAt"
            type="date"
            className="mt-1.5"
          />
        </div>
      </div>

      {state && state.ok === false && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Assigning…" : "Assign rule"}
      </Button>
    </form>
  );
}
