import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield, AlertTriangle } from "lucide-react";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import {
  canManageOrg,
  getCurrentMembership,
  isHrAdmin,
  isManagerRole,
} from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { Button } from "@/components/ui/button";
import {
  InviteSupervisorForm,
  InviteHrAdminForm,
  InviteExecutiveForm,
  DeactivateMemberButton,
  ReassignSupervisorDropdown,
} from "./_invite-forms";
import { PendingInviteActions } from "../roster/pending-invite-actions";

export const metadata = { title: "Team — AuditHalo" };
export const dynamic = "force-dynamic";

const MAX_EXECUTIVE_SEATS = 5;

// Sort priority for the member sections — HR Admin first, then Supervisor,
// then Executive, then Supervisee. Within each, alphabetical by name.
const ROLE_PRIORITY: Record<string, number> = {
  hr_admin: 0,
  supervisor: 1,
  executive: 2,
  supervisee: 3,
};

const ROLE_LABEL: Record<string, string> = {
  hr_admin: "HR Admin",
  supervisor: "Supervisor",
  executive: "Executive",
  supervisee: "Supervisee",
};

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const viewerMembership = await getCurrentMembership(session.user.id);
  if (!viewerMembership) redirect("/dashboard");
  // Page is open to any manager-tier role (read-only for supervisors;
  // full controls for HR Admin). Executives bounce — they're not part of
  // org management, just oversight.
  if (!isManagerRole(viewerMembership.role)) {
    redirect("/dashboard");
  }

  const isHr = isHrAdmin(viewerMembership.role);
  const canManage = canManageOrg(viewerMembership.role);

  const [org, allMemberships, supervisorAssignments, allInvitations] =
    await Promise.all([
      db.query.organizations.findFirst({
        where: eq(schema.organizations.id, viewerMembership.orgId),
      }),
      db.query.orgMemberships.findMany({
        where: eq(schema.orgMemberships.orgId, viewerMembership.orgId),
        orderBy: desc(schema.orgMemberships.createdAt),
      }),
      db.query.supervisorAssignments.findMany({
        where: and(
          eq(schema.supervisorAssignments.orgId, viewerMembership.orgId),
          eq(schema.supervisorAssignments.isPrimary, true),
          isNull(schema.supervisorAssignments.endedAt)
        ),
      }),
      db.query.invitations.findMany({
        where: eq(schema.invitations.orgId, viewerMembership.orgId),
        orderBy: desc(schema.invitations.createdAt),
      }),
    ]);
  if (!org) redirect("/dashboard");

  // Group pending (not-yet-accepted) invites by role so each section can
  // render its own outstanding invitations alongside accepted members.
  const pendingByRole = new Map<string, typeof allInvitations>();
  for (const inv of allInvitations) {
    if (inv.acceptedAt) continue;
    const list = pendingByRole.get(inv.role) ?? [];
    list.push(inv);
    pendingByRole.set(inv.role, list);
  }

  const memberIds = allMemberships.map((m) => m.userId);
  const memberUsers = memberIds.length
    ? await db.query.users.findMany({
        where: inArray(schema.users.id, memberIds),
      })
    : [];

  const sorted = allMemberships
    .map((m) => ({
      membership: m,
      user: memberUsers.find((u) => u.id === m.userId),
    }))
    .filter((e) => e.user !== undefined)
    .sort((a, b) => {
      const ap = ROLE_PRIORITY[a.membership.role] ?? 99;
      const bp = ROLE_PRIORITY[b.membership.role] ?? 99;
      if (ap !== bp) return ap - bp;
      return (a.user!.name ?? "").localeCompare(b.user!.name ?? "");
    });

  const hrAdmins = sorted.filter((e) => e.membership.role === "hr_admin");
  const supervisors = sorted.filter((e) => e.membership.role === "supervisor");
  const executives = sorted.filter((e) => e.membership.role === "executive");
  const supervisees = sorted.filter((e) => e.membership.role === "supervisee");

  const activeExecCount = executives.filter(
    (e) => !e.membership.deactivatedAt
  ).length;
  const execSeatsLeft = Math.max(0, MAX_EXECUTIVE_SEATS - activeExecCount);

  // Build a lookup of supervisee → primary supervisor for the supervisee section.
  const supervisorByUserId = new Map<string, string>();
  for (const a of supervisorAssignments) {
    if (a.superviseeId && a.supervisorId) supervisorByUserId.set(a.superviseeId, a.supervisorId);
  }

  // Active (non-deactivated) supervisor options for the reassignment dropdown.
  const activeSupervisorOptions = supervisors
    .filter((e) => !e.membership.deactivatedAt)
    .map((e) => ({
      id: e.user!.id,
      name: e.user!.name ?? e.user!.email,
    }));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="shell-eyebrow">Team</p>
          <h1 className="shell-page-title mt-1">{org.name}</h1>
          <p className="shell-page-sub max-w-2xl">
            {isHr
              ? "Invite supervisors, executives, and other HR Admins. Reassign supervisees, deactivate departing members."
              : "Your practice's team. Invitations and reassignments are HR Admin actions."}
          </p>
        </div>
        {canManage && (
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/team/import">Import team from CSV</Link>
          </Button>
        )}
      </div>

      {/* HR Admins section */}
      <Section
        title="HR Admins"
        subtitle="Full org access — billing, team management, audit log export. 2FA required for sensitive actions."
      >
        <MembersTable
          rows={hrAdmins}
          viewerId={session.user.id}
          showDeactivate={canManage}
        />
        <PendingInvitesList
          invites={pendingByRole.get("hr_admin") ?? []}
          showActions={canManage}
        />
        {canManage && (
          <div className="panel mt-4">
            <p className="label-overline mb-3">Add HR Admin</p>
            <InviteHrAdminForm />
          </div>
        )}
      </Section>

      {/* Supervisors section */}
      <Section
        title="Supervisors"
        subtitle="Credentialed clinical supervisors. Sign supervision sessions, assign state rules, run their own roster."
      >
        <MembersTable
          rows={supervisors}
          viewerId={session.user.id}
          showDeactivate={canManage}
        />
        <PendingInvitesList
          invites={pendingByRole.get("supervisor") ?? []}
          showActions={canManage}
        />
        {canManage && (
          <div className="panel mt-4">
            <p className="label-overline mb-3">Invite Supervisor</p>
            <InviteSupervisorForm />
          </div>
        )}
      </Section>

      {/* Executives section */}
      <Section
        title="Executives"
        subtitle={`Read-only oversight role. ${activeExecCount} of ${MAX_EXECUTIVE_SEATS} seats used.`}
      >
        <MembersTable
          rows={executives}
          viewerId={session.user.id}
          showDeactivate={canManage}
        />
        <PendingInvitesList
          invites={pendingByRole.get("executive") ?? []}
          showActions={canManage}
        />
        {canManage && (
          <div className="panel mt-4">
            <p className="label-overline mb-3">Invite Executive</p>
            <InviteExecutiveForm seatsLeft={execSeatsLeft} />
          </div>
        )}
      </Section>

      {/* Supervisees section (HR Admin gets supervisor-reassignment dropdown) */}
      <Section
        title="Supervisees"
        subtitle="Pre-licensed associates. Inviting happens at /dashboard/roster."
      >
        <PendingInvitesList
          invites={pendingByRole.get("supervisee") ?? []}
          showActions={canManage}
        />
        {supervisees.length === 0 ? (
          <p className="panel text-sm text-[color:var(--text-muted)] py-8 text-center">
            No supervisees yet.
          </p>
        ) : (
          <div className="panel panel-flush overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-[color:var(--border)] bg-[color:var(--surface-muted)]">
                  <th className="px-5 py-3 label-overline">Name</th>
                  <th className="px-5 py-3 label-overline">Email</th>
                  <th className="px-5 py-3 label-overline">Primary supervisor</th>
                  {canManage && <th className="px-5 py-3 label-overline">Reassign</th>}
                </tr>
              </thead>
              <tbody>
                {supervisees.map(({ membership: m, user: u }) => {
                  if (!u) return null;
                  const isSelf = u.id === session.user.id;
                  const currentSupervisorId =
                    supervisorByUserId.get(u.id) ?? null;
                  const currentSupervisor = currentSupervisorId
                    ? activeSupervisorOptions.find(
                        (s) => s.id === currentSupervisorId
                      )
                    : null;
                  return (
                    <tr
                      key={u.id}
                      className={`border-b border-[color:var(--divider)] ${m.deactivatedAt ? "opacity-50" : ""}`}
                    >
                      <td className="px-5 py-3 font-medium text-[color:var(--text-primary)]">
                        <span className="inline-flex items-center gap-2 flex-wrap">
                          {u.name ?? u.email}
                          {isSelf && <span className="status-pill status-pending">You</span>}
                          {m.deactivatedAt && <span className="status-pill status-pending">Deactivated</span>}
                          {m.leaveStatus === "on_leave" && <span className="status-pill status-warn">On leave</span>}
                          {m.leaveStatus === "prn" && <span className="status-pill status-pending">PRN</span>}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[color:var(--text-secondary)] break-all">
                        {u.email}
                      </td>
                      <td className="px-5 py-3">
                        {currentSupervisor ? (
                          <span className="text-[color:var(--text-secondary)]">
                            {currentSupervisor.name}
                          </span>
                        ) : (
                          <span className="status-pill status-warn">
                            <AlertTriangle className="h-3 w-3" />
                            Unassigned
                          </span>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-5 py-3">
                          {activeSupervisorOptions.length > 0 ? (
                            <ReassignSupervisorDropdown
                              superviseeId={u.id}
                              currentSupervisorId={currentSupervisorId}
                              supervisors={activeSupervisorOptions}
                            />
                          ) : (
                            <span className="text-xs text-[color:var(--text-muted)]">
                              Add a supervisor first
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Section wrapper + reusable members table
// ───────────────────────────────────────────────────────────────────────────

function PendingInvitesList({
  invites,
  showActions,
}: {
  invites: (typeof schema.invitations.$inferSelect)[];
  showActions: boolean;
}) {
  if (invites.length === 0) return null;
  return (
    <div className="panel panel-tight mt-3">
      <p className="label-overline mb-2">
        Pending invitations ({invites.length})
      </p>
      <ul className="space-y-2">
        {invites.map((inv) => (
          <li
            key={inv.id}
            className="flex flex-wrap items-center justify-between gap-3 text-sm"
          >
            <div className="min-w-0 flex-1">
              <span className="font-medium text-[color:var(--text-primary)]">
                {inv.name ?? <span className="text-[color:var(--text-muted)] italic">unnamed</span>}
              </span>
              <span className="ml-2 text-[color:var(--text-secondary)] break-all">
                {inv.email}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="status-pill status-pending">Pending</span>
              {showActions && (
                <PendingInviteActions invitationId={inv.id} email={inv.email} />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm text-foreground/60">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function MembersTable({
  rows,
  viewerId,
  showDeactivate,
}: {
  rows: {
    membership: typeof schema.orgMemberships.$inferSelect;
    user: typeof schema.users.$inferSelect | undefined;
  }[];
  viewerId: string;
  showDeactivate: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="panel text-sm text-[color:var(--text-muted)] py-6 text-center">
        None yet.
      </p>
    );
  }

  return (
    <div className="panel panel-flush overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="text-left border-b border-[color:var(--border)] bg-[color:var(--surface-muted)]">
            <th className="px-5 py-3 label-overline">Name</th>
            <th className="px-5 py-3 label-overline">Email</th>
            <th className="px-5 py-3 label-overline">Role</th>
            {showDeactivate && <th className="px-5 py-3 label-overline">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ membership: m, user: u }) => {
            if (!u) return null;
            const isSelf = u.id === viewerId;
            const isDeactivated = m.deactivatedAt !== null;
            return (
              <tr
                key={u.id}
                className={`border-b border-[color:var(--divider)] ${isDeactivated ? "opacity-50" : ""}`}
              >
                <td className="px-5 py-3 font-medium text-[color:var(--text-primary)]">
                  <div className="flex items-center gap-2 flex-wrap">
                    {m.role === "hr_admin" && (
                      <Shield className="h-4 w-4 text-[color:var(--seal-gold)]" strokeWidth={2} />
                    )}
                    <span>{u.name ?? u.email}</span>
                    {isSelf && <span className="status-pill status-pending">You</span>}
                    {isDeactivated && <span className="status-pill status-pending">Deactivated</span>}
                    {m.leaveStatus === "on_leave" && <span className="status-pill status-warn">On leave</span>}
                    {m.leaveStatus === "prn" && <span className="status-pill status-pending">PRN</span>}
                  </div>
                </td>
                <td className="px-5 py-3 text-[color:var(--text-secondary)] break-all">
                  {u.email}
                </td>
                <td className="px-5 py-3">
                  <span className="status-pill status-pending">{ROLE_LABEL[m.role] ?? m.role}</span>
                </td>
                {showDeactivate && (
                  <td className="px-5 py-3">
                    {isSelf || isDeactivated ? (
                      <span className="text-xs text-[color:var(--text-muted)]">—</span>
                    ) : (
                      <DeactivateMemberButton
                        membershipId={m.id}
                        userLabel={u.name ?? u.email}
                      />
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
