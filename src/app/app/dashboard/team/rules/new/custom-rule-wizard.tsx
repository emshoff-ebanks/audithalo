"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TEMPLATE_CATALOG,
  TEMPLATE_DEFAULT_SEVERITY,
  type CheckTemplateKey,
} from "@/lib/rules/check-templates";
import { createCustomRuleAction } from "@/app/actions/custom-rules";

type Severity = "info" | "warning" | "blocker";

type Jurisdiction = { code: string; name: string };
type CanonicalPair = {
  jurisdiction: string;
  licenseCode: string;
  label: string;
};

type StructuredField =
  | "total_practice_hours_required"
  | "total_supervision_hours_required"
  | "min_duration_months"
  | "max_duration_months"
  | "group_max_attendees"
  | "min_individual_supervision_fraction";

const STRUCTURED_FIELDS: Array<{
  key: StructuredField;
  label: string;
  required: boolean;
  integer?: boolean;
  helpText?: string;
}> = [
  {
    key: "total_practice_hours_required",
    label: "Total practice hours required",
    required: true,
    integer: true,
  },
  {
    key: "total_supervision_hours_required",
    label: "Total supervision hours required",
    required: true,
    integer: true,
  },
  {
    key: "min_duration_months",
    label: "Minimum duration (months)",
    required: false,
    integer: true,
  },
  {
    key: "max_duration_months",
    label: "Maximum duration (months)",
    required: false,
    integer: true,
  },
  {
    key: "group_max_attendees",
    label: "Group max attendees",
    required: false,
    integer: true,
  },
  {
    key: "min_individual_supervision_fraction",
    label: "Min individual supervision fraction (0-1)",
    required: false,
  },
];

type CheckRow = {
  templateKey: CheckTemplateKey;
  subKind: string;
  severity: Severity;
  description: string;
  params: Record<string, string>;
};

type WizardData = {
  jurisdiction: string;
  licenseCode: string;
  label: string;
  licenseName: string;
  issuingBoard: string;
  structured: Record<StructuredField, string>;
  checks: CheckRow[];
  summary: string;
  citationAdmincode: string;
  citationStatute: string;
  citationUrl: string;
};

const TEMPLATE_KEYS = Object.keys(TEMPLATE_CATALOG) as CheckTemplateKey[];

function blankWizardData(): WizardData {
  return {
    jurisdiction: "",
    licenseCode: "",
    label: "",
    licenseName: "",
    issuingBoard: "",
    structured: {
      total_practice_hours_required: "",
      total_supervision_hours_required: "",
      min_duration_months: "",
      max_duration_months: "",
      group_max_attendees: "",
      min_individual_supervision_fraction: "",
    },
    checks: [],
    summary: "",
    citationAdmincode: "",
    citationStatute: "",
    citationUrl: "",
  };
}

type Props = {
  jurisdictions: Jurisdiction[];
  canonicalPairs: CanonicalPair[];
};

const STEPS = [
  "Jurisdiction",
  "License",
  "Structured",
  "Checks",
  "Citation",
] as const;

export function CustomRuleWizard({ jurisdictions, canonicalPairs }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(blankWizardData);
  const [error, setError] = useState<string | null>(null);

  // Jurisdictions that have a canonical rule — distinct codes only. The
  // license-already-canonical check at save time still catches duplicates
  // by full (jur, license) tuple, but this hint helps the HR Admin pick a
  // state we haven't shipped yet.
  const canonicalJurisdictionCodes = useMemo(
    () => new Set(canonicalPairs.map((p) => p.jurisdiction)),
    [canonicalPairs]
  );

  function update<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function updateStructured(key: StructuredField, value: string) {
    setData((prev) => ({
      ...prev,
      structured: { ...prev.structured, [key]: value },
    }));
    setError(null);
  }

  function addCheck(templateKey: CheckTemplateKey) {
    const template = TEMPLATE_CATALOG[templateKey];
    const subKindKeys = Object.keys(template.subKinds);
    const subKind = subKindKeys[0];
    const subKindDef = template.subKinds[subKind];
    const params: Record<string, string> = {};
    for (const p of subKindDef.params) params[p.key] = String(p.default);

    setData((prev) => ({
      ...prev,
      checks: [
        ...prev.checks,
        {
          templateKey,
          subKind,
          severity: TEMPLATE_DEFAULT_SEVERITY[templateKey],
          description: subKindDef.defaultDescription,
          params,
        },
      ],
    }));
    setError(null);
  }

  function updateCheck(idx: number, patch: Partial<CheckRow>) {
    setData((prev) => ({
      ...prev,
      checks: prev.checks.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    }));
    setError(null);
  }

  function updateCheckParam(idx: number, key: string, value: string) {
    setData((prev) => ({
      ...prev,
      checks: prev.checks.map((c, i) =>
        i === idx ? { ...c, params: { ...c.params, [key]: value } } : c
      ),
    }));
    setError(null);
  }

  function changeCheckSubKind(idx: number, newSubKind: string) {
    setData((prev) => ({
      ...prev,
      checks: prev.checks.map((c, i) => {
        if (i !== idx) return c;
        const template = TEMPLATE_CATALOG[c.templateKey];
        const subKindDef = template.subKinds[newSubKind];
        const params: Record<string, string> = {};
        for (const p of subKindDef.params) params[p.key] = String(p.default);
        return {
          ...c,
          subKind: newSubKind,
          description: subKindDef.defaultDescription,
          params,
        };
      }),
    }));
    setError(null);
  }

  function removeCheck(idx: number) {
    setData((prev) => ({
      ...prev,
      checks: prev.checks.filter((_, i) => i !== idx),
    }));
    setError(null);
  }

  function validateStep(): string | null {
    if (step === 0) {
      if (!data.jurisdiction) return "Pick a jurisdiction.";
    }
    if (step === 1) {
      if (!data.licenseCode.trim()) return "Enter a license code.";
      if (!/^[A-Za-z0-9_-]+$/.test(data.licenseCode))
        return "License code may only contain letters, numbers, dashes, and underscores.";
      if (!data.label.trim() || data.label.length < 2)
        return "Enter a label (at least 2 characters).";
      if (!data.licenseName.trim() || data.licenseName.length < 2)
        return "Enter the full license name.";
      if (!data.issuingBoard.trim() || data.issuingBoard.length < 2)
        return "Enter the issuing board.";

      // Jur+license-already-canonical guard.
      const collides = canonicalPairs.find(
        (p) =>
          p.jurisdiction === data.jurisdiction &&
          p.licenseCode === data.licenseCode.toUpperCase()
      );
      if (collides) {
        return `${collides.label} already exists as a canonical rule. Use Customize on the rules dashboard instead.`;
      }
    }
    if (step === 2) {
      for (const f of STRUCTURED_FIELDS) {
        const raw = data.structured[f.key].trim();
        if (!raw) {
          if (f.required) return `${f.label} is required.`;
          continue;
        }
        const n = Number(raw);
        if (!Number.isFinite(n)) return `${f.label} must be a number.`;
        if (f.required && n <= 0)
          return `${f.label} must be greater than zero.`;
        if (f.integer && !Number.isInteger(n))
          return `${f.label} must be a whole number.`;
        if (
          f.key === "min_individual_supervision_fraction" &&
          (n < 0 || n > 1)
        )
          return `${f.label} must be between 0 and 1.`;
      }
    }
    if (step === 3) {
      if (data.checks.length === 0)
        return "Add at least one check from the template catalog.";
      const seenEvaluatorIds = new Set<string>();
      for (const c of data.checks) {
        const def = TEMPLATE_CATALOG[c.templateKey].subKinds[c.subKind];
        if (seenEvaluatorIds.has(def.evaluatorId)) {
          return `Two checks both emit '${def.evaluatorId}'. Each sub-kind may only appear once per rule.`;
        }
        seenEvaluatorIds.add(def.evaluatorId);
        for (const p of def.params) {
          const raw = c.params[p.key]?.trim();
          if (!raw) return `${TEMPLATE_CATALOG[c.templateKey].label}: ${p.label} is required.`;
          const n = Number(raw);
          if (!Number.isFinite(n))
            return `${TEMPLATE_CATALOG[c.templateKey].label}: ${p.label} must be a number.`;
          if (p.min !== undefined && n < p.min)
            return `${TEMPLATE_CATALOG[c.templateKey].label}: ${p.label} must be ≥ ${p.min}.`;
          if (p.max !== undefined && n > p.max)
            return `${TEMPLATE_CATALOG[c.templateKey].label}: ${p.label} must be ≤ ${p.max}.`;
          if (p.integer && !Number.isInteger(n))
            return `${TEMPLATE_CATALOG[c.templateKey].label}: ${p.label} must be a whole number.`;
        }
      }
    }
    if (step === 4) {
      if (!data.summary.trim() || data.summary.length < 10)
        return "Summary must be at least 10 characters.";
      if (!data.citationAdmincode.trim())
        return "Admincode (or rule citation) is required.";
      if (!data.citationUrl.trim()) return "Citation URL is required.";
      try {
        new URL(data.citationUrl);
      } catch {
        return "Citation URL must be a valid URL.";
      }
    }
    return null;
  }

  function goNext() {
    const v = validateStep();
    if (v) {
      setError(v);
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  function submit() {
    const v = validateStep();
    if (v) {
      setError(v);
      return;
    }

    // Build the structured + checks payload. Numeric coercion happens here
    // — the inputs hold strings during editing.
    const structured: Record<string, number> = {};
    for (const f of STRUCTURED_FIELDS) {
      const raw = data.structured[f.key].trim();
      if (!raw) continue;
      structured[f.key] = Number(raw);
    }

    const checks = data.checks.map((c) => {
      const params: Record<string, number> = {};
      for (const [k, v] of Object.entries(c.params)) params[k] = Number(v);
      return {
        templateKey: c.templateKey,
        subKind: c.subKind,
        severity: c.severity,
        description: c.description,
        params,
      };
    });

    startTransition(async () => {
      const result = await createCustomRuleAction({
        jurisdiction: data.jurisdiction,
        licenseCode: data.licenseCode.toUpperCase(),
        label: data.label.trim(),
        licenseName: data.licenseName.trim(),
        issuingBoard: data.issuingBoard.trim(),
        summary: data.summary.trim(),
        citationAdmincode: data.citationAdmincode.trim(),
        citationStatute: data.citationStatute.trim() || undefined,
        citationUrl: data.citationUrl.trim(),
        // unsafe cast: action's Zod re-validates the shape end-to-end
        structured: structured as Parameters<
          typeof createCustomRuleAction
        >[0]["structured"],
        checks,
      });

      if (result.ok) {
        router.push("/dashboard/team/rules");
        router.refresh();
        return;
      }
      setError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <Stepper currentStep={step} />

      {step === 0 && (
        <StepJurisdiction
          jurisdictions={jurisdictions}
          canonicalCodes={canonicalJurisdictionCodes}
          value={data.jurisdiction}
          onChange={(v) => update("jurisdiction", v)}
        />
      )}

      {step === 1 && (
        <StepLicense
          data={data}
          update={update}
        />
      )}

      {step === 2 && (
        <StepStructured
          data={data}
          onChange={updateStructured}
        />
      )}

      {step === 3 && (
        <StepChecks
          data={data}
          addCheck={addCheck}
          updateCheck={updateCheck}
          updateCheckParam={updateCheckParam}
          changeCheckSubKind={changeCheckSubKind}
          removeCheck={removeCheck}
        />
      )}

      {step === 4 && (
        <StepCitation
          data={data}
          update={update}
        />
      )}

      {error && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
        <Button
          type="button"
          variant="ghost"
          onClick={goBack}
          disabled={step === 0 || pending}
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={goNext} disabled={pending}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save custom rule
          </Button>
        )}
      </div>
    </div>
  );
}

function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {STEPS.map((label, idx) => {
        const isDone = idx < currentStep;
        const isCurrent = idx === currentStep;
        return (
          <li key={label} className="flex items-center gap-1.5">
            {isDone ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--color-success,var(--color-secondary))]" />
            ) : (
              <Circle
                className={`h-3.5 w-3.5 ${
                  isCurrent
                    ? "text-foreground"
                    : "text-foreground/30"
                }`}
              />
            )}
            <span
              className={
                isCurrent
                  ? "font-medium text-foreground"
                  : isDone
                    ? "text-foreground/70"
                    : "text-foreground/40"
              }
            >
              {idx + 1}. {label}
            </span>
            {idx < STEPS.length - 1 && (
              <span className="text-foreground/30 mx-1">/</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StepJurisdiction({
  jurisdictions,
  canonicalCodes,
  value,
  onChange,
}: {
  jurisdictions: Jurisdiction[];
  canonicalCodes: Set<string>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="font-display text-lg font-semibold">
        Step 1 &middot; Pick a jurisdiction
      </h2>
      <p className="text-sm text-foreground/70">
        States already in the canonical set are tagged with a badge &mdash;
        the right path for them is to override the canonical, not duplicate
        it as a custom.
      </p>
      <div className="space-y-1">
        <Label htmlFor="jurisdiction">State</Label>
        <select
          id="jurisdiction"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1.5 flex h-10 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground"
        >
          <option value="">— Select a state —</option>
          {jurisdictions.map((s) => (
            <option key={s.code} value={s.code}>
              {s.code} &mdash; {s.name}
              {canonicalCodes.has(s.code) ? " (canonical exists)" : ""}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function StepLicense({
  data,
  update,
}: {
  data: WizardData;
  update: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="font-display text-lg font-semibold">
        Step 2 &middot; License code &amp; label
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="licenseCode">License code</Label>
          <Input
            id="licenseCode"
            value={data.licenseCode}
            onChange={(e) =>
              update("licenseCode", e.target.value.toUpperCase())
            }
            placeholder="LPCA"
            maxLength={40}
          />
          <p className="text-xs text-foreground/60">
            Short code &mdash; letters, numbers, dashes only.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="label">Label</Label>
          <Input
            id="label"
            value={data.label}
            onChange={(e) => update("label", e.target.value)}
            placeholder="Wyoming LPCA — internal policy"
            maxLength={120}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="licenseName">Full license name</Label>
          <Input
            id="licenseName"
            value={data.licenseName}
            onChange={(e) => update("licenseName", e.target.value)}
            placeholder="Licensed Professional Counselor Associate"
            maxLength={160}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="issuingBoard">Issuing board</Label>
          <Input
            id="issuingBoard"
            value={data.issuingBoard}
            onChange={(e) => update("issuingBoard", e.target.value)}
            placeholder="Wyoming Mental Health Professions Licensing Board"
            maxLength={160}
          />
        </div>
      </div>
    </div>
  );
}

function StepStructured({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (k: StructuredField, v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="font-display text-lg font-semibold">
        Step 3 &middot; Structured requirements
      </h2>
      <p className="text-sm text-foreground/70">
        The total hours and duration window. Practice and supervision hours
        are required; the others are optional and only enforced when set.
      </p>
      <div className="space-y-2">
        {STRUCTURED_FIELDS.map((f) => (
          <div
            key={f.key}
            className="grid grid-cols-[1fr_140px] items-center gap-3"
          >
            <Label
              htmlFor={`structured-${f.key}`}
              className="text-sm text-foreground/80"
            >
              {f.label}
              {f.required && (
                <span className="text-[color:var(--color-risk)] ml-0.5">*</span>
              )}
            </Label>
            <Input
              id={`structured-${f.key}`}
              type="number"
              inputMode="decimal"
              step="any"
              value={data.structured[f.key]}
              onChange={(e) => onChange(f.key, e.target.value)}
              className="h-9 text-right font-mono"
              placeholder={f.required ? "required" : "optional"}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function StepChecks({
  data,
  addCheck,
  updateCheck,
  updateCheckParam,
  changeCheckSubKind,
  removeCheck,
}: {
  data: WizardData;
  addCheck: (k: CheckTemplateKey) => void;
  updateCheck: (idx: number, patch: Partial<CheckRow>) => void;
  updateCheckParam: (idx: number, key: string, value: string) => void;
  changeCheckSubKind: (idx: number, newSubKind: string) => void;
  removeCheck: (idx: number) => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="font-display text-lg font-semibold">
        Step 4 &middot; Compliance checks
      </h2>
      <p className="text-sm text-foreground/70">
        Pick from the seven check templates. Each template can be added at
        most once per sub-kind (you can have a practice-hours total AND a
        supervision-hours total, but not two practice-hours totals).
      </p>

      <div className="flex flex-wrap gap-2 pb-2 border-b border-border">
        {TEMPLATE_KEYS.map((k) => (
          <Button
            key={k}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addCheck(k)}
          >
            <Plus className="h-3.5 w-3.5" />
            {TEMPLATE_CATALOG[k].label}
          </Button>
        ))}
      </div>

      {data.checks.length === 0 ? (
        <p className="text-sm text-foreground/60 py-4 text-center border border-dashed border-border rounded-sm">
          No checks added yet. Pick at least one to continue.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.checks.map((c, idx) => {
            const template = TEMPLATE_CATALOG[c.templateKey];
            const subKindKeys = Object.keys(template.subKinds);
            const subKindDef = template.subKinds[c.subKind];
            return (
              <li
                key={idx}
                className="border border-border rounded-sm p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {template.label}
                    </Badge>
                    <p className="mt-1 text-xs text-foreground/60">
                      {template.helpText}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCheck(idx)}
                    className="text-foreground/50 hover:text-foreground"
                    aria-label="Remove check"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {subKindKeys.length > 1 && (
                    <div>
                      <Label
                        htmlFor={`subkind-${idx}`}
                        className="text-xs text-foreground/60"
                      >
                        Variant
                      </Label>
                      <select
                        id={`subkind-${idx}`}
                        value={c.subKind}
                        onChange={(e) =>
                          changeCheckSubKind(idx, e.target.value)
                        }
                        className="mt-1 h-9 w-full rounded-sm border border-input bg-card px-2 text-sm text-foreground"
                      >
                        {subKindKeys.map((sk) => (
                          <option key={sk} value={sk}>
                            {template.subKinds[sk].label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <Label
                      htmlFor={`severity-${idx}`}
                      className="text-xs text-foreground/60"
                    >
                      Severity
                    </Label>
                    <select
                      id={`severity-${idx}`}
                      value={c.severity}
                      onChange={(e) =>
                        updateCheck(idx, {
                          severity: e.target.value as Severity,
                        })
                      }
                      className="mt-1 h-9 w-full rounded-sm border border-input bg-card px-2 text-sm text-foreground"
                    >
                      <option value="info">info</option>
                      <option value="warning">warning</option>
                      <option value="blocker">blocker</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  {subKindDef.params.map((p) => (
                    <div
                      key={p.key}
                      className="grid grid-cols-[1fr_140px] items-center gap-3"
                    >
                      <Label
                        htmlFor={`param-${idx}-${p.key}`}
                        className="text-xs text-foreground/70"
                      >
                        {p.label}
                      </Label>
                      <Input
                        id={`param-${idx}-${p.key}`}
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={c.params[p.key] ?? ""}
                        onChange={(e) =>
                          updateCheckParam(idx, p.key, e.target.value)
                        }
                        className="h-8 text-right font-mono text-xs"
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <Label
                    htmlFor={`desc-${idx}`}
                    className="text-xs text-foreground/60"
                  >
                    Description
                  </Label>
                  <Input
                    id={`desc-${idx}`}
                    value={c.description}
                    onChange={(e) =>
                      updateCheck(idx, { description: e.target.value })
                    }
                    maxLength={500}
                    className="h-9 text-xs"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StepCitation({
  data,
  update,
}: {
  data: WizardData;
  update: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="font-display text-lg font-semibold">
        Step 5 &middot; Citation &amp; summary
      </h2>
      <p className="text-sm text-foreground/70">
        Both the admincode (or short citation) and a board source URL are
        required. A custom rule without a real source is the most dangerous
        failure mode.
      </p>

      <div className="space-y-3">
        <div>
          <Label htmlFor="summary">Summary</Label>
          <textarea
            id="summary"
            value={data.summary}
            onChange={(e) => update("summary", e.target.value)}
            className="mt-1.5 flex w-full min-h-[80px] rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground"
            maxLength={2000}
            placeholder="One-paragraph plain-English summary of the requirement, mirroring the format we use for canonical rules."
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="citationAdmincode">Admincode / citation</Label>
            <Input
              id="citationAdmincode"
              value={data.citationAdmincode}
              onChange={(e) => update("citationAdmincode", e.target.value)}
              placeholder="WY ABC § 1.2.3"
              maxLength={200}
            />
          </div>
          <div>
            <Label htmlFor="citationStatute">Statute (optional)</Label>
            <Input
              id="citationStatute"
              value={data.citationStatute}
              onChange={(e) => update("citationStatute", e.target.value)}
              placeholder="W.S. § 33-38-101 et seq."
              maxLength={200}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="citationUrl">Board source URL</Label>
          <Input
            id="citationUrl"
            type="url"
            value={data.citationUrl}
            onChange={(e) => update("citationUrl", e.target.value)}
            placeholder="https://board.state.gov/admincode/..."
          />
        </div>
      </div>
    </div>
  );
}
