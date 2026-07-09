import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Link2, Unplug, XCircle } from "lucide-react";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getCurrentMembership, isHrAdmin } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="mx-auto max-w-2xl px-6 py-8 sm:py-12 space-y-6">
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-3">
        <Link href="/dashboard/settings">
          <ArrowLeft />
          Back to settings
        </Link>
      </Button>

      <div>
        <Badge variant="outline" className="mb-3">
          Integrations
        </Badge>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-foreground">
          Integrations
        </h1>
        <p className="mt-3 text-foreground/70">
          Connect external systems to automate roster sync and document
          delivery.
        </p>
      </div>

      {justConnected && (
        <div className="flex items-start gap-2 rounded-sm border border-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/5 px-4 py-3 text-sm text-[color:var(--color-success)]">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={1.75} />
          <span>Paycor connected successfully. You can now sync your roster.</span>
        </div>
      )}

      {errorCode && (
        <div className="flex items-start gap-2 rounded-sm border border-[color:var(--color-risk)]/30 bg-[color:var(--color-risk)]/5 px-4 py-3 text-sm text-[color:var(--color-risk)]">
          <XCircle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={1.75} />
          <div>
            <span>Paycor connection failed ({errorCode}).</span>
            {errorDetail && (
              <span className="block mt-0.5 text-xs opacity-80">
                {errorDetail}
              </span>
            )}
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            {isConnected ? (
              <Link2
                className="h-5 w-5 shrink-0 mt-0.5 text-[color:var(--color-success)]"
                strokeWidth={1.75}
              />
            ) : (
              <Unplug
                className="h-5 w-5 shrink-0 mt-0.5 text-foreground/40"
                strokeWidth={1.75}
              />
            )}
            <div className="w-full">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-display text-lg font-semibold text-foreground">
                  Paycor
                </h2>
                <Badge
                  variant="outline"
                  className={
                    isConnected
                      ? "text-xs border-[color:var(--color-success)] text-[color:var(--color-success)]"
                      : "text-xs"
                  }
                >
                  {isConnected ? "Connected" : "Not connected"}
                </Badge>
              </div>
              <p className="text-sm text-foreground/60 mb-4">
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
        </CardContent>
      </Card>
    </div>
  );
}
