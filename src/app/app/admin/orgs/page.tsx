import { sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PromoteToEnterpriseForm } from "./_promote-form";
import { ProvisionEnterpriseForm } from "./_provision-form";

export const metadata = { title: "Orgs — Admin" };
export const dynamic = "force-dynamic";

/**
 * Admin-only page for org-level operations. The admin gate fires at
 * /admin/layout.tsx via requireAdmin(). Right now the only operation
 * surfaced is "Promote to Enterprise" which also flips the org owner's
 * role to HR Admin — a manual step Damon runs after signing an
 * Enterprise contract (since Enterprise isn't a self-serve Stripe path).
 */
export default async function OrgsPage() {
  const rows = await db
    .select({
      id: schema.organizations.id,
      name: schema.organizations.name,
      tier: schema.organizations.subscriptionTier,
      status: schema.organizations.subscriptionStatus,
      createdAt: schema.organizations.createdAt,
      ownerEmail: sql<string>`(
        SELECT email FROM users WHERE id = ${schema.organizations.createdById}
      )`,
      ownerRole: sql<string>`(
        SELECT role::text FROM org_memberships
        WHERE org_id = ${schema.organizations.id}
          AND user_id = ${schema.organizations.createdById}
        LIMIT 1
      )`,
      supervisorCount: sql<number>`(
        SELECT COUNT(*)::int FROM org_memberships
        WHERE org_id = ${schema.organizations.id}
          AND role IN ('supervisor', 'hr_admin')
      )`,
      superviseeCount: sql<number>`(
        SELECT COUNT(*)::int FROM org_memberships
        WHERE org_id = ${schema.organizations.id}
          AND role = 'supervisee'
      )`,
    })
    .from(schema.organizations)
    .orderBy(schema.organizations.createdAt);

  const enterpriseCount = rows.filter((r) => r.tier === "enterprise").length;
  const practiceCount = rows.filter((r) => r.tier === "practice").length;
  const soloCount = rows.filter((r) => r.tier === "solo").length;

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-foreground">
        Organizations
      </h1>
      <p className="mt-3 text-foreground/70 max-w-3xl">
        Promote a Practice org to Enterprise. Promoting auto-converts the
        org owner&apos;s account to HR Admin (per the locked Enterprise
        upgrade flow). Other roles in the org are untouched.
      </p>

      <div className="mt-6">
        <ProvisionEnterpriseForm />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Badge variant="outline">{rows.length} orgs total</Badge>
        <Badge
          variant="outline"
          className="border-[color:var(--color-gold)] bg-[color:var(--color-gold)]/10 text-[color:var(--color-gold)]"
        >
          {enterpriseCount} Enterprise
        </Badge>
        <Badge variant="outline">{practiceCount} Practice</Badge>
        <Badge variant="outline">{soloCount} Solo</Badge>
      </div>

      <Card className="mt-8">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-accent text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Org</th>
                <th className="px-4 py-3 font-semibold">Owner</th>
                <th className="px-4 py-3 font-semibold">Tier · Status</th>
                <th className="px-4 py-3 font-semibold">Members</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-foreground/60 font-mono">
                      {r.id.slice(0, 8)}…
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-foreground/70 font-mono text-xs">
                      {r.ownerEmail ?? "—"}
                    </p>
                    {r.ownerRole && (
                      <Badge variant="outline" className="mt-1 text-[10px]">
                        owner: {r.ownerRole}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={
                        r.tier === "enterprise"
                          ? "border-[color:var(--color-gold)] bg-[color:var(--color-gold)]/10 text-[color:var(--color-gold)]"
                          : ""
                      }
                    >
                      {r.tier ?? "—"}
                    </Badge>
                    {r.status && (
                      <span className="ml-2 text-xs text-foreground/60">
                        {r.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground/70 text-xs">
                    {r.supervisorCount} sup / {r.superviseeCount} sve
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.tier !== "enterprise" ? (
                      <PromoteToEnterpriseForm
                        orgId={r.id}
                        orgName={r.name}
                        ownerEmail={r.ownerEmail ?? ""}
                      />
                    ) : (
                      <span className="text-xs text-foreground/40">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
