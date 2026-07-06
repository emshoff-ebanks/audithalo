"use client";

import { useState, useCallback, useRef, useTransition } from "react";
import { ChevronRight } from "lucide-react";
import { saveClinicalFormDataAction } from "@/app/actions/clinical-form";
import { CORE_SKILLS, COMPETENCIES, FREQUENCY_PLAN_LABELS } from "@/lib/clinical-form/constants";
import type { ClinicalFormData } from "@/lib/clinical-form/types";

type Props = {
  sessionEventId: string;
  initialData: ClinicalFormData | null;
  sessionType: string | null;
  isInitialPlan: boolean;
  aiNote: {
    topics?: string[];
    nextSteps?: string[];
    supervisorFeedback?: string;
  } | null;
};

function AccordionSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border pt-4 mt-4">
      <button
        type="button"
        className="flex items-center justify-between w-full text-left text-sm font-semibold text-foreground"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <ChevronRight
          className={`h-3.5 w-3.5 text-foreground/50 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && <div className="pt-3">{children}</div>}
    </div>
  );
}

export function ClinicalForm({
  sessionEventId,
  initialData,
  sessionType,
  isInitialPlan,
  aiNote,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const data: ClinicalFormData = initialData ?? {};

  // Pre-populate from AI note on first render if form is empty
  const defaults: Partial<ClinicalFormData> = {};
  if (!initialData && aiNote) {
    if (aiNote.nextSteps?.length) {
      defaults.actionSteps = aiNote.nextSteps.slice(0, 2).map((s) => ({
        step: s,
        targetDate: "",
      }));
    }
    if (aiNote.topics?.length) {
      defaults.groupDiscussionTopics = aiNote.topics.join("\n");
    }
    if (aiNote.supervisorFeedback) {
      defaults.additionalContext = aiNote.supervisorFeedback;
    }
  }

  const merged = { ...defaults, ...data };

  const debouncedSave = useCallback(
    (patch: Partial<ClinicalFormData>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaved(false);
      saveTimer.current = setTimeout(() => {
        startTransition(async () => {
          const result = await saveClinicalFormDataAction(sessionEventId, patch);
          if (result.ok) setSaved(true);
        });
      }, 800);
    },
    [sessionEventId, startTransition]
  );

  function onTextChange(field: keyof ClinicalFormData, value: string) {
    debouncedSave({ [field]: value });
  }

  function onCheckboxToggle(
    field: "coreSkillsChecked" | "competenciesChecked",
    key: string,
    checked: boolean
  ) {
    const current = (merged[field] as string[] | undefined) ?? [];
    const next = checked
      ? [...current, key]
      : current.filter((k) => k !== key);
    debouncedSave({ [field]: next });
  }

  function onActionStepChange(
    index: number,
    part: "step" | "targetDate",
    value: string
  ) {
    const steps = [...(merged.actionSteps ?? [{ step: "", targetDate: "" }, { step: "", targetDate: "" }])];
    while (steps.length <= index) steps.push({ step: "", targetDate: "" });
    steps[index] = { ...steps[index], [part]: value };
    debouncedSave({ actionSteps: steps });
  }

  const isGroup = sessionType === "group" || sessionType === "triadic";
  const coreChecked = new Set(merged.coreSkillsChecked ?? []);
  const compChecked = new Set(merged.competenciesChecked ?? []);

  return (
    <div className="pt-4 border-t border-border">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-foreground/50 flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--color-gold)]" />
          Clinical Supervision Form
        </p>
        {(saved || isPending) && (
          <span className="text-[0.6875rem] text-[color:var(--color-success)] flex items-center gap-1">
            {isPending ? "Saving..." : "✓ Saved"}
          </span>
        )}
      </div>
      <p className="text-xs text-foreground/50 mb-4">
        Required for Recovery Innovations. Fields auto-save on change.
      </p>

      {/* Initial Plan section — first session only */}
      {isInitialPlan && (
        <AccordionSection title="Initial Supervision Plan" defaultOpen>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-[0.8125rem] font-medium text-foreground block mb-1">
                Frequency Plan of Supervision
              </label>
              <select
                className="flex h-10 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground"
                defaultValue={merged.frequencyPlan ?? ""}
                onChange={(e) => onTextChange("frequencyPlan", e.target.value)}
              >
                <option value="">Select frequency...</option>
                {Object.entries(FREQUENCY_PLAN_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-[0.8125rem]">
              <input
                type="checkbox"
                defaultChecked={merged.policyReviewed ?? false}
                onChange={(e) =>
                  debouncedSave({ policyReviewed: e.target.checked })
                }
                className="accent-[color:var(--color-primary)]"
              />
              Clinical Supervision &amp; Oversight Policy Reviewed
            </label>
            <label className="flex items-center gap-2 text-[0.8125rem]">
              <input
                type="checkbox"
                defaultChecked={merged.contractAgreedUpon ?? false}
                onChange={(e) =>
                  debouncedSave({ contractAgreedUpon: e.target.checked })
                }
                className="accent-[color:var(--color-primary)]"
              />
              Supervision Plan/Contract Agreed Upon
            </label>
          </div>
        </AccordionSection>
      )}

      {/* Follow-up from previous session */}
      <div className="mt-3">
        <label className="text-[0.8125rem] font-medium text-foreground block mb-1">
          Follow-up from previous supervision session(s)
        </label>
        <textarea
          className="flex w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground min-h-[60px] resize-y"
          defaultValue={merged.followUpFromPrevious ?? ""}
          placeholder="Notes on follow-up items from the last session..."
          onBlur={(e) => onTextChange("followUpFromPrevious", e.target.value)}
        />
      </div>

      {/* Section I: Core skills + competencies */}
      <AccordionSection title="I. Key areas / skills / goals discussed" defaultOpen>
        <p className="text-xs text-foreground/50 mb-2">
          Select one or more. Items marked * are required core skills.
        </p>

        <p className="text-[0.8125rem] font-medium text-foreground mb-1.5">Core skills</p>
        <div className="space-y-0.5 mb-4">
          {CORE_SKILLS.map((skill) => (
            <label
              key={skill.key}
              className="flex items-start gap-2 text-[0.8125rem] text-foreground py-1 leading-snug"
            >
              <input
                type="checkbox"
                className="mt-0.5 accent-[color:var(--color-primary)] shrink-0"
                defaultChecked={coreChecked.has(skill.key)}
                onChange={(e) =>
                  onCheckboxToggle("coreSkillsChecked", skill.key, e.target.checked)
                }
              />
              {skill.key === "other" ? (
                <span className="flex items-center gap-1">
                  Other:
                  <input
                    type="text"
                    className="h-7 w-64 rounded-sm border border-input bg-card px-2 text-sm"
                    defaultValue={merged.otherCoreSkill ?? ""}
                    placeholder="Specify..."
                    onBlur={(e) => onTextChange("otherCoreSkill", e.target.value)}
                  />
                </span>
              ) : (
                skill.label
              )}
            </label>
          ))}
        </div>

        <p className="text-[0.8125rem] font-medium text-foreground mb-1.5">Competencies</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5">
          {COMPETENCIES.map((c) => (
            <label
              key={c.key}
              className="flex items-start gap-1.5 text-[0.8125rem] text-foreground leading-tight"
            >
              <input
                type="checkbox"
                className="mt-0.5 accent-[color:var(--color-primary)] shrink-0"
                defaultChecked={compChecked.has(c.key)}
                onChange={(e) =>
                  onCheckboxToggle("competenciesChecked", c.key, e.target.checked)
                }
              />
              <span>
                {c.label}
                {c.required && <span className="text-[0.625rem] text-[color:var(--color-risk)]">*</span>}
              </span>
            </label>
          ))}
        </div>
      </AccordionSection>

      {/* Section II (individual) / Section III (group) */}
      {isGroup ? (
        <AccordionSection title="III. Group supervision topics" defaultOpen>
          <p className="text-xs text-foreground/50 mb-2">
            What key areas/skills were discussed in today&apos;s supervision?
          </p>
          <textarea
            className="flex w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground min-h-[80px] resize-y"
            defaultValue={merged.groupDiscussionTopics ?? ""}
            placeholder="Key areas and skills discussed..."
            onBlur={(e) => onTextChange("groupDiscussionTopics", e.target.value)}
          />
        </AccordionSection>
      ) : (
        <AccordionSection title="II. Action steps to reach identified goals" defaultOpen>
          <p className="text-xs text-foreground/50 mb-2">
            What action steps do you plan on taking to reach identified goal(s)?
          </p>
          {[0, 1].map((i) => {
            const step = merged.actionSteps?.[i] ?? { step: "", targetDate: "" };
            return (
              <div key={i} className="flex gap-3 items-start mb-2">
                <span className="text-xs font-semibold text-foreground/50 min-w-[44px] pt-2.5">
                  Step {i + 1}
                </span>
                <input
                  type="text"
                  className="flex-1 h-10 rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground"
                  defaultValue={step.step}
                  placeholder="Action step..."
                  onBlur={(e) => onActionStepChange(i, "step", e.target.value)}
                />
                <input
                  type="date"
                  className="w-40 h-10 rounded-sm border border-input bg-card px-3 py-2 text-sm font-mono text-foreground shrink-0"
                  defaultValue={step.targetDate}
                  onChange={(e) => onActionStepChange(i, "targetDate", e.target.value)}
                />
              </div>
            );
          })}
        </AccordionSection>
      )}

      {/* Section IV: Training / CEU needs */}
      <AccordionSection title="IV. Training / CEU needs">
        <div className="space-y-3">
          <div>
            <label className="text-[0.8125rem] font-medium text-foreground block mb-1">
              Do you need any training, continuing education/CEUs, or support?
            </label>
            <textarea
              className="flex w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground min-h-[60px] resize-y"
              defaultValue={merged.trainingNeeds ?? ""}
              placeholder="Training or CEU needs..."
              onBlur={(e) => onTextChange("trainingNeeds", e.target.value)}
            />
          </div>
          <div>
            <label className="text-[0.8125rem] font-medium text-foreground block mb-1">
              How will your team and the people we work with benefit from achieving this goal?
            </label>
            <textarea
              className="flex w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground min-h-[60px] resize-y"
              defaultValue={merged.teamBenefit ?? ""}
              placeholder="Expected team and guest benefits..."
              onBlur={(e) => onTextChange("teamBenefit", e.target.value)}
            />
          </div>
        </div>
      </AccordionSection>

      {/* Section V: Case review (individual only) */}
      {!isGroup && (
        <AccordionSection title="V. Case review / chart review findings">
          <div className="space-y-3">
            <div>
              <label className="text-[0.8125rem] font-medium text-foreground block mb-1">
                (a) Documentation, assessment, diagnosis, final disposition and risk assessment
              </label>
              <textarea
                className="flex w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground min-h-[80px] resize-y"
                defaultValue={merged.caseReviewFindings ?? ""}
                placeholder="Identify opportunity areas and/or strengths..."
                onBlur={(e) => onTextChange("caseReviewFindings", e.target.value)}
              />
            </div>
            <div>
              <label className="text-[0.8125rem] font-medium text-foreground block mb-1">
                (b) Medication review — verification of orders, drug interactions, treatment plan consistency
              </label>
              <textarea
                className="flex w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground min-h-[60px] resize-y"
                defaultValue={merged.medicationReview ?? ""}
                placeholder='Enter N/A if supervisee does not administer/dispense medication(s)...'
                onBlur={(e) => onTextChange("medicationReview", e.target.value)}
              />
            </div>
          </div>
        </AccordionSection>
      )}

      {/* Section VI: Additional context */}
      <AccordionSection title="VI. Additional context" defaultOpen>
        <p className="text-xs text-foreground/50 mb-2">
          Feedback, strength-based affirmations, additional guidance provided on emergency procedures.
          Required for Peer Support Specialist.
        </p>
        <textarea
          className="flex w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground min-h-[80px] resize-y"
          defaultValue={merged.additionalContext ?? ""}
          placeholder="Feedback, affirmations, or additional context..."
          onBlur={(e) => onTextChange("additionalContext", e.target.value)}
        />
      </AccordionSection>

      {/* Supervisee identity for PDF signature block */}
      <AccordionSection title="Supervisee identification (for PDF)">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[0.8125rem] font-medium text-foreground block mb-1">
              Job Title
            </label>
            <input
              type="text"
              className="flex h-10 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground"
              defaultValue={merged.superviseeJobTitle ?? ""}
              placeholder="e.g. Behavioral Health Technician"
              onBlur={(e) => onTextChange("superviseeJobTitle", e.target.value)}
            />
          </div>
          <div>
            <label className="text-[0.8125rem] font-medium text-foreground block mb-1">
              Credentials
            </label>
            <input
              type="text"
              className="flex h-10 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground"
              defaultValue={merged.superviseeCredentials ?? ""}
              placeholder="e.g. QMHP, PSS"
              onBlur={(e) => onTextChange("superviseeCredentials", e.target.value)}
            />
          </div>
        </div>
      </AccordionSection>
    </div>
  );
}
