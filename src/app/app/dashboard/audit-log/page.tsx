import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { eq, desc, inArray, and } from "drizzle-orm";
import { auth } from "@/auth";
import { getCurrentMembership, isManagerRole } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Audit log — AuditHalo" };

const ACTION_LABELS: Record<string, string> = {
  "invitation.sent": "Invitation sent",
  "invitation.canceled": "Invitation canceled",
  "invitation.resent": "Invitation resent",
  "invitation.accepted": "Invitation accepted",
  "rule.assigned": "Rule assigned",
  "rule.changed": "Rule changed",
  "session.logged": "Session logged",
  "session.signed": "Session signed",
  "session.sealed": "Session sealed",
  "member.role_changed": "Role changed",
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isManagerRole(session.user.role)) redirect("/dashboard");

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) redirect("/dashboard");

  const { action: actionFilter } = await searchParams;

  const whereClause = actionFilter
    ? and(
        eq(schema.auditLogEntries.orgId, membership.orgId),
        eq(schema.auditLogEntries.action, actionFilter)
      )
    : eq(schema.auditLogEntries.orgId, membership.orgId);

  const [entries, org] = await Promise.all([
    db.query.auditLogEntries.findMany({
      where: whereClause,
      orderBy: [desc(schema.auditLogEntries.createdAt)],
      limit: 100,
    }),
    db.query.organizations.findFirst({
      where: eq(schema.organizations.id, membership.orgId),
    }),
  ]);

  // Resolve actor names in a single query
  const actorIds = Array.from(
    new Set(entries.map((e) => e.actorUserId).filter((id): id is string => id !== null))
  );
  const actors = actorIds.length
    ? await db.query.users.findMany({
        where: inArray(schema.users.id, actorIds),
      })
    : [];
  const actorMap = new Map(actors.map((u) => [u.id, u]));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 sm:py-12">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/dashboard">
          <ArrowLeft />
          Back to dashboard
        </Link>
      </Button>

      <Badge variant="outline" className="mb-3">Audit log · {org?.name ?? "Practice"}</Badge>
      <h1 className="font-display text-3xl sm:text-4xl font-semibold text-foreground">
        Audit log
      </h1>
      <p className="mt-3 text-foreground/70 max-w-2xl">
        Every state-changing action in your practice is recorded here, with who did
        it, when, and what changed. Retained for 7 years.
      </p>

      {/* Action filter — simple <form> with GET method so filter is in the URL */}
      <form className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="action" className="block text-xs text-foreground/60 mb-1">
            Filter by action
          </label>
          <select
            id="action"
            name="action"
            defaultValue={actionFilter ?? ""}
            className="h-9 rounded-sm border border-input bg-card px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All actions</option>
            {Object.entries(ACTION_LABELS).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm">Apply</Button>
        {actionFilter && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/audit-log">Clear</Link>
          </Button>
        )}
      </form>

      <Card className="mt-8">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-accent">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">When</th>
                  <th className="px-4 py-3 font-semibold">Actor</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Resource</th>
                  <th className="px-4 py-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const actor = e.actorUserId ? actorMap.get(e.actorUserId) : null;
                  return (
                    <tr key={e.id} className="border-t border-border hover:bg-accent/40 align-top">
                      <td className="px-4 py-3 font-mono text-xs text-foreground/70 whitespace-nowrap">
                        {e.createdAt.toISOString().slice(0, 16).replace("T", " ")}Z
                      </td>
                      <td className="px-4 py-3">
                        {actor ? (
                          <>
                            <span className="font-medium">{actor.name}</span>
                            <span className="text-foreground/50 text-xs"> · {actor.email}</span>
                          </>
                        ) : (
                          <span className="text-foreground/40 italic">system</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {ACTION_LABELS[e.action] ?? e.action}
                      </td>
                      <td className="px-4 py-3 text-foreground/70 text-xs font-mono">
                        {e.resourceType ? (
                          <>
                            <span>{e.resourceType}</span>
                            {e.resourceId && (
                              <>
                                <br />
                                <span className="text-foreground/40">{e.resourceId.slice(0, 8)}…</span>
                              </>
                            )}
                          </>
                        ) : (
                          <span className="text-foreground/30">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {e.details && Object.keys(e.details).length > 0 ? (
                          <pre className="font-mono text-foreground/70 whitespace-pre-wrap break-words max-w-md">
                            {JSON.stringify(e.details, null, 2)}
                          </pre>
                        ) : (
                          <span className="text-foreground/30">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-foreground/50 text-sm">
                      No entries{actionFilter ? ` matching "${ACTION_LABELS[actionFilter] ?? actionFilter}"` : " yet"}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="mt-3 text-xs text-foreground/50">
        Showing the most recent 100 entries. Older entries are retained but require export to view.
      </p>
    </div>
  );
}
