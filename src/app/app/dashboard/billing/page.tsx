import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowRight, Check } from "lucide-react";
import { auth } from "@/auth";
import { getCurrentMembership, isManagerRole } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { Button } from "@/components/ui/button";
import {
  CheckoutButton,
  PortalButton,
  PracticeCheckoutButton,
} from "./billing-buttons";
import { UpgradeToPracticeForm } from "./_upgrade-to-practice-form";

export const metadata = {
  title: "Billing — AuditHalo",
};

const PLAN_FEATURES: Record<string, string[]> = {
  solo: [
    "Up to 3 supervisees",
    "Every supported state, versioned to its board",
    "Supervisor dashboard",
    "E-signature with intent confirmation",
    "Audit-ready evidence package PDF",
    "AI session notes (10 transcripts/mo)",
  ],
  practice: [
    "Everything in Solo Supervisor",
    "Unlimited supervisees",
    "Practice compliance heatmap",
    "Bulk HRIS import (CSV)",
    "AI session notes (100/mo per org)",
    "Audit log retention (7 years)",
    "Priority email support",
  ],
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) redirect("/dashboard");
  if (!isManagerRole(membership.role)) redirect("/dashboard");

  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, membership.orgId),
  });
  if (!org) redirect("/dashboard");

  const params = await searchParams;
  const subStatus = org.subscriptionStatus;
  const isEnterprise = org.subscriptionTier === "enterprise";
  // Enterprise is contract-managed (no Stripe), so it's always "active" for
  // billing-UI purposes regardless of subscription_status.
  const hasActive =
    isEnterprise ||
    subStatus === "active" ||
    subStatus === "trialing" ||
    subStatus === "past_due";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="shell-eyebrow">Billing</p>
        <h1 className="shell-page-title mt-1">{org.name}</h1>
      </div>

      {params.status === "success" && (
        <div className="panel panel-tight border-l-[3px] border-l-[color:var(--ok-700)] text-sm text-[color:var(--text-secondary)]">
          Subscription started. It can take a moment for the status below to
          update — refresh the page if it still says &ldquo;no active plan&rdquo;.
        </div>
      )}
      {params.status === "canceled" && (
        <div className="panel panel-tight text-sm text-[color:var(--text-secondary)]">
          Checkout canceled. You can try again any time.
        </div>
      )}

      {/* Current subscription summary */}
      {hasActive && (
        <div className="panel">
          <p className="label-overline mb-2">Current plan</p>
          <div className="flex items-center gap-3">
            <h2 className="font-display text-2xl font-semibold text-[color:var(--text-primary)] capitalize">
              {org.subscriptionTier ?? "—"}
            </h2>
            {isEnterprise ? (
              <span className="status-pill status-sealed">contract</span>
            ) : (
              <span className={`status-pill ${subStatus === "trialing" ? "status-warn" : "status-ok"}`}>
                {subStatus}
              </span>
            )}
          </div>
          {org.subscriptionPeriodEnd && !isEnterprise && (
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
              Next renewal:{" "}
              <span className="font-mono">
                {org.subscriptionPeriodEnd.toISOString().slice(0, 10)}
              </span>
            </p>
          )}
          {org.subscriptionTier === "practice" && org.seatCount !== null && (
            <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
              Seats purchased: <span className="font-mono">{org.seatCount}</span>
            </p>
          )}
          {isEnterprise ? (
            <p className="mt-3 text-sm text-[color:var(--text-secondary)]">
              Enterprise plans are managed by contract. Reach out to{" "}
              <a
                href="mailto:info@audithalo.com"
                className="text-[color:var(--text-primary)] underline"
              >
                info@audithalo.com
              </a>{" "}
              for invoice questions, seat additions, or renewal terms.
            </p>
          ) : (
            <div className="mt-5">
              <PortalButton />
            </div>
          )}
        </div>
      )}

      {/* Solo customers see an in-app upgrade path to Practice. Enterprise
          upgrades stay sales-mediated via /admin/orgs (per spec). */}
      {hasActive && org.subscriptionTier === "solo" && (
        <UpgradeToPracticeForm currentSeatCount={org.seatCount} />
      )}

      {!hasActive && (
        <div className="panel">
          <p className="label-overline mb-2">Current plan</p>
          <p className="text-[color:var(--text-secondary)]">
            No active plan. You&apos;re in a free read-only state — pick a plan
            below to start your 14-day trial.
          </p>
        </div>
      )}

      {/* Pricing tiers */}
      {!hasActive && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* Solo Supervisor — featured (halo-yellow ring = the recommended action) */}
          <div className="panel panel-loose ring-2 ring-[color:var(--halo-yellow)] ring-inset">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-display text-xl font-semibold text-[color:var(--text-primary)]">
                Solo Supervisor
              </h3>
              <span className="status-pill" style={{ background: "var(--halo-yellow)", color: "var(--ink-900)" }}>
                Most popular
              </span>
            </div>
            <p className="mt-2 text-sm text-[color:var(--text-muted)] min-h-10">
              For a supervisor with up to 3 supervisees.
            </p>
            <div className="mt-6 space-y-2">
              <div>
                <span className="font-display text-4xl font-bold text-foreground">
                  $89
                </span>
                <span className="ml-2 text-sm text-foreground/60">per month</span>
              </div>
              <div className="text-sm text-foreground/60">
                or <span className="font-medium">$890/year</span> (2 months free)
              </div>
            </div>
            <div className="mt-6 space-y-2">
              <CheckoutButton plan="solo_monthly" label="Start 14-day trial — monthly" />
              <CheckoutButton plan="solo_yearly" label="Start 14-day trial — yearly" variant="outline" />
            </div>
            <ul className="mt-8 space-y-3 text-sm">
              {PLAN_FEATURES.solo.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="h-4 w-4 mt-0.5 shrink-0 text-[color:var(--color-success)]" strokeWidth={2.5} />
                  <span className="text-foreground">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Practice */}
          <div className="panel panel-loose">
            <h3 className="font-display text-xl font-semibold text-foreground">
              Practice
            </h3>
            <p className="mt-2 text-sm text-foreground/60 min-h-10">
              For 4–20 supervisees with HR oversight. Buy seats up-front; add
              more in billing.
            </p>
            <div className="mt-6 space-y-2">
              <div>
                <span className="font-display text-4xl font-bold text-foreground">
                  $25
                </span>
                <span className="ml-2 text-sm text-foreground/60">per supervisee per month</span>
              </div>
              <div className="text-sm text-foreground/60">
                + <span className="font-medium">$49/month base</span>
              </div>
            </div>
            <div className="mt-6">
              <PracticeCheckoutButton label="Start 14-day trial" />
            </div>
            <ul className="mt-8 space-y-3 text-sm">
              {PLAN_FEATURES.practice.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="h-4 w-4 mt-0.5 shrink-0 text-[color:var(--color-success)]" strokeWidth={2.5} />
                  <span className="text-foreground">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Enterprise */}
          <div className="panel panel-loose">
            <h3 className="font-display text-xl font-semibold text-foreground">
              Enterprise
            </h3>
            <p className="mt-2 text-sm text-foreground/60 min-h-10">
              For 20+ supervisees, multi-location, SOC 2 + BAA required.
            </p>
            <div className="mt-6">
              <span className="font-display text-4xl font-bold text-foreground">
                Custom
              </span>
            </div>
            <div className="mt-6">
              <Button asChild variant="outline" className="w-full">
                <a href="mailto:info@audithalo.com?subject=Enterprise plan">
                  Talk to sales <ArrowRight />
                </a>
              </Button>
            </div>
            <ul className="mt-8 space-y-3 text-sm">
              {["Everything in Practice", "SOC 2 report", "Signed BAA", "Dedicated CSM", "API + Teams Enterprise"].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="h-4 w-4 mt-0.5 shrink-0 text-[color:var(--color-success)]" strokeWidth={2.5} />
                  <span className="text-foreground">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
