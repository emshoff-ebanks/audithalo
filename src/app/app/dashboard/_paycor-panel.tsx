import { eq, and, desc } from "drizzle-orm";
import { Link2, Unplug, CheckCircle2, AlertTriangle, Clock, Upload } from "lucide-react";
import { db, schema } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PaycorConfig } from "@/lib/db/schema";

type Props = {
  orgId: string;
  paycorConfig: PaycorConfig | null;
};

export async function PaycorPanel({ orgId, paycorConfig }: Props) {
  if (!paycorConfig) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Unplug
              className="h-5 w-5 shrink-0 mt-0.5 text-foreground/40"
              strokeWidth={1.75}
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg font-semibold text-foreground">
                  Paycor Integration
                </h3>
                <Badge variant="outline" className="text-xs">
                  Not connected
                </Badge>
              </div>
              <p className="mt-1.5 text-sm text-foreground/60 leading-relaxed max-w-lg">
                Connect your Paycor account to sync your roster and deliver
                supervision forms automatically. Contact your account team to
                get started.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const deliveries = await db.query.paycorDeliveryQueue.findMany({
    where: eq(schema.paycorDeliveryQueue.orgId, orgId),
    orderBy: desc(schema.paycorDeliveryQueue.createdAt),
    limit: 10,
  });

  const pendingCount = deliveries.filter((d) => d.status === "pending").length;
  const deliveredCount = deliveries.filter(
    (d) => d.status === "delivered",
  ).length;
  const failedCount = deliveries.filter((d) => d.status === "failed").length;

  const lastDelivered = deliveries.find((d) => d.status === "delivered");

  const memberCount = await db
    .select({ count: schema.orgMemberships.id })
    .from(schema.orgMemberships)
    .where(
      and(
        eq(schema.orgMemberships.orgId, orgId),
        eq(schema.orgMemberships.role, "supervisee"),
      ),
    )
    .then((rows) => rows.length);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-3">
          <Link2
            className="h-5 w-5 shrink-0 mt-0.5 text-[color:var(--color-success)]"
            strokeWidth={1.75}
          />
          <div className="w-full">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg font-semibold text-foreground">
                Paycor Integration
              </h3>
              <Badge
                variant="outline"
                className="text-xs border-[color:var(--color-success)] text-[color:var(--color-success)]"
              >
                Connected
              </Badge>
            </div>
            <p className="mt-1 text-sm text-foreground/60">
              Legal entity: {paycorConfig.legalEntityId}
            </p>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                icon={
                  <CheckCircle2
                    className="h-4 w-4 text-[color:var(--color-success)]"
                    strokeWidth={1.75}
                  />
                }
                value={memberCount}
                label="Synced employees"
              />
              <StatCard
                icon={
                  <Upload
                    className="h-4 w-4 text-[color:var(--color-success)]"
                    strokeWidth={1.75}
                  />
                }
                value={deliveredCount}
                label="Delivered"
              />
              <StatCard
                icon={
                  <Clock
                    className="h-4 w-4 text-foreground/40"
                    strokeWidth={1.75}
                  />
                }
                value={pendingCount}
                label="Pending"
              />
              {failedCount > 0 ? (
                <StatCard
                  icon={
                    <AlertTriangle
                      className="h-4 w-4 text-[color:var(--color-warning)]"
                      strokeWidth={1.75}
                    />
                  }
                  value={failedCount}
                  label="Failed"
                  warn
                />
              ) : (
                <StatCard
                  icon={
                    <CheckCircle2
                      className="h-4 w-4 text-foreground/40"
                      strokeWidth={1.75}
                    />
                  }
                  value={0}
                  label="Failed"
                />
              )}
            </div>

            {lastDelivered?.deliveredAt && (
              <p className="mt-3 text-xs text-foreground/40">
                Last delivery:{" "}
                {lastDelivered.deliveredAt.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({
  icon,
  value,
  label,
  warn,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-sm border border-border p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs text-foreground/60">{label}</span>
      </div>
      <p
        className={`font-display text-xl font-bold ${
          warn ? "text-[color:var(--color-warning)]" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
