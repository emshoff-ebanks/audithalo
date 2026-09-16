import { redirect } from "next/navigation";
import Link from "next/link";
import { Circle, AlertTriangle, AlertOctagon } from "lucide-react";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import {
  canSupervise,
  getCurrentMembership,
  isExecutive,
  isManagerRole,
} from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { loadAllRules, riskBadgeLabel } from "@/lib/rules";
import { getOrgRosterWithCompliance } from "@/lib/db/roster-queries";
import { InviteForm } from "./invite-form";
import { PendingInviteActions } from "./pending-invite-actions";
import { FilterBar } from "./_filter-bar";
import { parseRosterFilter, parseSupervisorId } from "./_roster-filter";
import { ClickableRow } from "@/components/app/clickable-row";

export const metadata = {
  title: "Roster — AuditHalo",
};

/** Severity status pill (design-system-v2.md §7.1, §13 — icon + text, never
 *  color alone). */
function RiskPill({ level }: { level: "green" | "yellow" | "red" }) {
  const cls = level === "red" ? "status-risk" : level === "yellow" ? "status-warn" : "status-ok";
  return (
    <span className={`status-pill ${cls}`}>
      {level === "green" && <Circle className="h-2 w-2 fill-current" />}
      {level === "yellow" && <AlertTriangle className="h-3 w-3" />}
      {level === "red" && <AlertOctagon className="h-3 w-3" />}
      {riskBadgeLabel(level)}
    </span>
  );
}

type SearchParams = Promise<{
  filter?: string;
  q?: string;
  /** HR-Admin-only: restrict the roster to a single supervisor's
   *  currently-assigned supervisees. Ignored for supervisor viewers (their
   *  view is already implicitly filtered to themselves) and for invalid IDs. */
  supervisor?: string;
}>;

export default async function RosterPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Executive is read-only oversight — they don't get the roster view. Push
  // them to /dashboard/executive instead. Must run BEFORE the manager check
  // since isManagerRole returns true for executive too.
  if (isExecutive(session.user.role)) {
    redirect("/dashboard/executive");
  }
  // Roster + invitations are supervisor / hr_admin only.
  if (!isManagerRole(session.user.role)) {
    redirect(`/dashboard/roster/${session.user.id}`);
  }

  const viewerCanSupervise = canSupervise(session.user.role);
  const viewerIsHrAdmin = session.user.role === "hr_admin";

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p>No organization found. Contact support.</p>
      </div>
    );
  }

  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, membership.orgId),
  });

  // HR Admin's invite form needs a supervisor picker (per spec
  // 04-enterprise-rbac.md §"Inviting a Supervisee"). Supervisor's form
  // doesn't show one — they auto-assign to themselves.
  const supervisorOptionsForForm = viewerIsHrAdmin
    ? await (async () => {
        const rows = await db
          .select({
            id: schema.users.id,
            name: schema.users.name,
            email: schema.users.email,
          })
          .from(schema.orgMemberships)
          .innerJoin(
            schema.users,
            eq(schema.orgMemberships.userId, schema.users.id)
          )
          .where(
            and(
              eq(schema.orgMemberships.orgId, membership.orgId),
              eq(schema.orgMemberships.role, "supervisor"),
              isNull(schema.orgMemberships.deactivatedAt)
            )
          );
        return rows.map((r) => ({ id: r.id, name: r.name ?? r.email }));
      })()
    : undefined;

  // Fetch all supervisees with compliance data (3 batch queries)
  const allRosterRows = await getOrgRosterWithCompliance(membership.orgId);

  // Org's active custom rules — surfaced to the invite form's rule picker.
  const orgCustomRows = await db
    .select()
    .from(schema.orgRuleOverrides)
    .where(
      and(
        eq(schema.orgRuleOverrides.orgId, membership.orgId),
        eq(schema.orgRuleOverrides.isActive, true),
        isNull(schema.orgRuleOverrides.canonicalRuleId)
      )
    );
  const orgCustomRules = orgCustomRows.map((r) => ({
    id: `org:${membership.orgId}:custom:${r.jurisdiction.toLowerCase()}-${r.licenseCode.toLowerCase()}-v${r.version}`,
    label: `${r.label} (org-created)`,
    summary:
      (r.customMetadata as { summary?: string } | null)?.summary ??
      "Org-created custom rule",
  }));

  // Fetch pending invitations for THIS roster page — supervisee invites only.
  // Supervisor/HR Admin/Executive invitations live on /dashboard/team and
  // were mixing into this table without a role indicator, confusing HR Admins
  // who couldn't tell who they were about to add. Filtering by role keeps
  // the roster page strictly about supervisees.
  const pendingInvites = await db.query.invitations.findMany({
    where: and(
      eq(schema.invitations.orgId, membership.orgId),
      eq(schema.invitations.role, "supervisee")
    ),
  });

  const params = await searchParams;
  const filter = parseRosterFilter(params.filter);
  const searchQuery = (params.q ?? "").trim();
  const searchLower = searchQuery.toLowerCase();

  // Supervisor filter — HR Admin only. Resolve the ?supervisor= param to a
  // Set of currently-assigned supervisee IDs in one batch query. Historical
  // assignments (those with endedAt set) are intentionally excluded —
  // "show me everyone Dr. X is currently overseeing", not their lifetime
  // roster.
  const supervisorFilterId = viewerIsHrAdmin
    ? parseSupervisorId(params.supervisor)
    : null;
  const supervisorFilterSuperviseeIds: Set<string> | null =
    supervisorFilterId
      ? await (async () => {
          const rows = await db
            .select({
              superviseeId: schema.supervisorAssignments.superviseeId,
            })
            .from(schema.supervisorAssignments)
            .where(
              and(
                eq(schema.supervisorAssignments.orgId, membership.orgId),
                eq(
                  schema.supervisorAssignments.supervisorId,
                  supervisorFilterId
                ),
                isNull(schema.supervisorAssignments.endedAt)
              )
            );
          return new Set(rows.map((r) => r.superviseeId).filter((id): id is string => id !== null));
        })()
      : null;

  // Pending invites filtered the same way the roster rows are: when an HR
  // Admin filters by supervisor X, the table must only show invites that
  // *will* land under X. Without this, the empty-state lies — "Dr. X has
  // no supervisees" while a list of someone else's pending invites
  // still renders below.
  const visiblePendingInvites = pendingInvites.filter((i) => {
    if (i.acceptedAt) return false;
    if (
      supervisorFilterId &&
      i.pendingAssignmentSupervisorId !== supervisorFilterId
    ) {
      return false;
    }
    return true;
  });

  const rosterRows = allRosterRows.filter((r) => {
    const matchesSearch =
      searchLower === "" ||
      r.name.toLowerCase().includes(searchLower) ||
      r.email.toLowerCase().includes(searchLower);
    if (!matchesSearch) return false;
    if (
      supervisorFilterSuperviseeIds &&
      !supervisorFilterSuperviseeIds.has(r.userId)
    ) {
      return false;
    }
    if (filter === "all") return true;
    if (filter === "at-risk") {
      return (
        r.evaluation?.riskLevel === "red" ||
        r.evaluation?.riskLevel === "yellow"
      );
    }
    if (filter === "pending-signatures") return r.pendingSignatureCount > 0;
    if (filter === "on-track") return r.evaluation?.riskLevel === "green";
    return true;
  });

  const atRiskCount = allRosterRows.filter(
    (r) => r.evaluation?.riskLevel === "red" || r.evaluation?.riskLevel === "yellow"
  ).length;

  return (
    <>
      <div>
        <p className="shell-eyebrow">{org?.name ?? "Roster"}</p>
        <h1 className="shell-page-title mt-1">
          {viewerIsHrAdmin ? "Org roster" : "Your roster"}
        </h1>
        <p className="shell-page-sub max-w-2xl">
          {viewerIsHrAdmin
            ? "Every supervisee across this organization. Click into a row to reassign their supervisor or review their compliance."
            : "Every supervisee you invite gets a free AuditHalo account. They join your roster the moment they accept the invitation, and you'll see their hour progress here."}
        </p>
      </div>

      <FilterBar
        activeFilter={filter}
        filteredCount={rosterRows.length}
        totalCount={allRosterRows.length}
        searchQuery={searchQuery}
        supervisorOptions={supervisorOptionsForForm ?? null}
        activeSupervisorId={supervisorFilterId}
      />

      {atRiskCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-[8px] border border-[color:var(--risk-600)]/30 border-l-[3px] border-l-[color:var(--risk-600)] bg-[color:var(--risk-50)]/40 px-4 py-3 text-sm">
          <AlertOctagon className="h-4 w-4 text-[color:var(--risk-600)] shrink-0" />
          <span className="font-semibold text-[color:var(--text-primary)]">
            {atRiskCount} supervisee{atRiskCount === 1 ? "" : "s"} need attention
          </span>
          <span className="text-[color:var(--text-secondary)]">
            — review their compliance status below.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="panel panel-flush lg:col-span-2 overflow-hidden">
          {/* Mobile card-per-row (under md) */}
          <ul className="md:hidden divide-y divide-[color:var(--divider)]">
            {rosterRows.map((row) => {
              const pct = row.evaluation?.progress.practiceProgressPct ?? 0;
              const practiced = row.evaluation?.totals.practiceHours ?? 0;
              const accent =
                row.evaluation?.riskLevel === "red"
                  ? "border-l-[3px] border-l-[color:var(--risk-600)] bg-[color:var(--risk-50)]/40"
                  : row.evaluation?.riskLevel === "yellow"
                    ? "border-l-[3px] border-l-[color:var(--warn-500)] bg-[color:var(--warn-50)]/40"
                    : "";
              return (
                <li key={row.userId} className={`px-4 py-3 ${accent}`}>
                  <Link href={`/dashboard/roster/${row.userId}`} className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[color:var(--text-primary)] truncate">{row.name}</p>
                      <p className="mt-0.5 text-xs text-[color:var(--text-muted)] truncate">
                        {row.state && row.licenseType
                          ? `${row.state} · ${row.licenseType}`
                          : row.state ?? row.licenseType ?? "—"}
                      </p>
                      {row.evaluation !== null && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full overflow-hidden bg-[color:var(--ink-100)] dark:bg-[rgba(250,247,240,0.12)]">
                            <div className="h-full bg-[color:var(--seal-gold)]" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-mono text-[10px] text-[color:var(--text-secondary)] whitespace-nowrap">
                            {practiced.toFixed(1)}h
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {row.leaveStatus === "on_leave" ? (
                        <span className="status-pill status-warn"><AlertTriangle className="h-3 w-3" />On leave</span>
                      ) : row.evaluation ? (
                        <RiskPill level={row.evaluation.riskLevel} />
                      ) : (
                        <span className="text-[color:var(--text-muted)] italic text-[10px]">No rule</span>
                      )}
                      {row.leaveStatus === "prn" && <span className="status-pill status-pending">PRN</span>}
                      {row.pendingSignatureCount > 0 && (
                        <span className="status-pill status-warn">{row.pendingSignatureCount} pending</span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
            {visiblePendingInvites.map((i) => (
              <li key={i.id} className="px-4 py-3 bg-[color:var(--surface-muted)]/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[color:var(--text-primary)] truncate">
                      {i.name ?? <span className="text-[color:var(--text-muted)] italic">unnamed</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-[color:var(--text-muted)] break-all">{i.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="status-pill status-pending">Pending</span>
                    {viewerCanSupervise && <PendingInviteActions invitationId={i.id} email={i.email} />}
                  </div>
                </div>
              </li>
            ))}
            {rosterRows.length === 0 && visiblePendingInvites.length === 0 && (
              <li className="px-4 py-8 text-center text-[color:var(--text-muted)] text-sm">
                {supervisorFilterId
                  ? "This supervisor has no supervisees assigned yet."
                  : "No supervisees yet. Use the form below to invite one."}
              </li>
            )}
          </ul>

          {/* Tablet+ table view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left border-b border-[color:var(--border)] bg-[color:var(--surface-muted)]">
                  <th scope="col" className="px-5 py-3 label-overline">Name</th>
                  <th scope="col" className="px-5 py-3 label-overline">Credential</th>
                  <th scope="col" className="px-5 py-3 label-overline">Practice hrs</th>
                  <th scope="col" className="px-5 py-3 label-overline">Status</th>
                  <th scope="col" className="px-5 py-3 label-overline">Pending sigs</th>
                </tr>
              </thead>
              <tbody>
                {rosterRows.map((row) => {
                  const pct = row.evaluation?.progress.practiceProgressPct ?? 0;
                  const practiced = row.evaluation?.totals.practiceHours ?? 0;
                  const rowClasses =
                    row.evaluation?.riskLevel === "red"
                      ? "border-l-[3px] border-l-[color:var(--risk-600)] bg-[color:var(--risk-50)]/40"
                      : row.evaluation?.riskLevel === "yellow"
                        ? "border-l-[3px] border-l-[color:var(--warn-500)] bg-[color:var(--warn-50)]/40"
                        : "";
                  return (
                    <ClickableRow
                      key={row.userId}
                      href={`/dashboard/roster/${row.userId}`}
                      className={`border-b border-[color:var(--divider)] hover:bg-[color:var(--surface-muted)] ${rowClasses}`}
                    >
                      <td className="px-5 py-3 font-medium text-[color:var(--text-primary)]">
                        <Link href={`/dashboard/roster/${row.userId}`} className="hover:underline">
                          {row.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-[color:var(--text-secondary)]">
                        {row.state && row.licenseType
                          ? `${row.state} · ${row.licenseType}`
                          : row.state ?? row.licenseType ?? <span className="italic text-[color:var(--text-muted)]">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        {row.evaluation !== null ? (
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <div className="flex-1 h-2 rounded-full overflow-hidden bg-[color:var(--ink-100)] dark:bg-[rgba(250,247,240,0.12)]">
                              <div className="h-full bg-[color:var(--seal-gold)]" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="font-mono text-xs text-[color:var(--text-secondary)]">{practiced.toFixed(1)}h</span>
                          </div>
                        ) : (
                          <span className="text-[color:var(--text-muted)] italic text-xs">no rule</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          {row.leaveStatus === "on_leave" ? (
                            <span className="status-pill status-warn"><AlertTriangle className="h-3 w-3" />On leave</span>
                          ) : row.evaluation ? (
                            <RiskPill level={row.evaluation.riskLevel} />
                          ) : (
                            <span className="text-[color:var(--text-muted)] italic text-xs">No rule</span>
                          )}
                          {row.leaveStatus === "prn" && <span className="status-pill status-pending">PRN</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {row.pendingSignatureCount > 0 ? (
                          <span className="status-pill status-warn">{row.pendingSignatureCount}</span>
                        ) : (
                          <span className="text-[color:var(--text-muted)]">—</span>
                        )}
                      </td>
                    </ClickableRow>
                  );
                })}
                {rosterRows.length === 0 && visiblePendingInvites.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-[color:var(--text-muted)] text-sm">
                      {supervisorFilterId
                        ? "This supervisor has no supervisees assigned yet."
                        : "No supervisees yet. Invite one using the form →"}
                    </td>
                  </tr>
                )}
                {visiblePendingInvites.map((i) => (
                  <tr key={i.id} className="border-b border-[color:var(--divider)] bg-[color:var(--surface-muted)]/50">
                    <td className="px-5 py-3 font-medium text-[color:var(--text-primary)]">
                      {i.name ?? <span className="text-[color:var(--text-muted)] italic">unnamed</span>}
                    </td>
                    <td className="px-5 py-3 text-[color:var(--text-secondary)] break-all">{i.email}</td>
                    <td className="px-5 py-3">
                      <span className="text-[color:var(--text-muted)] italic text-xs">—</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="status-pill status-pending">Pending invite</span>
                    </td>
                    <td className="px-5 py-3">
                      {viewerCanSupervise ? (
                        <PendingInviteActions invitationId={i.id} email={i.email} />
                      ) : (
                        <span className="text-[color:var(--text-muted)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <p className="label-overline mb-3">Invite a supervisee</p>
          <InviteForm
            availableRules={[
              ...[...loadAllRules().values()].map((r) => {
                const id = `${r.jurisdiction.toLowerCase()}-${r.license_code.toLowerCase()}-v${r.version}`;
                return {
                  id,
                  label: `${r.jurisdiction} ${r.license_code} v${r.version}`,
                  summary: r.summary,
                };
              }),
              ...orgCustomRules,
            ]}
            supervisorOptions={supervisorOptionsForForm}
          />
        </div>
      </div>
    </>
  );
}
