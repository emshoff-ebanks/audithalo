import { redirect } from "next/navigation";
import Link from "next/link";
import { Link2, ArrowRight } from "lucide-react";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getCurrentMembership, isHrAdmin } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { RetentionSettingForm } from "./_retention-form";

export const metadata = { title: "Org settings — AuditHalo" };
export const dynamic = "force-dynamic";

/**
 * HR Admin-only org settings page. v1 surfaces just the audit-log retention
 * preference; SSO config, branding, and the "allow supervisors to invite"
 * toggle land here in follow-up commits.
 */
export default async function OrgSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !isHrAdmin(membership.role)) {
    redirect("/dashboard");
  }

  const [org, settings] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(schema.organizations.id, membership.orgId),
    }),
    db.query.orgSettings.findFirst({
      where: eq(schema.orgSettings.orgId, membership.orgId),
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl flex flex-col gap-6">
      <div>
        <p className="shell-eyebrow">Org settings</p>
        <h1 className="shell-page-title mt-1">{org?.name ?? "Practice"}</h1>
        <p className="shell-page-sub">
          Org-wide preferences. Changes apply to every team member.
        </p>
      </div>

      <Link
        href="/dashboard/settings/integrations"
        className="panel flex items-center justify-between group hover:border-[color:var(--border-strong)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <Link2 className="h-5 w-5 shrink-0 text-[color:var(--text-muted)]" strokeWidth={2} />
          <div>
            <p className="font-medium text-[color:var(--text-primary)] group-hover:underline">
              Integrations
            </p>
            <p className="text-sm text-[color:var(--text-secondary)]">
              Connect Paycor for roster sync and document delivery.
            </p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-[color:var(--text-muted)]" />
      </Link>

      <div className="panel">
        <p className="label-overline mb-1">Audit log retention</p>
        <p className="text-sm text-[color:var(--text-secondary)] mb-4">
          How long audit log entries are kept before purging.
          Recommended: 7 years. Maximum: 20 years.
        </p>
        <RetentionSettingForm currentValue={settings?.auditLogRetentionYears ?? 7} />
      </div>
    </div>
  );
}
