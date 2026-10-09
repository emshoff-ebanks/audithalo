import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { canManageOrg, getCurrentMembership } from "@/lib/authz";
import { ImportForm } from "./_import-form";

export const metadata = { title: "Import team — AuditHalo" };

export default async function TeamImportPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) redirect("/dashboard");
  if (!canManageOrg(membership.role)) redirect("/dashboard/team");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dashboard/team"
          className="inline-flex items-center gap-1.5 text-sm text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to team
        </Link>
        <p className="shell-eyebrow">Bulk import</p>
        <h1 className="shell-page-title mt-1">Import team from CSV</h1>
        <p className="shell-page-sub max-w-2xl">
          Paste or upload a CSV — either a roster you maintain by hand or an
          export from an HRIS (Workday, BambooHR, Rippling, ADP, etc.). Validate
          the rows, then send invitations in one batch. Existing members and
          people with an open invitation are skipped automatically.
        </p>
      </div>

      <div className="panel panel-tight border-l-[3px] border-l-[color:var(--ink-400)] text-xs text-[color:var(--text-secondary)] leading-relaxed">
        <strong className="text-[color:var(--text-primary)]">Direct HRIS sync (Workday / BambooHR / Rippling / ADP)</strong> is
        on the Enterprise roadmap via Merge.dev. The CSV path covers most one-time
        imports today; the nightly-sync path lands in a follow-up release. Reach
        out to <a href="mailto:info@audithalo.com" className="text-[color:var(--text-primary)] underline">info@audithalo.com</a>{" "}
        if your HRIS is the blocker for moving off CSV.
      </div>

      <ImportForm />
    </div>
  );
}
