import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { canSupervise, getCurrentMembership } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NameForm } from "./name-form";
import { PasswordForm } from "./password-form";
import { EmailVerificationStatus } from "./email-verification-status";
import { EmailChangeForm } from "./email-change-form";
import { SupervisorTrainingForm } from "./supervisor-training-form";
import { SignOutEverywhereButton } from "./sign-out-everywhere-button";
import { TotpSetupWizard } from "./totp-setup";
import { TotpDisableForm } from "./totp-disable-form";
import { NotificationsPrefsForm } from "./notifications-prefs-form";
import { CompliancePrefsForm } from "./compliance-prefs-form";
import { DeleteAccountForm } from "./delete-account-form";
import { IntegrationsSection } from "./integrations-section";
import { IntegrationsResultBanner } from "./_integrations-result-banner";

export const metadata = { title: "Account — AuditHalo" };

/**
 * Anchor nav at the top so the user can jump to the section they care about
 * without scrolling past everything. Ordered with the most-frequently-touched
 * items first: Billing, Notifications, Training (the things a supervisor
 * actually returns to).
 */
const NAV_ITEMS: { id: string; label: string; supervisorOnly?: boolean }[] = [
  { id: "email", label: "Email" },
  { id: "billing", label: "Billing", supervisorOnly: true },
  { id: "notifications", label: "Notifications" },
  { id: "integrations", label: "Integrations" },
  { id: "compliance", label: "Compliance", supervisorOnly: true },
  { id: "training", label: "Supervisor training", supervisorOnly: true },
  { id: "profile", label: "Profile" },
  { id: "password", label: "Password" },
  { id: "2fa", label: "Two-factor" },
  { id: "sessions", label: "Sessions" },
  { id: "change-email", label: "Change email" },
  { id: "delete", label: "Delete account" },
];

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
  const org = userCanSupervise && membership
    ? await db.query.organizations.findFirst({
        where: eq(schema.organizations.id, membership.orgId),
      })
    : null;

  const navItems = NAV_ITEMS.filter(
    (n) => !n.supervisorOnly || userCanSupervise
  );

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-6 sm:py-12 space-y-6 sm:space-y-8">
      <div>
        <p className="label-overline mb-4">Account settings</p>
        <h1 className="font-display text-3xl font-semibold text-foreground">
          Your account
        </h1>
        <p className="mt-3 text-foreground/70">
          Manage your billing, notifications, profile, and security settings.
        </p>
      </div>

      {/* Anchor nav */}
      <nav
        aria-label="Account sections"
        className="-mt-2 flex flex-wrap gap-x-2 gap-y-1.5 text-xs"
      >
        {navItems.map((n) => (
          <a
            key={n.id}
            href={`#${n.id}`}
            className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-foreground/70 hover:bg-accent hover:text-foreground transition-colors"
          >
            {n.label}
          </a>
        ))}
      </nav>

      {/* 1. Email + verification */}
      <Card id="email">
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

      {/* 2. Billing & subscription — supervisor only */}
      {userCanSupervise && org && (
        <Card id="billing">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              <span>Billing & subscription</span>
              {org.subscriptionStatus === "active" ? (
                <Badge variant="success">Active</Badge>
              ) : org.subscriptionStatus === "trialing" ? (
                <Badge variant="success">Trialing</Badge>
              ) : org.subscriptionStatus === "past_due" ? (
                <Badge variant="outline-warn">Past due</Badge>
              ) : (
                <Badge variant="outline">No plan</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between gap-3">
                <dt className="text-foreground/60">Plan</dt>
                <dd className="font-medium text-foreground capitalize">
                  {org.subscriptionTier ?? "—"}
                </dd>
              </div>
              {org.subscriptionPeriodEnd && (
                <div className="flex justify-between gap-3">
                  <dt className="text-foreground/60">Renews / ends</dt>
                  <dd className="font-mono text-xs text-foreground">
                    {org.subscriptionPeriodEnd.toISOString().slice(0, 10)}
                  </dd>
                </div>
              )}
            </dl>
            <Button asChild variant="outline">
              <Link href="/dashboard/billing">
                Manage billing <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 3. Notifications */}
      <Card id="notifications">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/70 mb-4">
            Pick which events ping your inbox. The bell icon in the top nav
            always shows every notification — these toggles only control the
            email side-effect.
          </p>
          <NotificationsPrefsForm initialPrefs={user.notificationPrefs ?? null} />
        </CardContent>
      </Card>

      {/* 4. Calendar integrations — visible to everyone (any user can
            connect their personal Microsoft or Google account for
            scheduling per docs/strategy/08). */}
      <IntegrationsResultBanner />
      <IntegrationsSection userId={user.id} />

      {/* 5. Compliance preferences — supervisor only */}
      {userCanSupervise && (
        <Card id="compliance">
          <CardHeader>
            <CardTitle>Compliance preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <CompliancePrefsForm
              initialEnabled={user.autoApplyRuleUpdates}
            />
          </CardContent>
        </Card>
      )}

      {/* 5. Supervisor training — supervisor only.
            Moved up from the bottom because it's a real compliance gate
            for CA APCC + a few other states. */}
      {userCanSupervise && (
        <Card id="training">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              <span>Supervisor training</span>
              {user.supervisorTrainingHours !== null &&
              user.supervisorTrainingHours > 0 ? (
                <Badge variant="success">
                  {user.supervisorTrainingHours}{" "}
                  {user.supervisorTrainingHours === 1 ? "hour" : "hours"} on file
                </Badge>
              ) : (
                <Badge variant="outline-warn">Not recorded</Badge>
              )}
            </CardTitle>
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

      {/* 6. Profile (display name) */}
      <Card id="profile">
        <CardHeader>
          <CardTitle>Display name</CardTitle>
        </CardHeader>
        <CardContent>
          <NameForm currentName={user.name} />
        </CardContent>
      </Card>

      {/* 7. Password */}
      <Card id="password">
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      {/* 8. 2FA */}
      <Card id="2fa">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span>Two-factor authentication</span>
            {user.totpEnabledAt ? (
              <Badge variant="success">Active</Badge>
            ) : (
              <Badge variant="outline">Off</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {user.totpEnabledAt ? (
            <div className="space-y-4">
              <p className="text-sm text-foreground/70">
                Active since{" "}
                <span className="font-medium text-foreground">
                  {user.totpEnabledAt.toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                . You&apos;ll be asked for a 6-digit code from your
                authenticator app every time you sign in.
              </p>
              <TotpDisableForm />
            </div>
          ) : (
            <TotpSetupWizard />
          )}
        </CardContent>
      </Card>

      {/* 9. Sessions */}
      <Card id="sessions">
        <CardContent className="p-6">
          <p className="label-overline mb-1">Sessions</p>
          <p className="text-sm text-foreground/60 mb-4">
            Signed in on a public computer? Lost a device? Sign out of every
            device where this account is currently signed in. You&apos;ll need
            to sign in again on each device you want to keep using.
          </p>
          <SignOutEverywhereButton />
        </CardContent>
      </Card>

      {/* 10. Change email (rarely touched) */}
      <Card id="change-email">
        <CardContent className="p-6">
          <p className="label-overline mb-1">Change email</p>
          <p className="text-sm text-foreground/60 mb-4">
            Move your account to a different email address. The new address
            must be verified before the change takes effect.
          </p>
          <EmailChangeForm currentEmail={user.email} />
        </CardContent>
      </Card>

      {/* 11. Danger zone — account deletion */}
      <Card
        id="delete"
        className="border-[color:var(--color-risk)]/30 bg-[color:var(--color-risk)]/5"
      >
        <CardContent className="p-6">
          <p className="label-overline text-[color:var(--color-risk)] mb-1">
            Delete account
          </p>
          <p className="text-sm text-foreground/70 mb-4">
            Permanently delete your AuditHalo account. You&apos;ll be signed out
            immediately and your data is purged after 30 days. Email{" "}
            <a
              href="mailto:info@audithalo.com"
              className="underline hover:no-underline"
            >
              info@audithalo.com
            </a>{" "}
            inside that window if you change your mind.
          </p>
          <DeleteAccountForm />
        </CardContent>
      </Card>
    </div>
  );
}
