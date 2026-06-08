import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getCurrentMembership, isHrAdmin } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="mx-auto max-w-2xl px-6 py-8 sm:py-12 space-y-6">
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-3">
        <Link href="/dashboard">
          <ArrowLeft />
          Back to dashboard
        </Link>
      </Button>

      <div>
        <Badge variant="outline" className="mb-3">
          Org settings
        </Badge>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-foreground">
          {org?.name ?? "Practice"}
        </h1>
        <p className="mt-3 text-foreground/70">
          Org-wide preferences. Changes apply to every team member.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <p className="label-overline mb-1">Audit log retention</p>
          <p className="text-sm text-foreground/60 mb-4">
            How many years of audit log entries we keep before purging.
            The pricing page promises 7 years for Enterprise; you can extend
            up to 20 if your compliance posture requires it.
          </p>
          <RetentionSettingForm
            currentValue={settings?.auditLogRetentionYears ?? 7}
          />
        </CardContent>
      </Card>
    </div>
  );
}
