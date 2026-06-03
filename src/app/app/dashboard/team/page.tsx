import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { getCurrentMembership, isOrgOwner } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RoleSelector } from "./role-selector";

export const metadata = { title: "Team — AuditHalo" };

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) redirect("/dashboard");

  const [org, allMemberships] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(schema.organizations.id, membership.orgId),
    }),
    db.query.orgMemberships.findMany({
      where: eq(schema.orgMemberships.orgId, membership.orgId),
    }),
  ]);
  if (!org) redirect("/dashboard");

  const memberIds = allMemberships.map((m) => m.userId);
  const memberUsers = memberIds.length
    ? await db.query.users.findMany({
        where: inArray(schema.users.id, memberIds),
      })
    : [];

  const viewerIsOwner = isOrgOwner(session.user.id, org);
  const owner = memberUsers.find((u) => u.id === org.createdById);

  // Sort: managers first, then supervisees; within each, alphabetical by name
  const sorted = allMemberships
    .map((m) => ({
      membership: m,
      user: memberUsers.find((u) => u.id === m.userId),
    }))
    .filter((e) => e.user !== undefined)
    .sort((a, b) => {
      const aIsManager = a.membership.role !== "supervisee";
      const bIsManager = b.membership.role !== "supervisee";
      if (aIsManager !== bIsManager) return aIsManager ? -1 : 1;
      return (a.user!.name ?? "").localeCompare(b.user!.name ?? "");
    });

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 sm:py-12">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/dashboard">
          <ArrowLeft />
          Back to dashboard
        </Link>
      </Button>

      <Badge variant="outline" className="mb-3">Team</Badge>
      <h1 className="font-display text-3xl sm:text-4xl font-semibold text-foreground">
        Manage roles
      </h1>

      {viewerIsOwner ? (
        <p className="mt-3 text-foreground/70">
          Promote supervisors to HR or Executive roles. HR sees a compliance heatmap;
          Executive sees a practice-wide risk rollup. Supervisee roles are managed by
          invitation, not by promotion.
        </p>
      ) : (
        <Card className="mt-6">
          <CardContent className="p-6">
            <Badge variant="warning" className="mb-3">Read-only</Badge>
            <p className="text-foreground/80">
              Only the practice owner can manage team roles. Contact{" "}
              {owner ? (
                <>
                  <span className="font-medium">{owner.name}</span> (
                  <a
                    href={`mailto:${owner.email}`}
                    className="text-secondary hover:underline"
                  >
                    {owner.email}
                  </a>
                  )
                </>
              ) : (
                "the practice owner"
              )}{" "}
              to request a role change.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="mt-8">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-accent">
                <tr className="text-left">
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(({ membership: m, user: u }) => {
                  if (!u) return null;
                  const isSelf = u.id === session.user.id;
                  const isOwnerRow = u.id === org.createdById;
                  const isSupervisee = m.role === "supervisee";
                  return (
                    <tr key={u.id} className="border-t border-border">
                      <td className="px-5 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          {isOwnerRow && (
                            <Shield className="h-4 w-4 text-[color:var(--color-gold)]" strokeWidth={1.75} />
                          )}
                          <span>{u.name}</span>
                          {isSelf && (
                            <Badge variant="outline" className="ml-2">You</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-foreground/70 break-all">
                        {u.email}
                      </td>
                      <td className="px-5 py-3">
                        {!viewerIsOwner || isSelf || isSupervisee ? (
                          <RoleBadge role={m.role} />
                        ) : (
                          <RoleSelector
                            targetUserId={u.id}
                            currentRole={m.role as "supervisor" | "hr_admin" | "executive"}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-foreground/50 text-sm">
                      No team members yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const label =
    role === "supervisor" ? "Supervisor" :
    role === "hr_admin" ? "HR Admin" :
    role === "executive" ? "Executive" :
    role === "supervisee" ? "Supervisee" :
    role;
  return <Badge variant="outline">{label}</Badge>;
}
