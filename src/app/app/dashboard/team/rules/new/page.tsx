import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { auth } from "@/auth";
import { canManageOrg, getCurrentMembership } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listLatestRules } from "@/lib/rules/loader";
import { US_STATES } from "@/lib/us-states";
import { CustomRuleWizard } from "./custom-rule-wizard";

export const metadata = { title: "New custom rule — AuditHalo" };
export const dynamic = "force-dynamic";

export default async function NewCustomRulePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) redirect("/dashboard");
  if (!canManageOrg(membership.role)) redirect("/dashboard/team");

  // Build the set of (jurisdiction, license_code) pairs already covered by a
  // canonical rule. The wizard greys these out — the right path for them is
  // to customize the canonical via the override editor (cycle 3) instead of
  // duplicating it as a custom.
  const canonicalPairs = listLatestRules().map((r) => ({
    jurisdiction: r.jurisdiction,
    licenseCode: r.license_code,
    label: `${r.jurisdiction} ${r.license_code}`,
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-12 space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/dashboard/team/rules">
          <ArrowLeft />
          Back to rules
        </Link>
      </Button>

      <div>
        <Badge variant="outline" className="mb-3">
          Custom state rule
        </Badge>
        <h1 className="font-display text-3xl font-semibold text-foreground">
          Build a custom state rule
        </h1>
        <p className="mt-2 text-foreground/70 max-w-2xl">
          Author a rule for a jurisdiction AuditHalo hasn&apos;t shipped
          canonical YAML for yet. You supply the board citation; AuditHalo
          runs the same evaluator against it as it does for canonical rules.
        </p>
      </div>

      <div className="rounded-sm border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/5 p-4 flex gap-3">
        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-[color:var(--color-warning)]" />
        <div className="space-y-2 text-sm">
          <p className="font-medium text-foreground">
            A custom rule is self-attested, not board-verified.
          </p>
          <p className="text-foreground/70">
            If your values disagree with the actual board requirement,
            AuditHalo will not catch you. Custom rules will be flagged as
            &quot;Org-created &mdash; not board-verified&quot; on supervisee
            pages. Email{" "}
            <a
              href="mailto:info@audithalo.com"
              className="underline hover:no-underline"
            >
              info@audithalo.com
            </a>{" "}
            to fast-track a canonical YAML for your state.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <CustomRuleWizard
            jurisdictions={US_STATES.map((s) => ({
              code: s.code,
              name: s.name,
            }))}
            canonicalPairs={canonicalPairs}
          />
        </CardContent>
      </Card>
    </div>
  );
}
