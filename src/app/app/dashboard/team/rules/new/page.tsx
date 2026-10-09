import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { auth } from "@/auth";
import { canManageOrg, getCurrentMembership } from "@/lib/authz";
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
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dashboard/team/rules"
          className="inline-flex items-center gap-1.5 text-sm text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to rules
        </Link>
        <p className="shell-eyebrow">Custom state rule</p>
        <h1 className="shell-page-title mt-1">Build a custom state rule</h1>
        <p className="shell-page-sub max-w-2xl">
          Author a rule for a jurisdiction AuditHalo hasn&apos;t shipped
          canonical YAML for yet. You supply the board citation; AuditHalo
          runs the same evaluator against it as it does for canonical rules.
        </p>
      </div>

      <div className="panel panel-tight border-l-[3px] border-l-[color:var(--warn-500)] flex gap-3">
        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-[color:var(--warn-500)]" />
        <div className="space-y-2 text-sm">
          <p className="font-medium text-[color:var(--text-primary)]">
            A custom rule is self-attested, not board-verified.
          </p>
          <p className="text-[color:var(--text-secondary)]">
            If your values disagree with the actual board requirement,
            AuditHalo will not catch you. Custom rules will be flagged as
            &quot;Org-created &mdash; not board-verified&quot; on supervisee
            pages. Email{" "}
            <a href="mailto:info@audithalo.com" className="underline hover:no-underline">
              info@audithalo.com
            </a>{" "}
            to fast-track a canonical YAML for your state.
          </p>
        </div>
      </div>

      <div className="panel">
        <CustomRuleWizard
          jurisdictions={US_STATES.map((s) => ({ code: s.code, name: s.name }))}
          canonicalPairs={canonicalPairs}
        />
      </div>
    </div>
  );
}
