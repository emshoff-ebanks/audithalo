import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
    <div>
      <h1 className="font-display text-3xl font-semibold text-foreground">
        Founding Supervisor program
      </h1>
      <p className="mt-3 text-foreground/70 max-w-3xl">
        Manually grant or revoke the Founding Supervisor flag for any
        supervisor in the system. Granting it surfaces a badge in their
        dashboard header and reserves them for future early-access feature
        branches.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Badge variant="outline">
          {rows.length} supervisor{rows.length === 1 ? "" : "s"} total
        </Badge>
        <Badge
          variant="outline"
          className="border-[color:var(--color-gold)] bg-[color:var(--color-gold)]/10 text-[color:var(--color-gold)]"
        >
          {foundingCount} Founding · target 15-25
        </Badge>
      </div>

      <Card className="mt-8">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-accent text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Org</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
                <th className="px-4 py-3 font-semibold">Founding</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{r.name ?? "—"}</td>
                  <td className="px-4 py-3 text-foreground/70 font-mono text-xs">
                    {r.email}
                  </td>
                  <td className="px-4 py-3 text-foreground/70">
                    {r.orgName ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground/60 text-xs font-mono">
                    {r.createdAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4 py-3">
                    {r.isFoundingSupervisor ? (
                      <Badge
                        variant="outline"
                        className="border-[color:var(--color-gold)] bg-[color:var(--color-gold)]/10 text-[color:var(--color-gold)]"
                      >
                        Founding
                      </Badge>
                    ) : (
                      <span className="text-foreground/40 text-xs">—</span>
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
        </CardContent>
      </Card>
    </div>
  );
}
