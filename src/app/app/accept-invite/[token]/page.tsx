import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/lib/db";
import { hashToken } from "@/lib/invitations";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/app/auth-shell";
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
      <AuthShell>
        <span className="status-pill status-risk mb-3 inline-flex">
          {expired ? "Expired" : "Invalid"}
        </span>
        <h1 className="font-display text-2xl font-semibold text-[color:var(--text-primary)] mt-1">
          {expired ? "This invitation has expired." : "Invitation not found."}
        </h1>
        <p className="text-sm text-[color:var(--text-secondary)] mt-2">
          Ask your supervisor to send a new invitation, or contact support if you think
          this is a mistake.
        </p>
      </AuthShell>
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
    <AuthShell>
      <p className="shell-eyebrow">You&apos;re invited</p>
      <h1 className="font-display text-2xl font-semibold text-[color:var(--text-primary)] mt-1">
        Join {org?.name ?? "your supervisor's roster"} on AuditHalo
      </h1>
      <p className="text-sm text-[color:var(--text-secondary)] mt-2">
        {inviter?.name ?? "Your supervisor"} has invited you ({invite.email}).
        {existingUser
          ? " Accept to add this supervision relationship to your existing AuditHalo account."
          : " Create a free account to accept and start tracking your supervised hours."}
      </p>

      {pendingRuleLabel && (
        <p className="mt-3 text-sm text-[color:var(--text-secondary)] bg-[color:var(--surface-muted)] rounded-[8px] px-3 py-2">
          You&apos;ll be enrolled under <strong>{pendingRuleLabel}</strong>.
        </p>
      )}

      <div className="mt-6">
        {isMatchingSignedInUser ? (
          <AcceptAsExistingUserForm token={token} email={invite.email} />
        ) : isMismatchedSignedIn ? (
          <div className="space-y-3">
            <p className="text-sm text-[color:var(--text-primary)]">
              You&apos;re signed in as <strong>{session?.user?.email}</strong>, but
              this invitation is addressed to <strong>{invite.email}</strong>.
            </p>
            <p className="text-sm text-[color:var(--text-secondary)]">
              Sign out, sign back in with {invite.email}, then re-open the
              invite link from your email to accept.
            </p>
            <Button asChild className="w-full">
              <Link href="/login">Switch account</Link>
            </Button>
          </div>
        ) : existingUser ? (
          <div className="space-y-3">
            <p className="text-sm text-[color:var(--text-primary)]">
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
      </div>
    </AuthShell>
  );
}
