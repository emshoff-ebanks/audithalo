import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { hashToken } from "@/lib/invitations";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AcceptInviteForm } from "./accept-form";

export const metadata = {
  title: "Accept invite — AuditHalo",
};

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenHash = hashToken(token);

  const invite = await db.query.invitations.findFirst({
    where: and(
      eq(schema.invitations.tokenHash, tokenHash),
      isNull(schema.invitations.acceptedAt)
    ),
  });

  let org: typeof schema.organizations.$inferSelect | undefined;
  let inviter: typeof schema.users.$inferSelect | undefined;
  let expired = false;
  if (invite) {
    expired = invite.expiresAt.getTime() < Date.now();
    org = await db.query.organizations.findFirst({
      where: eq(schema.organizations.id, invite.orgId),
    });
    inviter = await db.query.users.findFirst({
      where: eq(schema.users.id, invite.invitedById),
    });
  }

  if (!invite || expired) {
    return (
      <div className="mx-auto max-w-md px-6 py-20">
        <Badge variant="risk" className="mb-4">
          {expired ? "Expired" : "Invalid"}
        </Badge>
        <h1 className="font-display text-3xl font-semibold text-foreground">
          {expired ? "This invitation has expired." : "Invitation not found."}
        </h1>
        <p className="mt-3 text-foreground/70">
          Ask your supervisor to send a new invitation, or contact support if you think
          this is a mistake.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <Badge variant="outline" className="mb-4">
        You're invited
      </Badge>
      <h1 className="font-display text-3xl font-semibold text-foreground">
        Join {org?.name ?? "your supervisor's roster"} on AuditHalo
      </h1>
      <p className="mt-3 text-foreground/70">
        {inviter?.name ?? "Your supervisor"} has invited you ({invite.email}). Create a free
        account to accept and start tracking your supervised hours.
      </p>

      <Card className="mt-8">
        <CardContent className="p-6">
          <AcceptInviteForm
            token={token}
            email={invite.email}
            suggestedName={invite.name ?? ""}
          />
        </CardContent>
      </Card>
    </div>
  );
}
