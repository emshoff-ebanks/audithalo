"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assignRuleAction, type ActionResult } from "@/app/actions/supervisee";

export type RuleGuidance = {
  ruleId: string;
  /** Bullets from rule YAML page_content.key_warnings. */
  keyWarnings: string[];
  /** Max obligation window in months. NC = 60 (5y), CA = 72 (6y), etc. */
  permitWindowMonths: number | null;
  /** State-specific tag for the contract-filed field. */
  contractFieldHelp: string | null;
};

type Props = {
  superviseeId: string;
  availableRules: { id: string; label: string; summary: string }[];
  defaultRuleId?: string;
  defaultObligationStartedAt?: string; // YYYY-MM-DD
  defaultContractFiledAt?: string; // YYYY-MM-DD
  submitLabel?: string; // default "Assign rule"
  onCancel?: () => void; // if provided, render a Cancel button
  onSuccess?: (newRuleId: string) => void; // fires after a successful assignment
  /** Per-rule guidance (warnings + window math) keyed by ruleId. */
  guidance: RuleGuidance[];
};

export function AssignRuleForm({
  superviseeId,
  availableRules,
  defaultRuleId,
  defaultObligationStartedAt,
  defaultContractFiledAt,
  submitLabel,
  onCancel,
  onSuccess,
  guidance,
}: Props) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(assignRuleAction, undefined);
  const lastResultRef = useRef<ActionResult | undefined>(undefined);
  const ruleSelectRef = useRef<HTMLSelectElement>(null);

  // Track the live values of the rule + obligation-started fields so the
  // state-specific guidance updates as the user types.
  const [selectedRuleId, setSelectedRuleId] = useState(
    defaultRuleId ?? availableRules[0]?.id ?? ""
  );
  const [obligationStart, setObligationStart] = useState(
    defaultObligationStartedAt ?? ""
  );

  useEffect(() => {
    if (state && state !== lastResultRef.current && state.ok === true) {
      lastResultRef.current = state;
      if (onSuccess) onSuccess(selectedRuleId);
    } else if (state) {
      lastResultRef.current = state;
    }
  }, [state, onSuccess, selectedRuleId]);

  const activeGuidance = useMemo(
    () => guidance.find((g) => g.ruleId === selectedRuleId) ?? null,
    [guidance, selectedRuleId]
  );

  // Compute the projected obligation-window-close date from
  // obligationStart + permitWindowMonths.
  const windowCloseDate = useMemo(() => {
    if (!activeGuidance?.permitWindowMonths || !obligationStart) return null;
    const start = new Date(obligationStart);
    if (Number.isNaN(start.getTime())) return null;
    const close = new Date(start);
    close.setMonth(close.getMonth() + activeGuidance.permitWindowMonths);
    return close.toISOString().slice(0, 10);
  }, [activeGuidance, obligationStart]);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="superviseeId" value={superviseeId} />
      <div>
        <Label htmlFor="ruleId">State rule</Label>
        <select
          ref={ruleSelectRef}
          id="ruleId"
          name="ruleId"
          required
          value={selectedRuleId}
          onChange={(e) => setSelectedRuleId(e.currentTarget.value)}
          className="mt-1.5 flex h-10 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground"
        >
          {availableRules.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label} — {r.summary}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="obligationStartedAt">Obligation started</Label>
          <Input
            id="obligationStartedAt"
            name="obligationStartedAt"
            type="date"
            required
            defaultValue={defaultObligationStartedAt}
            onChange={(e) => setObligationStart(e.currentTarget.value)}
            className="mt-1.5"
          />
          {windowCloseDate && (
            <p className="mt-1.5 text-[11px] text-foreground/60">
              Window closes ~{windowCloseDate} (
              {activeGuidance!.permitWindowMonths} months from start)
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="supervisionContractFiledAt">
            Contract filed (optional)
          </Label>
          <Input
            id="supervisionContractFiledAt"
            name="supervisionContractFiledAt"
            type="date"
            defaultValue={defaultContractFiledAt}
            className="mt-1.5"
          />
          {activeGuidance?.contractFieldHelp && (
            <p className="mt-1.5 text-[11px] text-foreground/60">
              {activeGuidance.contractFieldHelp}
            </p>
          )}
        </div>
      </div>

      {/* State-specific warnings sourced from rule YAML page_content.key_warnings.
          These are the most-common audit failures per state — surface them
          right when the supervisor is filling out the assignment. */}
      {activeGuidance && activeGuidance.keyWarnings.length > 0 && (
        <div className="rounded-sm border border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning)]/5 p-3">
          <div className="flex items-start gap-2 mb-1.5">
            <AlertTriangle
              className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[color:var(--color-warning)]"
              strokeWidth={2}
            />
            <p className="text-xs font-semibold text-foreground">
              Watch out for these on this state&apos;s rule
            </p>
          </div>
          <ul className="space-y-1 pl-5 text-xs text-foreground/75 list-disc marker:text-[color:var(--color-warning)]">
            {activeGuidance.keyWarnings.slice(0, 4).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {state && state.ok === false && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Assigning…" : (submitLabel ?? "Assign rule")}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
