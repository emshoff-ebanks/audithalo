"use client";

import { useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  computeOnboardingSteps,
  type OnboardingInputs,
} from "@/lib/onboarding";
import { requestEmailVerificationAction } from "@/app/actions/account";

type Props = {
  emailVerifiedAt: Date | null;
  subscriptionStatus: string | null;
  roster: OnboardingInputs["roster"];
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
  emailVerifiedAt,
  subscriptionStatus,
  roster,
}: Props) {
  const [pending, startTransition] = useTransition();

  const { stepDone, allDone } = computeOnboardingSteps({
    emailVerifiedAt,
    subscriptionStatus,
    roster,
  });

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
