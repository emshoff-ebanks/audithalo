import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, desc, inArray, and } from "drizzle-orm";
import { auth } from "@/auth";
import {
  canExportAuditLog,
  getCurrentMembership,
  isHrAdmin,
  isManagerRole,
} from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { AuditLogExportForm } from "./_export-form";

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

  const showExport = canExportAuditLog(membership.role);
  const exportRequiresTotp = isHrAdmin(membership.role);

  // Org-level audit-log retention (org_settings.audit_log_retention_years).
  // Surfaced in the page header so the user knows how far back records go.
  const settings = await db.query.orgSettings.findFirst({
    where: eq(schema.orgSettings.orgId, membership.orgId),
  });
  const retentionYears = settings?.auditLogRetentionYears ?? 7;

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
    <div className="flex flex-col gap-6">
      <div>
        <p className="shell-eyebrow">Audit log · {org?.name ?? "Practice"}</p>
        <h1 className="shell-page-title mt-1">Audit log</h1>
        <p className="shell-page-sub max-w-2xl">
          Every state-changing action in your practice is recorded here, with who
          did it, when, and what changed. Retained for {retentionYears}{" "}
          year{retentionYears === 1 ? "" : "s"}.
        </p>
      </div>

      {showExport && (
        <div className="panel">
          <p className="label-overline mb-1">Export audit log</p>
          <p className="text-sm text-[color:var(--text-muted)] mb-4">
            {exportRequiresTotp
              ? "Streams up to 10,000 rows. Confirm with 2FA to download."
              : "Streams up to 10,000 rows. Read-only oversight export."}
          </p>
          <AuditLogExportForm requireTotp={exportRequiresTotp} />
        </div>
      )}

      {/* Action filter — simple <form> with GET method so filter is in the URL */}
      <form className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="action" className="block text-xs text-[color:var(--text-muted)] mb-1">
            Filter by action
          </label>
          <select
            id="action"
            name="action"
            defaultValue={actionFilter ?? ""}
            className="h-9 rounded-sm border border-[color:var(--border)] bg-[color:var(--paper-white)] dark:bg-[color:var(--surface-muted)] px-2 py-1 text-sm text-[color:var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--halo-yellow)]"
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

      <div className="panel panel-flush overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="text-left border-b border-[color:var(--border)] bg-[color:var(--surface-muted)]">
              <th className="px-4 py-3 label-overline whitespace-nowrap">When</th>
              <th className="px-4 py-3 label-overline">Actor</th>
              <th className="px-4 py-3 label-overline">Action</th>
              <th className="px-4 py-3 label-overline">Resource</th>
              <th className="px-4 py-3 label-overline">Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const actor = e.actorUserId ? actorMap.get(e.actorUserId) : null;
              return (
                <tr key={e.id} className="border-b border-[color:var(--divider)] hover:bg-[color:var(--surface-muted)] align-top">
                  <td className="px-4 py-3 font-mono text-xs text-[color:var(--text-secondary)] whitespace-nowrap">
                    {e.createdAt.toISOString().slice(0, 16).replace("T", " ")}Z
                  </td>
                  <td className="px-4 py-3">
                    {actor ? (
                      <>
                        <span className="font-medium text-[color:var(--text-primary)]">{actor.name}</span>
                        <span className="text-[color:var(--text-muted)] text-xs"> · {actor.email}</span>
                      </>
                    ) : (
                      <span className="text-[color:var(--text-muted)] italic">system</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--text-primary)]">
                    {ACTION_LABELS[e.action] ?? e.action}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--text-secondary)] text-xs font-mono">
                    {e.resourceType ? (
                      <>
                        <span>{e.resourceType}</span>
                        {e.resourceId && (
                          <>
                            <br />
                            <span className="text-[color:var(--text-muted)]">{e.resourceId.slice(0, 8)}…</span>
                          </>
                        )}
                      </>
                    ) : (
                      <span className="text-[color:var(--text-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {e.details && Object.keys(e.details).length > 0 ? (
                      <pre className="font-mono text-[color:var(--text-secondary)] whitespace-pre-wrap break-words max-w-md">
                        {JSON.stringify(e.details, null, 2)}
                      </pre>
                    ) : (
                      <span className="text-[color:var(--text-muted)]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[color:var(--text-muted)] text-sm">
                  No entries{actionFilter ? ` matching "${ACTION_LABELS[actionFilter] ?? actionFilter}"` : " yet"}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[color:var(--text-muted)]">
        Showing the most recent 100 entries. Older entries are retained but require export to view.
      </p>
    </div>
  );
}
