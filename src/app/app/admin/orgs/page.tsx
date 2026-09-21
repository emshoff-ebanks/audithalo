import { sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="shell-page-title">Organizations</h1>
        <p className="shell-page-sub max-w-3xl">
          Promote a Practice org to Enterprise. Promoting auto-converts the
          org owner&apos;s account to HR Admin (per the locked Enterprise
          upgrade flow). Other roles in the org are untouched.
        </p>
      </div>

      <ProvisionEnterpriseForm />

      <div className="flex flex-wrap gap-2">
        <span className="status-pill status-pending">{rows.length} orgs total</span>
        <span className="status-pill status-sealed">{enterpriseCount} Enterprise</span>
        <span className="status-pill status-pending">{practiceCount} Practice</span>
        <span className="status-pill status-pending">{soloCount} Solo</span>
      </div>

      <div className="panel panel-flush overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-[color:var(--border)] bg-[color:var(--surface-muted)]">
              <th className="px-4 py-3 label-overline">Org</th>
              <th className="px-4 py-3 label-overline">Owner</th>
              <th className="px-4 py-3 label-overline">Tier · Status</th>
              <th className="px-4 py-3 label-overline">Members</th>
              <th className="px-4 py-3 label-overline"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[color:var(--divider)]">
                <td className="px-4 py-3">
                  <p className="font-medium text-[color:var(--text-primary)]">{r.name}</p>
                  <p className="text-xs text-[color:var(--text-muted)] font-mono">
                    {r.id.slice(0, 8)}…
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-[color:var(--text-secondary)] font-mono text-xs">
                    {r.ownerEmail ?? "—"}
                  </p>
                  {r.ownerRole && (
                    <span className="status-pill status-pending mt-1 inline-flex">owner: {r.ownerRole}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`status-pill ${r.tier === "enterprise" ? "status-sealed" : "status-pending"}`}>
                    {r.tier ?? "—"}
                  </span>
                  {r.status && (
                    <span className="ml-2 text-xs text-[color:var(--text-muted)]">{r.status}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[color:var(--text-secondary)] text-xs">
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
                    <span className="text-xs text-[color:var(--text-muted)]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
