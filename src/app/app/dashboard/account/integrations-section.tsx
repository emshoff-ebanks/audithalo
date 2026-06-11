import { and, eq, isNull } from "drizzle-orm";
import { Calendar, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db, schema } from "@/lib/db";
import { IntegrationDisconnectButton } from "./_integration-disconnect-button";
import { IntegrationPreferredButton } from "./_integration-preferred-button";

type ConnectedRow = {
  provider: "microsoft" | "google";
  accountEmail: string | null;
  connectedAt: Date;
  isPreferred: boolean;
};

const PROVIDER_META: Record<
  "microsoft" | "google",
  { label: string; subLabel: string; startUrl: string }
> = {
  microsoft: {
    label: "Microsoft (Teams + Outlook)",
    subLabel: "Schedule Teams meetings and write to Outlook Calendar.",
    startUrl: "/api/auth/microsoft/start",
  },
  google: {
    label: "Google (Meet + Calendar)",
    subLabel: "Schedule Google Meet meetings and write to Google Calendar.",
    startUrl: "/api/auth/google/start",
  },
};

export async function IntegrationsSection({ userId }: { userId: string }) {
  const rows = await db
    .select({
      provider: schema.userCalendarIntegrations.provider,
      accountEmail: schema.userCalendarIntegrations.accountEmail,
      connectedAt: schema.userCalendarIntegrations.connectedAt,
      isPreferred: schema.userCalendarIntegrations.isPreferred,
    })
    .from(schema.userCalendarIntegrations)
    .where(
      and(
        eq(schema.userCalendarIntegrations.userId, userId),
        isNull(schema.userCalendarIntegrations.disconnectedAt)
      )
    );

  const byProvider = new Map<"microsoft" | "google", ConnectedRow>();
  for (const r of rows) {
    if (r.provider === "microsoft" || r.provider === "google") {
      byProvider.set(r.provider, r as ConnectedRow);
    }
  }

  const connectedCount = byProvider.size;

  return (
    <Card id="integrations">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>Calendar integrations</span>
          {connectedCount > 0 ? (
            <Badge variant="success">
              {connectedCount === 2 ? "Both connected" : "Connected"}
            </Badge>
          ) : (
            <Badge variant="outline">None</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-foreground/70">
          Connect a calendar to schedule supervision from inside AuditHalo —
          we&apos;ll create the meeting link, write the event to both
          parties&apos; calendars, and send reminders. We never store
          plaintext tokens.
        </p>
        <div className="divide-y divide-border rounded-md border border-border">
          {(["microsoft", "google"] as const).map((provider) => {
            const meta = PROVIDER_META[provider];
            const row = byProvider.get(provider);
            return (
              <div
                key={provider}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <Calendar
                    className="mt-0.5 h-5 w-5 text-foreground/60"
                    aria-hidden="true"
                  />
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                      {meta.label}
                      {row?.isPreferred && (
                        <Badge variant="success" className="gap-1">
                          <Check className="h-3 w-3" />
                          Preferred
                        </Badge>
                      )}
                    </div>
                    {row ? (
                      <p className="text-xs text-foreground/60">
                        Connected as{" "}
                        <span className="font-mono text-foreground/80">
                          {row.accountEmail ?? "(account email unavailable)"}
                        </span>{" "}
                        on{" "}
                        {row.connectedAt.toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    ) : (
                      <p className="text-xs text-foreground/60">
                        {meta.subLabel}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                  {row ? (
                    <>
                      {!row.isPreferred && connectedCount > 1 && (
                        <IntegrationPreferredButton provider={provider} />
                      )}
                      <IntegrationDisconnectButton provider={provider} />
                    </>
                  ) : (
                    <a
                      href={meta.startUrl}
                      className="inline-flex items-center justify-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                    >
                      Connect
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
