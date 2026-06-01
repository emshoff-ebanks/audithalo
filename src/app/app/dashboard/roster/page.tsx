import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InviteForm } from "./invite-form";

export const metadata = {
  title: "Roster — AuditHalo",
};

export default async function RosterPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await db.query.orgMemberships.findFirst({
    where: eq(schema.orgMemberships.userId, session.user.id),
    with: { /* placeholder for relational query if defined later */ },
  });
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

  // Fetch all members of this org
  const memberships = await db
    .select({
      userId: schema.orgMemberships.userId,
      role: schema.orgMemberships.role,
      joinedAt: schema.orgMemberships.createdAt,
      name: schema.users.name,
      email: schema.users.email,
      state: schema.users.state,
      licenseType: schema.users.licenseType,
    })
    .from(schema.orgMemberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.orgMemberships.userId))
    .where(eq(schema.orgMemberships.orgId, membership.orgId));

  // Fetch pending invitations
  const pendingInvites = await db.query.invitations.findMany({
    where: eq(schema.invitations.orgId, membership.orgId),
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/dashboard">
          <ArrowLeft />
          Back to dashboard
        </Link>
      </Button>

      <Badge variant="outline" className="mb-3">
        {org?.name ?? "Roster"}
      </Badge>
      <h1 className="font-display text-4xl font-semibold text-foreground">
        Your roster
      </h1>
      <p className="mt-3 text-foreground/70 max-w-2xl">
        Every supervisee you invite gets a free AuditHalo account. They join your roster the
        moment they accept the invitation, and you'll see their hour progress here.
      </p>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-accent">
                <tr className="text-left">
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody>
                {memberships.map((m) => (
                  <tr key={m.userId} className="border-t border-border">
                    <td className="px-5 py-3 font-medium">{m.name}</td>
                    <td className="px-5 py-3 text-foreground/70">{m.email}</td>
                    <td className="px-5 py-3 capitalize">{m.role.replace("_", " ")}</td>
                    <td className="px-5 py-3 font-mono text-xs text-foreground/60">
                      {new Date(m.joinedAt).toISOString().slice(0, 10)}
                    </td>
                  </tr>
                ))}
                {pendingInvites
                  .filter((i) => !i.acceptedAt)
                  .map((i) => (
                    <tr key={i.id} className="border-t border-border bg-[color:var(--color-evidence-bg)]/40">
                      <td className="px-5 py-3 font-medium">
                        {i.name ?? <span className="text-foreground/50 italic">unnamed</span>}
                      </td>
                      <td className="px-5 py-3 text-foreground/70">{i.email}</td>
                      <td className="px-5 py-3">
                        <Badge variant="warning">Pending</Badge>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-foreground/60">
                        invited {new Date(i.createdAt).toISOString().slice(0, 10)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="label-overline mb-3">Invite a supervisee</p>
            <InviteForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
