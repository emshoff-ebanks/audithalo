import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Shield, AlertTriangle } from "lucide-react";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import {
  canManageOrg,
  getCurrentMembership,
  isHrAdmin,
  isManagerRole,
} from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
    supervisorByUserId.set(a.superviseeId, a.supervisorId);
  }

  // Active (non-deactivated) supervisor options for the reassignment dropdown.
  const activeSupervisorOptions = supervisors
    .filter((e) => !e.membership.deactivatedAt)
    .map((e) => ({
      id: e.user!.id,
      name: e.user!.name ?? e.user!.email,
    }));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 sm:py-12">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/dashboard">
          <ArrowLeft />
          Back to dashboard
        </Link>
      </Button>

      <Badge variant="outline" className="mb-3">
        Team
      </Badge>
      <h1 className="font-display text-3xl sm:text-4xl font-semibold text-foreground">
        {org.name}
      </h1>
      <p className="mt-3 text-foreground/70 max-w-2xl">
        {isHr
          ? "Invite supervisors, executives, and other HR Admins. Reassign supervisees, deactivate departing members."
          : "Your practice's team. Invitations and reassignments are HR Admin actions."}
      </p>

      {canManage && (
        <div className="mt-5">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/team/import">
              Bulk import from HRIS (CSV)
            </Link>
          </Button>
        </div>
      )}

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
          <Card className="mt-4">
            <CardContent className="p-6">
              <p className="label-overline mb-3">Add HR Admin</p>
              <InviteHrAdminForm />
            </CardContent>
          </Card>
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
          <Card className="mt-4">
            <CardContent className="p-6">
              <p className="label-overline mb-3">Invite Supervisor</p>
              <InviteSupervisorForm />
            </CardContent>
          </Card>
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
          <Card className="mt-4">
            <CardContent className="p-6">
              <p className="label-overline mb-3">Invite Executive</p>
              <InviteExecutiveForm seatsLeft={execSeatsLeft} />
            </CardContent>
          </Card>
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
          <p className="text-sm text-foreground/50 py-8 text-center bg-card border border-border rounded-sm">
            No supervisees yet.
          </p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-accent text-left">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Name</th>
                    <th className="px-5 py-3 font-semibold">Email</th>
                    <th className="px-5 py-3 font-semibold">Primary supervisor</th>
                    {canManage && (
                      <th className="px-5 py-3 font-semibold">Reassign</th>
                    )}
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
                        className={`border-t border-border ${m.deactivatedAt ? "opacity-50" : ""}`}
                      >
                        <td className="px-5 py-3 font-medium">
                          {u.name ?? u.email}
                          {isSelf && (
                            <Badge variant="outline" className="ml-2">
                              You
                            </Badge>
                          )}
                          {m.deactivatedAt && (
                            <Badge variant="outline" className="ml-2">
                              Deactivated
                            </Badge>
                          )}
                        </td>
                        <td className="px-5 py-3 text-foreground/70 break-all">
                          {u.email}
                        </td>
                        <td className="px-5 py-3">
                          {currentSupervisor ? (
                            <span className="text-foreground/80">
                              {currentSupervisor.name}
                            </span>
                          ) : (
                            <span className="text-[color:var(--color-warning)] inline-flex items-center gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5" />
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
                              <span className="text-xs text-foreground/50">
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
            </CardContent>
          </Card>
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
    <Card className="mt-3 bg-[color:var(--color-evidence-bg)]/30">
      <CardContent className="p-4">
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
                <span className="font-medium">
                  {inv.name ?? <span className="text-foreground/50 italic">unnamed</span>}
                </span>
                <span className="ml-2 text-foreground/60 break-all">
                  {inv.email}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="warning">Pending</Badge>
                {showActions && (
                  <PendingInviteActions
                    invitationId={inv.id}
                    email={inv.email}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
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
      <p className="text-sm text-foreground/50 py-6 text-center bg-card border border-border rounded-sm">
        None yet.
      </p>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-accent text-left">
              <tr>
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold">Email</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                {showDeactivate && (
                  <th className="px-5 py-3 font-semibold">Actions</th>
                )}
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
                    className={`border-t border-border ${isDeactivated ? "opacity-50" : ""}`}
                  >
                    <td className="px-5 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        {m.role === "hr_admin" && (
                          <Shield
                            className="h-4 w-4 text-[color:var(--color-gold)]"
                            strokeWidth={1.75}
                          />
                        )}
                        <span>{u.name ?? u.email}</span>
                        {isSelf && (
                          <Badge variant="outline" className="ml-2">
                            You
                          </Badge>
                        )}
                        {isDeactivated && (
                          <Badge variant="outline" className="ml-2">
                            Deactivated
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-foreground/70 break-all">
                      {u.email}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant="outline">
                        {ROLE_LABEL[m.role] ?? m.role}
                      </Badge>
                    </td>
                    {showDeactivate && (
                      <td className="px-5 py-3">
                        {isSelf || isDeactivated ? (
                          <span className="text-xs text-foreground/40">—</span>
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
      </CardContent>
    </Card>
  );
}
