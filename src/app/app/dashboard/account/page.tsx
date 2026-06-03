import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canSupervise, getCurrentMembership } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NameForm } from "./name-form";
import { PasswordForm } from "./password-form";
import { EmailVerificationStatus } from "./email-verification-status";
import { EmailChangeForm } from "./email-change-form";
import { SupervisorTrainingForm } from "./supervisor-training-form";

export const metadata = { title: "Account — AuditHalo" };

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.user.id),
  });
  if (!user) redirect("/login");

  const verified = !!user.emailVerifiedAt;
  const membership = await getCurrentMembership(session.user.id);
  const userCanSupervise = !!membership && canSupervise(membership.role);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 space-y-8">
      <div>
        <p className="label-overline mb-4">Account settings</p>
        <h1 className="font-display text-3xl font-semibold text-foreground">
          Your account
        </h1>
        <p className="mt-3 text-foreground/70">
          Manage your name, password, and email verification.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span>Email</span>
            {verified ? (
              <Badge variant="success">Verified</Badge>
            ) : (
              <Badge variant="outline-warn">Not verified</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground/70">
            Signed in as <span className="font-medium text-foreground">{user.email}</span>.
          </p>
          <EmailVerificationStatus verified={verified} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <p className="label-overline mb-1">Change email</p>
          <p className="text-sm text-foreground/60 mb-4">
            Move your account to a different email address. The new address
            must be verified before the change takes effect.
          </p>
          <EmailChangeForm currentEmail={user.email} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Display name</CardTitle>
        </CardHeader>
        <CardContent>
          <NameForm currentName={user.name} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      {userCanSupervise && (
        <Card>
          <CardHeader>
            <CardTitle>Supervisor training</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground/70 mb-4">
              Some states require supervisors to complete a training course
              before supervising. CA requires 15 hours under 16 CCR §1822.
              Record your verified training hours here — they snapshot onto
              every supervision session you log.
            </p>
            <SupervisorTrainingForm
              initialHours={user.supervisorTrainingHours}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
