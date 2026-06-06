"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  inviteSuperviseeAction,
  type InviteResult,
} from "@/app/actions/invitations";

type AvailableRule = { id: string; label: string; summary: string };

type Props = {
  availableRules: AvailableRule[];
};

export function InviteForm({ availableRules }: Props) {
  const [state, formAction, pending] = useActionState<
    InviteResult | undefined,
    FormData
  >(inviteSuperviseeAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  // Track the rule selector locally so we can conditionally render the
  // date fields (no rule → no obligation start). Default to no rule —
  // supervisors who want to assign later can leave it blank.
  const [selectedRule, setSelectedRule] = useState("");

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setSelectedRule("");
    }
  }, [state]);

  const today = new Date().toISOString().slice(0, 10);
  const activeSummary = availableRules.find((r) => r.id === selectedRule)?.summary;

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="invite-name">Name (optional)</Label>
        <Input
          id="invite-name"
          name="name"
          type="text"
          autoComplete="off"
          placeholder="Jordan Reyes"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="invite-email">Email</Label>
        <Input
          id="invite-email"
          name="email"
          type="email"
          autoComplete="off"
          required
          placeholder="supervisee@firm.com"
          className="mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor="invite-rule">
          State rule <span className="text-foreground/50">(optional)</span>
        </Label>
        <select
          id="invite-rule"
          name="ruleId"
          value={selectedRule}
          onChange={(e) => setSelectedRule(e.target.value)}
          className="mt-1.5 w-full h-10 px-3 rounded-sm border border-border bg-background text-sm"
        >
          <option value="">— Assign later —</option>
          {availableRules.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        {activeSummary && (
          <p className="mt-1.5 text-xs text-foreground/60">{activeSummary}</p>
        )}
      </div>

      {selectedRule && (
        <>
          <div>
            <Label htmlFor="invite-obligation-start">
              Obligation start date
            </Label>
            <Input
              id="invite-obligation-start"
              name="obligationStartedAt"
              type="date"
              required
              defaultValue={today}
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-foreground/60">
              First day hours can count toward licensure.
            </p>
          </div>
          <div>
            <Label htmlFor="invite-contract-filed">
              Contract filed date{" "}
              <span className="text-foreground/50">(optional)</span>
            </Label>
            <Input
              id="invite-contract-filed"
              name="supervisionContractFiledAt"
              type="date"
              className="mt-1.5"
            />
          </div>
        </>
      )}

      {state && state.ok === false && (
        <div
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm space-y-2"
        >
          <p>{state.error}</p>
          {state.cta && (
            <Button asChild size="sm" variant="outline">
              <Link href={state.cta.href}>{state.cta.label}</Link>
            </Button>
          )}
        </div>
      )}

      {state && state.ok === true && (
        <p
          role="status"
          className="text-sm text-[color:var(--color-success)] bg-[color:var(--color-success)]/8 px-3 py-2 rounded-sm"
        >
          Invitation sent to {state.sentTo}.
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send invitation"}
      </Button>
    </form>
  );
}
