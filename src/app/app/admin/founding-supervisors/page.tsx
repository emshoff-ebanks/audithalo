import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { FoundingToggleForm } from "./_toggle-form";

export const metadata = { title: "Founding Supervisors — Admin" };
export const dynamic = "force-dynamic";

/**
 * Admin page — lists every user with the supervisor role + their current
 * Founding Supervisor state. Each row has a toggle action gated by
 * `isAdminEmail` (in the server action). The layout's `requireAdmin()`
 * bounces non-admins before this page renders.
 */
export default async function FoundingSupervisorsPage() {
  // All current supervisor-role users with their first-org-name (for context).
  // No pagination yet — Founding cohort is capped at 15-25 and we don't have
  // 25+ supervisors total. If it grows we'll add filters + paging.
  const rows = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      isFoundingSupervisor: schema.users.isFoundingSupervisor,
      createdAt: schema.users.createdAt,
      orgName: sql<string | null>`(
        SELECT o.name FROM organizations o
        JOIN org_memberships m ON m.org_id = o.id
        WHERE m.user_id = ${schema.users.id}
        ORDER BY o.created_at ASC
        LIMIT 1
      )`,
    })
    .from(schema.users)
    .where(eq(schema.users.role, "supervisor"))
    .orderBy(schema.users.createdAt);

  const foundingCount = rows.filter((r) => r.isFoundingSupervisor).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="shell-page-title">Founding Supervisor program</h1>
        <p className="shell-page-sub max-w-3xl">
          Manually grant or revoke the Founding Supervisor flag for any
          supervisor in the system. Granting it surfaces a badge in their
          dashboard header and reserves them for future early-access feature
          branches.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="status-pill status-pending">
          {rows.length} supervisor{rows.length === 1 ? "" : "s"} total
        </span>
        <span className="status-pill status-sealed">
          {foundingCount} Founding · target 15-25
        </span>
      </div>

      <div className="panel panel-flush overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-[color:var(--border)] bg-[color:var(--surface-muted)]">
              <th className="px-4 py-3 label-overline">Name</th>
              <th className="px-4 py-3 label-overline">Email</th>
              <th className="px-4 py-3 label-overline">Org</th>
              <th className="px-4 py-3 label-overline">Joined</th>
              <th className="px-4 py-3 label-overline">Founding</th>
              <th className="px-4 py-3 label-overline"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[color:var(--divider)]">
                <td className="px-4 py-3 font-medium text-[color:var(--text-primary)]">{r.name ?? "—"}</td>
                <td className="px-4 py-3 text-[color:var(--text-secondary)] font-mono text-xs">
                  {r.email}
                </td>
                <td className="px-4 py-3 text-[color:var(--text-secondary)]">
                  {r.orgName ?? "—"}
                </td>
                <td className="px-4 py-3 text-[color:var(--text-muted)] text-xs font-mono">
                  {r.createdAt.toISOString().slice(0, 10)}
                </td>
                <td className="px-4 py-3">
                  {r.isFoundingSupervisor ? (
                    <span className="status-pill status-sealed">Founding</span>
                  ) : (
                    <span className="text-[color:var(--text-muted)] text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <FoundingToggleForm
                    userId={r.id}
                    currentlyFounding={r.isFoundingSupervisor}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
