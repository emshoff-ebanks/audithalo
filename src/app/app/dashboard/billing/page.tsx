import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { auth } from "@/auth";
import { getCurrentMembership, isManagerRole } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    "All 5 supported states (NC, CA, TX, FL, NY)",
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
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/dashboard">
          <ArrowLeft />
          Back to dashboard
        </Link>
      </Button>

      <Badge variant="outline" className="mb-3">
        Billing
      </Badge>
      <h1 className="font-display text-4xl font-semibold text-foreground">
        {org.name}
      </h1>

      {params.status === "success" && (
        <div className="mt-6 p-4 rounded-sm border border-[color:var(--color-success)]/20 bg-[color:var(--color-success)]/5 text-sm text-foreground/80">
          Subscription started. It can take a moment for the status below to
          update — refresh the page if it still says "no active plan".
        </div>
      )}
      {params.status === "canceled" && (
        <div className="mt-6 p-4 rounded-sm border border-border bg-muted/40 text-sm text-foreground/80">
          Checkout canceled. You can try again any time.
        </div>
      )}

      {/* Current subscription summary */}
      <Card className="mt-8">
        <CardContent className="p-6">
          <p className="label-overline mb-2">Current plan</p>
          {hasActive ? (
            <>
              <div className="flex items-center gap-3">
                <h2 className="font-display text-2xl font-semibold text-foreground capitalize">
                  {org.subscriptionTier ?? "—"}
                </h2>
                {isEnterprise ? (
                  <Badge variant="success">contract</Badge>
                ) : (
                  <Badge
                    variant={subStatus === "trialing" ? "warning" : "success"}
                  >
                    {subStatus}
                  </Badge>
                )}
              </div>
              {org.subscriptionPeriodEnd && !isEnterprise && (
                <p className="mt-2 text-sm text-foreground/70">
                  Next renewal:{" "}
                  <span className="font-mono">
                    {org.subscriptionPeriodEnd.toISOString().slice(0, 10)}
                  </span>
                </p>
              )}
              {org.subscriptionTier === "practice" && org.seatCount !== null && (
                <p className="mt-1 text-sm text-foreground/70">
                  Seats purchased:{" "}
                  <span className="font-mono">{org.seatCount}</span>
                </p>
              )}
              {isEnterprise ? (
                <p className="mt-3 text-sm text-foreground/70">
                  Enterprise plans are managed by contract. Reach out to{" "}
                  <a
                    href="mailto:info@audithalo.com"
                    className="text-secondary hover:underline"
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
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Solo customers see an in-app upgrade path to Practice. Enterprise
          upgrades stay sales-mediated via /admin/orgs (per spec). */}
      {hasActive && org.subscriptionTier === "solo" && (
        <UpgradeToPracticeForm currentSeatCount={org.seatCount} />
      )}

      {!hasActive && (
        <Card className="mt-8">
          <CardContent className="p-6">
            <p className="label-overline mb-2">Current plan</p>
            <p className="text-foreground/70">
              No active plan. You're in a free read-only state — pick a plan
              below to start your 14-day trial.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pricing tiers */}
      {!hasActive && (
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-px bg-border">
          {/* Solo Supervisor */}
          <div className="bg-card p-8 ring-2 ring-secondary ring-inset">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-xl font-semibold text-foreground">
                Solo Supervisor
              </h3>
              <Badge variant="secondary">Most popular</Badge>
            </div>
            <p className="mt-2 text-sm text-foreground/60 min-h-10">
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
          <div className="bg-card p-8">
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
          <div className="bg-card p-8">
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
