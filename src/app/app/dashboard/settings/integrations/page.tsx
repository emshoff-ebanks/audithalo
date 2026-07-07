import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Link2, Unplug } from "lucide-react";
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

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !isHrAdmin(membership.role)) {
    redirect("/dashboard");
  }

  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, membership.orgId),
  });

  const isConnected = !!org?.paycorConfig;

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
