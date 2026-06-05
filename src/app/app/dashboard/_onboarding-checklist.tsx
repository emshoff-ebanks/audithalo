"use client";

import { useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requestEmailVerificationAction } from "@/app/actions/account";

/**
 * Props are intentionally plain primitives — booleans the parent computed
 * server-side. The earlier shape passed Date objects and the full RosterRow[]
 * (with Gap unions and inner Date columns) across the server/client boundary,
 * which inflated the RSC payload and risked subtle serialization edge cases
 * during streaming on certain mobile browsers.
 */
type Props = {
  emailDone: boolean;
  trialDone: boolean;
  rosterDone: boolean;
  rulesDone: boolean;
};

type LinkStep = {
  label: string;
  subcopy: string;
  ctaLabel: string;
  ctaHref: string;
};

type ActionStep = {
  label: string;
  subcopy: string;
  ctaLabel: string;
  onAction: "resend-verification";
};

type StepDef = LinkStep | ActionStep;

const STEPS: [StepDef, StepDef, StepDef, StepDef] = [
  {
    label: "Verify your email",
    subcopy:
      "Confirm we can reach you about supervision-flow events, invitations, and audit notices.",
    ctaLabel: "Resend verification",
    onAction: "resend-verification",
  },
  {
    label: "Start your 14-day trial",
    subcopy:
      "Unlock seats so you can invite supervisees. No charge for 14 days.",
    ctaLabel: "Go to billing",
    ctaHref: "/dashboard/billing",
  },
  {
    label: "Invite your first supervisee",
    subcopy:
      "Send an invite from your roster. They sign in and start logging hours.",
    ctaLabel: "Open roster",
    ctaHref: "/dashboard/roster",
  },
  {
    label: "Assign their state rule",
    subcopy:
      "Pick the supervisee, choose their state + license, and AuditHalo tracks compliance automatically.",
    ctaLabel: "Pick a supervisee",
    ctaHref: "/dashboard/roster",
  },
];

export function OnboardingChecklist({
  emailDone,
  trialDone,
  rosterDone,
  rulesDone,
}: Props) {
  const [pending, startTransition] = useTransition();

  const stepDone: [boolean, boolean, boolean, boolean] = [
    emailDone,
    trialDone,
    rosterDone,
    rulesDone,
  ];
  const allDone = stepDone.every(Boolean);

  if (allDone) return null;

  const doneCount = stepDone.filter(Boolean).length;

  function handleResendVerification() {
    startTransition(async () => {
      await requestEmailVerificationAction();
    });
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Getting started — {doneCount} of 4 complete
          </h2>
        </div>
        <ul className="space-y-4">
          {STEPS.map((step, i) => {
            const done = stepDone[i];
            const Icon = done ? CheckCircle2 : Circle;
            const iconColor = done
              ? "text-[color:var(--color-success)]"
              : "text-foreground/30";

            return (
              <li
                key={step.label}
                className="flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <Icon
                    className={`h-5 w-5 mt-0.5 shrink-0 ${iconColor}`}
                    strokeWidth={1.75}
                  />
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        done ? "text-foreground/60 line-through" : "text-foreground"
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className="mt-0.5 text-xs text-foreground/60">
                      {step.subcopy}
                    </p>
                  </div>
                </div>
                {!done && (
                  "ctaHref" in step ? (
                    <Button asChild size="sm" className="shrink-0">
                      <Link href={step.ctaHref}>
                        {step.ctaLabel}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="shrink-0"
                      onClick={handleResendVerification}
                      disabled={pending}
                    >
                      {pending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        step.ctaLabel
                      )}
                    </Button>
                  )
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
