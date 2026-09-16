import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { canSupervise, getCurrentMembership } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { NameForm } from "./name-form";
import { PasswordForm } from "./password-form";
import { EmailVerificationStatus } from "./email-verification-status";
import { EmailChangeForm } from "./email-change-form";
import { SupervisorTrainingForm } from "./supervisor-training-form";
import { CredentialsForm } from "./credentials-form";
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
  { id: "credentials", label: "Credentials", supervisorOnly: true },
  { id: "training", label: "Supervisor training", supervisorOnly: true },
  { id: "profile", label: "Profile" },
  { id: "password", label: "Password" },
  { id: "2fa", label: "Two-factor" },
  { id: "sessions", label: "Sessions" },
  { id: "change-email", label: "Change email" },
  { id: "delete", label: "Delete account" },
];

/** One v2 panel per account section — title row (with optional status pill)
 *  over the section body. Replaces the shadcn Card/CardHeader/CardTitle stack. */
function AccountSection({
  id,
  title,
  badge,
  children,
}: {
  id: string;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="panel space-y-4 scroll-mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-[color:var(--text-primary)]">
          {title}
        </h2>
        {badge}
      </div>
      {children}
    </section>
  );
}

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
    <div className="mx-auto max-w-2xl flex flex-col gap-6">
      <div>
        <p className="shell-eyebrow">Account settings</p>
        <h1 className="shell-page-title mt-1">Your account</h1>
        <p className="shell-page-sub">
          Manage your billing, notifications, profile, and security settings.
        </p>
      </div>

      {/* Anchor nav */}
      <nav aria-label="Account sections" className="flex flex-wrap gap-1.5">
        {navItems.map((n) => (
          <a key={n.id} href={`#${n.id}`} className="chip text-xs">
            {n.label}
          </a>
        ))}
      </nav>

      {/* 1. Email + verification */}
      <AccountSection
        id="email"
        title="Email"
        badge={
          verified ? (
            <span className="status-pill status-ok">Verified</span>
          ) : (
            <span className="status-pill status-warn">Not verified</span>
          )
        }
      >
        <p className="text-sm text-[color:var(--text-secondary)]">
          Signed in as{" "}
          <span className="font-medium text-[color:var(--text-primary)]">{user.email}</span>.
        </p>
        <EmailVerificationStatus verified={verified} />
      </AccountSection>

      {/* 2. Billing & subscription — supervisor only */}
      {userCanSupervise && org && (
        <AccountSection
          id="billing"
          title="Billing & subscription"
          badge={
            org.subscriptionStatus === "active" ? (
              <span className="status-pill status-ok">Active</span>
            ) : org.subscriptionStatus === "trialing" ? (
              <span className="status-pill status-ok">Trialing</span>
            ) : org.subscriptionStatus === "past_due" ? (
              <span className="status-pill status-warn">Past due</span>
            ) : (
              <span className="status-pill status-pending">No plan</span>
            )
          }
        >
          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between gap-3">
              <dt className="text-[color:var(--text-muted)]">Plan</dt>
              <dd className="font-medium text-[color:var(--text-primary)] capitalize">
                {org.subscriptionTier ?? "—"}
              </dd>
            </div>
            {org.subscriptionPeriodEnd && (
              <div className="flex justify-between gap-3">
                <dt className="text-[color:var(--text-muted)]">Renews / ends</dt>
                <dd className="font-mono text-xs text-[color:var(--text-primary)]">
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
        </AccountSection>
      )}

      {/* 3. Notifications */}
      <AccountSection id="notifications" title="Notifications">
        <p className="text-sm text-[color:var(--text-secondary)]">
          Pick which events ping your inbox. The bell icon in the header
          always shows every notification — these toggles only control the
          email side-effect.
        </p>
        <NotificationsPrefsForm
          initialPrefs={user.notificationPrefs ?? null}
          role={membership?.role ?? null}
        />
      </AccountSection>

      {/* 4. Calendar integrations — visible to everyone (any user can
            connect their personal Microsoft or Google account for
            scheduling per docs/strategy/08). */}
      <IntegrationsResultBanner />
      <IntegrationsSection userId={user.id} />

      {/* 5. Compliance preferences — supervisor only */}
      {userCanSupervise && (
        <AccountSection id="compliance" title="Compliance preferences">
          <CompliancePrefsForm initialEnabled={user.autoApplyRuleUpdates} />
        </AccountSection>
      )}

      {/* 5. Professional credentials — supervisor only. */}
      {userCanSupervise && (
        <AccountSection
          id="credentials"
          title="Professional credentials"
          badge={
            user.credentials && user.credentials.length > 0 ? (
              <span className="status-pill status-ok">{user.credentials.join(", ")}</span>
            ) : (
              <span className="status-pill status-warn">Not set</span>
            )
          }
        >
          <p className="text-sm text-[color:var(--text-secondary)]">
            Your professional licenses and credentials (e.g. LCMHCS, NCC, LPC).
            These auto-populate when you log supervision sessions and are validated
            against your supervisees&apos; state requirements.
          </p>
          <CredentialsForm initialCredentials={user.credentials as string[] | null} />
        </AccountSection>
      )}

      {/* 6. Supervisor training — supervisor only.
            Moved up from the bottom because it's a real compliance gate
            for CA APCC + a few other states. */}
      {userCanSupervise && (
        <AccountSection
          id="training"
          title="Supervisor training"
          badge={
            user.supervisorTrainingHours !== null && user.supervisorTrainingHours > 0 ? (
              <span className="status-pill status-ok">
                {user.supervisorTrainingHours}{" "}
                {user.supervisorTrainingHours === 1 ? "hour" : "hours"} on file
              </span>
            ) : (
              <span className="status-pill status-warn">Not recorded</span>
            )
          }
        >
          <p className="text-sm text-[color:var(--text-secondary)]">
            Some states require supervisors to complete a training course
            before supervising. CA requires 15 hours under 16 CCR §1822.
            Record your verified training hours here — they snapshot onto
            every supervision session you log.
          </p>
          <SupervisorTrainingForm initialHours={user.supervisorTrainingHours} />
        </AccountSection>
      )}

      {/* 6. Profile (display name) */}
      <AccountSection id="profile" title="Display name">
        <NameForm currentName={user.name} />
      </AccountSection>

      {/* 7. Password */}
      <AccountSection id="password" title="Password">
        <PasswordForm />
      </AccountSection>

      {/* 8. 2FA */}
      <AccountSection
        id="2fa"
        title="Two-factor authentication"
        badge={
          user.totpEnabledAt ? (
            <span className="status-pill status-ok">Active</span>
          ) : (
            <span className="status-pill status-pending">Off</span>
          )
        }
      >
        {user.totpEnabledAt ? (
          <div className="space-y-4">
            <p className="text-sm text-[color:var(--text-secondary)]">
              Active since{" "}
              <span className="font-medium text-[color:var(--text-primary)]">
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
      </AccountSection>

      {/* 9. Sessions */}
      <AccountSection id="sessions" title="Sessions">
        <p className="text-sm text-[color:var(--text-secondary)]">
          Signed in on a public computer? Lost a device? Sign out of every
          device where this account is currently signed in. You&apos;ll need
          to sign in again on each device you want to keep using.
        </p>
        <SignOutEverywhereButton />
      </AccountSection>

      {/* 10. Change email (rarely touched) */}
      <AccountSection id="change-email" title="Change email">
        <p className="text-sm text-[color:var(--text-secondary)]">
          Move your account to a different email address. The new address
          must be verified before the change takes effect.
        </p>
        <EmailChangeForm currentEmail={user.email} />
      </AccountSection>

      {/* 11. Danger zone — account deletion */}
      <section
        id="delete"
        className="panel space-y-4 scroll-mt-6 border-l-[3px] border-l-[color:var(--risk-600)]"
      >
        <h2 className="font-display text-lg font-semibold text-[color:var(--risk-600)]">
          Delete account
        </h2>
        <p className="text-sm text-[color:var(--text-secondary)]">
          Permanently delete your AuditHalo account. You&apos;ll be signed out
          immediately and your data is purged after 30 days. Email{" "}
          <a href="mailto:info@audithalo.com" className="underline hover:no-underline">
            info@audithalo.com
          </a>{" "}
          inside that window if you change your mind.
        </p>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
