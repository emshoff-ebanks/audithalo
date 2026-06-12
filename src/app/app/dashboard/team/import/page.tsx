import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { canManageOrg, getCurrentMembership } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImportForm } from "./_import-form";

export const metadata = { title: "Import team — AuditHalo" };

export default async function TeamImportPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) redirect("/dashboard");
  if (!canManageOrg(membership.role)) redirect("/dashboard/team");

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/dashboard/team">
          <ArrowLeft />
          Back to team
        </Link>
      </Button>

      <Badge variant="outline" className="mb-3">
        Bulk import
      </Badge>
      <h1 className="font-display text-3xl font-semibold text-foreground">
        Import team from CSV
      </h1>
      <p className="mt-3 text-foreground/70 max-w-2xl">
        Paste or upload a CSV — either a roster you maintain by hand or an
        export from an HRIS (Workday, BambooHR, Rippling, ADP, etc.). Validate
        the rows, then send invitations in one batch. Existing members and
        people with an open invitation are skipped automatically.
      </p>

      <div className="mt-4 p-3 rounded-sm border-l-[3px] border-secondary bg-secondary/5 text-xs text-foreground/80 leading-relaxed">
        <strong>Direct HRIS sync (Workday / BambooHR / Rippling / ADP)</strong> is
        on the Enterprise roadmap via Merge.dev. The CSV path covers most one-time
        imports today; the nightly-sync path lands in a follow-up release. Reach
        out to <a href="mailto:info@audithalo.com" className="text-secondary underline">info@audithalo.com</a>{" "}
        if your HRIS is the blocker for moving off CSV.
      </div>

      <div className="mt-8">
        <ImportForm />
      </div>
    </div>
  );
}
