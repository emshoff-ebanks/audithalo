"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { riskBadgeLabel, riskBadgeVariant } from "@/lib/rules/presentation";
import { AssignRuleForm } from "./assign-rule-form";

type Props = {
  superviseeId: string;
  viewerCanSupervise: boolean;
  // Current assignment (read-only display)
  currentRule: {
    jurisdiction: string;
    licenseCode: string;
    version: number;
    admincode: string;
    sourceUrl: string;
    riskLevel: "green" | "yellow" | "red" | undefined;
  };
  // Defaults for the edit form
  currentRuleId: string; // e.g. "nc-lcmhca-v1"
  currentObligationStartedAt: string; // YYYY-MM-DD
  currentContractFiledAt: string | null; // YYYY-MM-DD or null
  // Catalog for the dropdown
  availableRules: { id: string; label: string; summary: string }[];
};

export function RuleSummaryCard({
  superviseeId,
  viewerCanSupervise,
  currentRule,
  currentRuleId,
  currentObligationStartedAt,
  currentContractFiledAt,
  availableRules,
}: Props) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <Badge variant="outline">Editing rule</Badge>
          <p className="text-xs text-foreground/60">
            Current: {currentRule.jurisdiction} {currentRule.licenseCode} v
            {currentRule.version}
          </p>
        </div>
        <p className="text-sm text-foreground/70 bg-[color:var(--color-warning)]/8 border border-[color:var(--color-warning)]/30 rounded-sm p-3">
          Changing the rule replaces the current assignment. Existing session
          events stay, but will be re-evaluated against the new rule&apos;s
          requirements (hours, cadence, supervisor credentials, group caps).
          Use this if the supervisee relocated to a different state or you
          assigned the wrong rule initially.
        </p>
        <AssignRuleForm
          superviseeId={superviseeId}
          availableRules={availableRules}
          defaultRuleId={currentRuleId}
          defaultObligationStartedAt={currentObligationStartedAt}
          defaultContractFiledAt={currentContractFiledAt ?? undefined}
          submitLabel="Update rule"
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Badge
          variant={riskBadgeVariant(currentRule.riskLevel)}
          className="mb-2"
        >
          {riskBadgeLabel(currentRule.riskLevel)}
        </Badge>
        <h2 className="font-display text-xl font-semibold text-foreground">
          {currentRule.jurisdiction} {currentRule.licenseCode} v
          {currentRule.version}
        </h2>
        <p className="mt-1 text-sm font-mono text-foreground/60">
          {currentRule.admincode}
        </p>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <a
          href={currentRule.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-secondary hover:underline"
        >
          View source ↗
        </a>
        {viewerCanSupervise && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
            className="-mr-2 text-xs"
          >
            <Pencil className="h-3 w-3" />
            Change rule
          </Button>
        )}
      </div>
    </div>
  );
}
