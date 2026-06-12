"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upsertCanonicalOverrideAction } from "@/app/actions/rule-overrides";

type Severity = "info" | "warning" | "blocker";

type CanonicalCheck = {
  id: string;
  severity: Severity;
  description: string;
};

type CanonicalStructured = {
  total_practice_hours_required: number;
  total_supervision_hours_required: number;
  min_duration_months?: number;
  max_duration_months?: number;
  group_max_attendees?: number;
  min_individual_supervision_fraction?: number;
};

type StructuredField =
  | "total_practice_hours_required"
  | "total_supervision_hours_required"
  | "min_duration_months"
  | "max_duration_months"
  | "group_max_attendees"
  | "min_individual_supervision_fraction";

const STRUCTURED_LABELS: Record<StructuredField, string> = {
  total_practice_hours_required: "Total practice hours",
  total_supervision_hours_required: "Total supervision hours",
  min_duration_months: "Min duration (months)",
  max_duration_months: "Max duration (months)",
  group_max_attendees: "Group max attendees",
  min_individual_supervision_fraction: "Min individual supervision fraction",
};

const SEVERITY_RANK: Record<Severity, number> = {
  blocker: 3,
  warning: 2,
  info: 1,
};

/** Severities the user can pick from for a given canonical severity.
 *  Downgrade-only — matches the action's validation. */
function allowedSeverities(canonical: Severity): Severity[] {
  return (["blocker", "warning", "info"] as const).filter(
    (s) => SEVERITY_RANK[s] <= SEVERITY_RANK[canonical]
  );
}

type FormInitial = {
  label: string;
  structuredPatch: Partial<Record<StructuredField, number>>;
  severityChanges: Record<string, Severity>;
  removeChecks: string[];
  expectedUpdatedAt: string | null;
};

type Props = {
  canonicalRuleId: string;
  canonical: {
    structured: CanonicalStructured;
    checks: CanonicalCheck[];
  };
  initial: FormInitial;
};

export function OverrideEditorForm({
  canonicalRuleId,
  canonical,
  initial,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [label, setLabel] = useState(initial.label);
  // Free-text per field so users can clear (= "no override") without React
  // flicker. Empty string → omit from the submitted patch.
  const [structuredText, setStructuredText] = useState<
    Record<StructuredField, string>
  >(() => {
    const seed: Record<StructuredField, string> = {
      total_practice_hours_required: "",
      total_supervision_hours_required: "",
      min_duration_months: "",
      max_duration_months: "",
      group_max_attendees: "",
      min_individual_supervision_fraction: "",
    };
    for (const [k, v] of Object.entries(initial.structuredPatch)) {
      if (typeof v === "number") seed[k as StructuredField] = String(v);
    }
    return seed;
  });
  const [severityChanges, setSeverityChanges] = useState<
    Record<string, Severity>
  >(initial.severityChanges);
  const [removeChecks, setRemoveChecks] = useState<Set<string>>(
    new Set(initial.removeChecks)
  );

  const [error, setError] = useState<string | null>(null);
  const [staleConflict, setStaleConflict] = useState(false);

  // Show which structured fields are visible on the canonical so we only
  // surface inputs for fields the rule actually defines (e.g., no
  // min_duration_months input on a rule that doesn't use it).
  const structuredFields: StructuredField[] = (
    [
      "total_practice_hours_required",
      "total_supervision_hours_required",
      "min_duration_months",
      "max_duration_months",
      "group_max_attendees",
      "min_individual_supervision_fraction",
    ] as const
  ).filter((f) => canonical.structured[f] !== undefined);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStaleConflict(false);

    const structuredPatch: Partial<Record<StructuredField, number>> = {};
    for (const f of structuredFields) {
      const raw = structuredText[f].trim();
      if (raw === "") continue;
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        setError(`${STRUCTURED_LABELS[f]} must be a number.`);
        return;
      }
      structuredPatch[f] = n;
    }

    // Drop severityChanges entries that match canonical (no-op overrides).
    const effectiveSeverityChanges: Record<string, Severity> = {};
    for (const [checkId, sev] of Object.entries(severityChanges)) {
      const c = canonical.checks.find((x) => x.id === checkId);
      if (!c) continue;
      if (sev !== c.severity) effectiveSeverityChanges[checkId] = sev;
    }

    startTransition(async () => {
      const result = await upsertCanonicalOverrideAction({
        canonicalRuleId,
        label: label.trim(),
        structuredPatch,
        severityChanges: effectiveSeverityChanges,
        removeChecks: Array.from(removeChecks),
        expectedUpdatedAt: initial.expectedUpdatedAt,
      });
      if (result.ok) {
        router.push("/dashboard/team/rules");
        router.refresh();
        return;
      }
      if ("conflict" in result && result.conflict === "stale_row") {
        setStaleConflict(true);
        setError(result.error);
        return;
      }
      setError(result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <input
        type="hidden"
        name="expectedUpdatedAt"
        value={initial.expectedUpdatedAt ?? ""}
      />

      <div className="space-y-2">
        <Label htmlFor="override-label">Label</Label>
        <Input
          id="override-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Our internal NC supervision policy"
          maxLength={120}
          required
        />
        <p className="text-xs text-foreground/60">
          Shown on the rules dashboard. 2&ndash;120 characters.
        </p>
      </div>

      <div className="space-y-3">
        <p className="label-overline">Structured</p>
        <p className="text-xs text-foreground/60">
          Leave a field empty to keep the canonical value. Placeholders show
          what AuditHalo will use if you don&apos;t override.
        </p>
        <div className="space-y-3">
          {structuredFields.map((field) => {
            const canonicalValue = canonical.structured[field];
            return (
              <div key={field} className="grid grid-cols-[1fr_140px] items-center gap-3">
                <Label
                  htmlFor={`structured-${field}`}
                  className="text-sm text-foreground/80"
                >
                  {STRUCTURED_LABELS[field]}
                </Label>
                <Input
                  id={`structured-${field}`}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={structuredText[field]}
                  onChange={(e) =>
                    setStructuredText((prev) => ({
                      ...prev,
                      [field]: e.target.value,
                    }))
                  }
                  placeholder={String(canonicalValue)}
                  className="h-9 text-right font-mono"
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <p className="label-overline">Checks ({canonical.checks.length})</p>
        <p className="text-xs text-foreground/60">
          Severity is downgrade-only. Removing a check stops AuditHalo from
          evaluating it for your org.
        </p>
        <ul className="space-y-2">
          {canonical.checks.map((c) => {
            const isRemoved = removeChecks.has(c.id);
            const currentSev = severityChanges[c.id] ?? c.severity;
            const options = allowedSeverities(c.severity);
            return (
              <li
                key={c.id}
                className={`border border-border rounded-sm p-3 space-y-2 ${
                  isRemoved ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-mono text-xs text-foreground/80">{c.id}</p>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    canonical: {c.severity}
                  </Badge>
                </div>
                <p className="text-xs text-foreground/70">{c.description}</p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={`sev-${c.id}`}
                      className="text-xs text-foreground/60"
                    >
                      Severity
                    </Label>
                    <select
                      id={`sev-${c.id}`}
                      value={currentSev}
                      onChange={(e) =>
                        setSeverityChanges((prev) => ({
                          ...prev,
                          [c.id]: e.target.value as Severity,
                        }))
                      }
                      disabled={isRemoved || options.length === 1}
                      className="h-8 rounded-sm border border-input bg-card px-2 text-xs text-foreground disabled:opacity-50"
                    >
                      {options.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-foreground/70">
                    <input
                      type="checkbox"
                      checked={isRemoved}
                      onChange={(e) =>
                        setRemoveChecks((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(c.id);
                          else next.delete(c.id);
                          return next;
                        })
                      }
                      className="h-3.5 w-3.5"
                    />
                    Remove this check
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-sm border border-[color:var(--color-risk)]/30 bg-[color:var(--color-risk)]/5 p-3 space-y-2"
        >
          <p className="text-sm text-[color:var(--color-risk)]">{error}</p>
          {staleConflict && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                router.refresh();
                setStaleConflict(false);
                setError(null);
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh to see co-admin&apos;s changes
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save override
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/dashboard/team/rules")}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
