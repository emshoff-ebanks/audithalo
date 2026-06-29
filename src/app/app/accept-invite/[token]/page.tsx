import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/lib/db";
import { hashToken } from "@/lib/invitations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loadAllRules } from "@/lib/rules";
import { AcceptInviteForm } from "./accept-form";
import { AcceptAsExistingUserForm } from "./accept-existing-form";

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

  const [invite, session] = await Promise.all([
    db.query.invitations.findFirst({
      where: and(
        eq(schema.invitations.tokenHash, tokenHash),
        isNull(schema.invitations.acceptedAt)
      ),
    }),
    auth(),
  ]);

  let org: typeof schema.organizations.$inferSelect | undefined;
  let inviter: typeof schema.users.$inferSelect | undefined;
  let existingUser: typeof schema.users.$inferSelect | undefined;
  let expired = false;
  if (invite) {
    expired = invite.expiresAt.getTime() < Date.now();
    [org, inviter, existingUser] = await Promise.all([
      db.query.organizations.findFirst({
        where: eq(schema.organizations.id, invite.orgId),
      }),
      db.query.users.findFirst({
        where: eq(schema.users.id, invite.invitedById),
      }),
      db.query.users.findFirst({
        where: eq(schema.users.email, invite.email.toLowerCase()),
      }),
    ]);
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

  // Look up the rule label so we can show "Joining: NC LCMHCA v1" up top.
  let pendingRuleLabel: string | null = null;
  if (invite.pendingRuleId) {
    const rule = loadAllRules().get(invite.pendingRuleId.toLowerCase());
    if (rule) {
      pendingRuleLabel = `${rule.jurisdiction} ${rule.license_code} v${rule.version}`;
    }
  }

  // Three branches:
  //   1. existing user signed in as the invitee's email — render a one-click
  //      accept form (no password, no name).
  //   2. existing user but signed in as a different email (or not signed in
  //      at all) — prompt them to sign in with the invitee's email first.
  //   3. no existing user — render the new-account creation form.
  const signedInEmail = session?.user?.email?.toLowerCase();
  const inviteEmail = invite.email.toLowerCase();
  const isMatchingSignedInUser =
    !!existingUser && !!signedInEmail && signedInEmail === inviteEmail;
  const isMismatchedSignedIn =
    !!existingUser && !!signedInEmail && signedInEmail !== inviteEmail;

  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <Badge variant="outline" className="mb-4">
        You&apos;re invited
      </Badge>
      <h1 className="font-display text-3xl font-semibold text-foreground">
        Join {org?.name ?? "your supervisor's roster"} on AuditHalo
      </h1>
      <p className="mt-3 text-foreground/70">
        {inviter?.name ?? "Your supervisor"} has invited you ({invite.email}).
        {existingUser
          ? " Accept to add this supervision relationship to your existing AuditHalo account."
          : " Create a free account to accept and start tracking your supervised hours."}
      </p>

      {pendingRuleLabel && (
        <p className="mt-3 text-sm text-foreground/60 bg-accent/40 rounded-sm px-3 py-2">
          You&apos;ll be enrolled under <strong>{pendingRuleLabel}</strong>.
        </p>
      )}

      <Card className="mt-8">
        <CardContent className="p-6">
          {isMatchingSignedInUser ? (
            <AcceptAsExistingUserForm token={token} email={invite.email} />
          ) : isMismatchedSignedIn ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground/80">
                You&apos;re signed in as{" "}
                <strong>{session?.user?.email}</strong>, but this invitation is
                addressed to <strong>{invite.email}</strong>.
              </p>
              <p className="text-sm text-foreground/60">
                Sign out, sign back in with {invite.email}, then re-open the
                invite link from your email to accept.
              </p>
              <Button asChild className="w-full">
                <Link href="/login">Switch account</Link>
              </Button>
            </div>
          ) : existingUser ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground/80">
                You already have an AuditHalo account. Sign in with {invite.email},
                then re-open this invitation link from your email to accept it.
              </p>
              <Button asChild className="w-full">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          ) : (
            <AcceptInviteForm
              token={token}
              email={invite.email}
              suggestedName={invite.name ?? ""}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
