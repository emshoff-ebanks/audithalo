import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Circle, AlertTriangle, AlertOctagon } from "lucide-react";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import {
  canSupervise,
  getCurrentMembership,
  isExecutive,
  isManagerRole,
} from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { loadAllRules, riskBadgeVariant, riskBadgeLabel } from "@/lib/rules";
import { getOrgRosterWithCompliance } from "@/lib/db/roster-queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InviteForm } from "./invite-form";
import { PendingInviteActions } from "./pending-invite-actions";
import { FilterBar } from "./_filter-bar";
import { parseRosterFilter, parseSupervisorId } from "./_roster-filter";
import { ClickableRow } from "@/components/app/clickable-row";

export const metadata = {
  title: "Roster — AuditHalo",
};

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
          return new Set(rows.map((r) => r.superviseeId));
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
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-12">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/dashboard">
          <ArrowLeft />
          Back to dashboard
        </Link>
      </Button>

      <Badge variant="outline" className="mb-3">
        {org?.name ?? "Roster"}
      </Badge>
      <h1 className="font-display text-3xl sm:text-4xl font-semibold text-foreground">
        {viewerIsHrAdmin ? "Org roster" : "Your roster"}
      </h1>
      <p className="mt-3 text-foreground/70 max-w-2xl">
        {viewerIsHrAdmin
          ? "Every supervisee across this organization. Click into a row to reassign their supervisor or review their compliance."
          : "Every supervisee you invite gets a free AuditHalo account. They join your roster the moment they accept the invitation, and you'll see their hour progress here."}
      </p>

      <FilterBar
        activeFilter={filter}
        filteredCount={rosterRows.length}
        totalCount={allRosterRows.length}
        searchQuery={searchQuery}
        supervisorOptions={supervisorOptionsForForm ?? null}
        activeSupervisorId={supervisorFilterId}
      />

      {atRiskCount > 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span className="font-semibold">
            {atRiskCount} supervisee{atRiskCount === 1 ? "" : "s"} at risk
          </span>
          <span className="text-destructive/70">
            — review their compliance status below.
          </span>
        </div>
      )}

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            {/* Mobile card-per-row (under md) */}
            <ul className="md:hidden divide-y divide-border">
              {rosterRows.map((row) => {
                const pct = row.evaluation?.progress.practiceProgressPct ?? 0;
                const practiced = row.evaluation?.totals.practiceHours ?? 0;
                const accent = (() => {
                  if (row.evaluation?.riskLevel === "red")
                    return "border-l-[3px] border-l-[color:var(--color-risk-600)] bg-[color:var(--color-risk-50)]/30";
                  if (row.evaluation?.riskLevel === "yellow")
                    return "border-l-[3px] border-l-[color:var(--color-warn-500)] bg-[color:var(--color-warn-50)]/30";
                  return "";
                })();
                return (
                  <li key={row.userId} className={`px-4 py-3 ${accent}`}>
                    <Link
                      href={`/dashboard/roster/${row.userId}`}
                      className="flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {row.name}
                        </p>
                        <p className="mt-0.5 text-xs text-foreground/60 truncate">
                          {row.state && row.licenseType
                            ? `${row.state} · ${row.licenseType}`
                            : row.state ?? row.licenseType ?? "—"}
                        </p>
                        {row.evaluation !== null && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[color:var(--color-gold)] transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="font-mono text-[10px] text-foreground/60 whitespace-nowrap">
                              {practiced.toFixed(1)}h
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {row.evaluation ? (
                          <Badge variant={riskBadgeVariant(row.evaluation.riskLevel)}>
                            {row.evaluation.riskLevel === "green" && <Circle className="h-2 w-2 fill-current" />}
                            {row.evaluation.riskLevel === "yellow" && <AlertTriangle className="h-3 w-3" />}
                            {row.evaluation.riskLevel === "red" && <AlertOctagon className="h-3 w-3" />}
                            {riskBadgeLabel(row.evaluation.riskLevel)}
                          </Badge>
                        ) : (
                          <span className="text-foreground/40 italic text-[10px]">
                            No rule
                          </span>
                        )}
                        {row.pendingSignatureCount > 0 && (
                          <Badge variant="warning">
                            {row.pendingSignatureCount} pending
                          </Badge>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
              {visiblePendingInvites.map((i) => (
                  <li
                    key={i.id}
                    className="px-4 py-3 bg-[color:var(--color-evidence-bg)]/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {i.name ?? (
                            <span className="text-foreground/50 italic">
                              unnamed
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-foreground/60 break-all">
                          {i.email}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <Badge variant="warning">Pending</Badge>
                        {viewerCanSupervise && (
                          <PendingInviteActions
                            invitationId={i.id}
                            email={i.email}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              {rosterRows.length === 0 &&
                visiblePendingInvites.length === 0 && (
                  <li className="px-4 py-8 text-center text-foreground/50 text-sm">
                    {supervisorFilterId
                      ? "This supervisor has no supervisees assigned yet."
                      : "No supervisees yet. Use the form below to invite one."}
                  </li>
                )}
            </ul>

            {/* Tablet+ table view */}
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-accent">
                <tr className="text-left">
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Credential</th>
                  <th className="px-5 py-3 font-semibold">Practice hrs</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Pending sigs</th>
                </tr>
              </thead>
              <tbody>
                {rosterRows.map((row) => {
                  const pct = row.evaluation?.progress.practiceProgressPct ?? 0;
                  const practiced = row.evaluation?.totals.practiceHours ?? 0;

                  const rowClasses = (() => {
                    if (row.evaluation?.riskLevel === "red") {
                      return "border-l-[3px] border-l-[color:var(--color-risk-600)] bg-[color:var(--color-risk-50)]/30";
                    }
                    if (row.evaluation?.riskLevel === "yellow") {
                      return "border-l-[3px] border-l-[color:var(--color-warn-500)] bg-[color:var(--color-warn-50)]/30";
                    }
                    return "";
                  })();

                  return (
                    <ClickableRow
                      key={row.userId}
                      href={`/dashboard/roster/${row.userId}`}
                      className={`border-t border-border hover:bg-accent/40 ${rowClasses}`}
                    >
                      <td className="px-5 py-3 font-medium">
                        <Link
                          href={`/dashboard/roster/${row.userId}`}
                          className="hover:underline"
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-foreground/70">
                        {row.state && row.licenseType
                          ? `${row.state} · ${row.licenseType}`
                          : row.state ?? row.licenseType ?? (
                              <span className="italic text-foreground/40">—</span>
                            )}
                      </td>
                      <td className="px-5 py-3">
                        {row.evaluation !== null ? (
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[color:var(--color-gold)] transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs text-foreground/60">
                              {practiced.toFixed(1)}h
                            </span>
                          </div>
                        ) : (
                          <span className="text-foreground/40 italic text-xs">no rule</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {row.evaluation ? (
                          <Badge variant={riskBadgeVariant(row.evaluation.riskLevel)}>
                            {row.evaluation.riskLevel === "green" && <Circle className="h-2 w-2 fill-current" />}
                            {row.evaluation.riskLevel === "yellow" && <AlertTriangle className="h-3 w-3" />}
                            {row.evaluation.riskLevel === "red" && <AlertOctagon className="h-3 w-3" />}
                            {riskBadgeLabel(row.evaluation.riskLevel)}
                          </Badge>
                        ) : (
                          <span className="text-foreground/40 italic text-xs">No rule</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {row.pendingSignatureCount > 0 ? (
                          <Badge variant="warning">
                            {row.pendingSignatureCount}
                          </Badge>
                        ) : (
                          <span className="text-foreground/40">—</span>
                        )}
                      </td>
                    </ClickableRow>
                  );
                })}
                {rosterRows.length === 0 &&
                  visiblePendingInvites.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-foreground/50 text-sm">
                        {supervisorFilterId
                          ? "This supervisor has no supervisees assigned yet."
                          : "No supervisees yet. Invite one using the form →"}
                      </td>
                    </tr>
                  )}
                {visiblePendingInvites.map((i) => (
                    <tr key={i.id} className="border-t border-border bg-[color:var(--color-evidence-bg)]/40">
                      <td className="px-5 py-3 font-medium">
                        {i.name ?? <span className="text-foreground/50 italic">unnamed</span>}
                      </td>
                      <td className="px-5 py-3 text-foreground/70 break-all">{i.email}</td>
                      <td className="px-5 py-3">
                        <span className="text-foreground/40 italic text-xs">—</span>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant="warning">Pending invite</Badge>
                      </td>
                      <td className="px-5 py-3">
                        {viewerCanSupervise ? (
                          <PendingInviteActions invitationId={i.id} email={i.email} />
                        ) : (
                          <span className="text-foreground/40">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
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
                // Org's active custom rules — synthetic ids the resolver
                // recognizes. Cycle 4.
                ...orgCustomRules,
              ]}
              supervisorOptions={supervisorOptionsForForm}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
