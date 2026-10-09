import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Link2, Unplug, XCircle } from "lucide-react";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getCurrentMembership, isHrAdmin } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { PaycorConnectForm } from "./paycor-connect-form";
import { PaycorConnectedCard } from "./paycor-connected-card";

export const metadata = { title: "Integrations — AuditHalo" };
export const dynamic = "force-dynamic";

export default async function IntegrationsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !isHrAdmin(membership.role)) {
    redirect("/dashboard");
  }

  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, membership.orgId),
  });

  const isConnected = !!org?.paycorConfig?.oauthAccessToken;

  const searchParams = await props.searchParams;
  const justConnected = searchParams.connected === "paycor";
  const errorCode = typeof searchParams.error === "string" ? searchParams.error : null;
  const errorDetail =
    typeof searchParams.error_detail === "string"
      ? searchParams.error_detail
      : null;

  return (
    <div className="mx-auto max-w-2xl flex flex-col gap-6">
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-1.5 text-sm text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to settings
      </Link>

      <div>
        <p className="shell-eyebrow">Integrations</p>
        <h1 className="shell-page-title mt-1">Integrations</h1>
        <p className="shell-page-sub">
          Connect external systems to automate roster sync and document
          delivery.
        </p>
      </div>

      {justConnected && (
        <div className="panel panel-tight border-l-[3px] border-l-[color:var(--ok-700)] flex items-start gap-2 text-sm text-[color:var(--text-primary)]">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[color:var(--ok-700)]" strokeWidth={2} />
          <span>Paycor connected successfully. You can now sync your roster.</span>
        </div>
      )}

      {errorCode && (
        <div className="panel panel-tight border-l-[3px] border-l-[color:var(--risk-600)] flex items-start gap-2 text-sm text-[color:var(--text-primary)]">
          <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-[color:var(--risk-600)]" strokeWidth={2} />
          <div>
            <span>Paycor connection failed ({errorCode}).</span>
            {errorDetail && (
              <span className="block mt-0.5 text-xs text-[color:var(--text-muted)]">
                {errorDetail}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="flex items-start gap-3">
          {isConnected ? (
            <Link2 className="h-5 w-5 shrink-0 mt-0.5 text-[color:var(--ok-700)]" strokeWidth={2} />
          ) : (
            <Unplug className="h-5 w-5 shrink-0 mt-0.5 text-[color:var(--text-muted)]" strokeWidth={2} />
          )}
          <div className="w-full">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-display text-lg font-semibold text-[color:var(--text-primary)]">
                Paycor
              </h2>
              <span className={`status-pill ${isConnected ? "status-ok" : "status-pending"}`}>
                {isConnected ? "Connected" : "Not connected"}
              </span>
            </div>
            <p className="text-sm text-[color:var(--text-secondary)] mb-4">
              Sync your employee roster and deliver sealed supervision forms
              to Paycor automatically.
            </p>

            {isConnected && org?.paycorConfig ? (
              <PaycorConnectedCard config={org.paycorConfig} />
            ) : (
              <PaycorConnectForm />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
