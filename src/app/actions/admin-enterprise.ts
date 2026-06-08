"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit-log";
import { sendEmail } from "@/lib/email";
import {
  generateAuthToken,
  hashAuthToken,
  passwordResetExpiresAt,
} from "@/lib/auth-tokens";

const APP_URL = process.env.APP_URL ?? "https://app.audithalo.com";

const promoteSchema = z.object({
  orgId: z.string().uuid(),
});

export type AdminEnterpriseResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Promote an org to Enterprise.
 *
 * Manual admin action — Damon runs this after signing an Enterprise
 * contract. Sets organizations.subscription_tier = 'enterprise' and
 * auto-promotes the org owner's membership role from 'supervisor' to
 * 'hr_admin' so they immediately gain access to /dashboard/team,
 * /dashboard/settings, /admin/founding-supervisors equivalents, etc.
 *
 * The pre-purchase warning lives on the marketing /pricing page so the
 * supervisor knows their account turns into an HR Admin account when
 * they buy Enterprise (the locked decision per Damon).
 *
 * Sends a welcome-to-Enterprise email so the new HR Admin knows what
 * just changed about their account.
 */
export async function promoteOrgToEnterpriseAction(
  _prev: AdminEnterpriseResult | undefined,
  formData: FormData
): Promise<AdminEnterpriseResult> {
  const session = await auth();
  if (!session?.user || !isAdminEmail(session.user.email)) {
    return { ok: false, error: "Not found." };
  }

  const parsed = promoteSchema.safeParse({
    orgId: formData.get("orgId"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid org id." };

  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, parsed.data.orgId),
    columns: { id: true, name: true, createdById: true, subscriptionTier: true },
  });
  if (!org) return { ok: false, error: "Org not found." };
  if (org.subscriptionTier === "enterprise") {
    return { ok: false, error: "Org is already Enterprise." };
  }

  // 1. Bump the tier.
  await db
    .update(schema.organizations)
    .set({ subscriptionTier: "enterprise" })
    .where(eq(schema.organizations.id, org.id));

  // 2. Promote the org creator to HR Admin (if they currently have a
  //    supervisor membership — covers both Solo and Practice supervisors).
  const ownerMembership = await db.query.orgMemberships.findFirst({
    where: and(
      eq(schema.orgMemberships.orgId, org.id),
      eq(schema.orgMemberships.userId, org.createdById)
    ),
  });
  let promoted = false;
  if (ownerMembership && ownerMembership.role === "supervisor") {
    await db
      .update(schema.orgMemberships)
      .set({ role: "hr_admin" })
      .where(eq(schema.orgMemberships.id, ownerMembership.id));
    // Sync users.role too — the JWT pulls `role` from users.role at sign-in
    // (see auth.ts), and downstream guards like `requireHrAdmin()` read
    // session.user.role. If we only updated org_memberships.role the
    // promoted user would be blocked from HR-only routes until they were
    // manually promoted in two places. Bumping sessionsValidFrom alone
    // would NOT fix this — the JWT issued on next sign-in still reads
    // users.role.
    await db
      .update(schema.users)
      .set({ role: "hr_admin", sessionsValidFrom: new Date() })
      .where(eq(schema.users.id, org.createdById));
    promoted = true;
  }

  try {
    await logAuditEvent({
      orgId: org.id,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.MEMBER_ROLE_CHANGED,
      resourceType: "organization",
      resourceId: org.id,
      details: {
        change: "enterprise_promotion",
        ownerUserId: org.createdById,
        ownerPromotedToHrAdmin: promoted,
      },
    });
  } catch (err) {
    console.error("[admin-enterprise] audit failed:", err);
  }

  // 3. Welcome-to-Enterprise email to the owner. Non-blocking.
  try {
    const owner = await db.query.users.findFirst({
      where: eq(schema.users.id, org.createdById),
      columns: { email: true, name: true },
    });
    if (owner) {
      const greeting = owner.name ? `Hi ${owner.name},` : "Hi,";
      await sendEmail({
        to: owner.email,
        subject: "AuditHalo Enterprise — your account just upgraded",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#08111F; max-width: 560px;">
            <h2 style="font-size: 22px; margin: 0 0 16px;">Welcome to Enterprise.</h2>
            <p style="font-size: 16px; line-height: 1.6;">
              ${greeting} we just promoted <strong>${org.name}</strong> to
              the Enterprise tier. ${
                promoted
                  ? "Your account is now an <strong>HR Admin</strong> — you can manage your team, billing, audit log export, and integrations at /dashboard/team and /dashboard/settings."
                  : "No role change needed on your account."
              }
            </p>
            ${
              promoted
                ? `<p style="font-size: 16px; line-height: 1.6;">
                     <strong>Heads up:</strong> HR Admin doesn&apos;t sign supervision
                     sessions — that's the clinical role. If you also supervise
                     clinically, please create a separate Supervisor account with
                     a different email and invite it into the org from
                     /dashboard/team.
                   </p>`
                : ""
            }
            <p style="margin: 32px 0;">
              <a href="${APP_URL}/dashboard/team" style="display: inline-block; padding: 12px 24px; background:#071A3D; color:#FBFAF6; text-decoration:none; font-weight:600; border-radius: 4px;">
                Open your team page
              </a>
            </p>
            <p style="font-size: 13px; color: #5f6470;">
              Reach me at info@audithalo.com if anything's off.<br/>
              — Damon, founder, AuditHalo
            </p>
          </div>
        `,
        text:
          `${greeting} we promoted ${org.name} to Enterprise. ` +
          (promoted
            ? `Your account is now an HR Admin — you can manage your team, billing, audit log export, and integrations. ` +
              `Heads up: HR Admin doesn't sign supervision sessions (clinical role). If you also supervise, create a separate Supervisor account.\n\n`
            : ``) +
          `Open your team page: ${APP_URL}/dashboard/team\n\n— Damon, founder, AuditHalo`,
      });
    }
  } catch (err) {
    console.error("[admin-enterprise] welcome email failed:", err);
  }

  revalidatePath("/admin/orgs");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ───────────────────────────────────────────────────────────────────────────
// Tier 2 — Provision Enterprise org from scratch
// ───────────────────────────────────────────────────────────────────────────

const provisionSchema = z.object({
  customerEmail: z.string().email("Valid customer email required."),
  customerName: z.string().min(1, "Customer name is required.").max(100),
  orgName: z.string().min(1, "Organization name is required.").max(120),
});

/**
 * Create a brand-new Enterprise org for a customer who hasn't registered
 * yet. Damon uses this after a sales call closes — type the customer's
 * email + org name, click submit, the customer gets a welcome email
 * with a password-reset link to land on their already-HR-Admin account.
 *
 * Skips the customer self-registration step entirely. Idempotency: refuses
 * to create if the email already exists (we don't silently bind an
 * Enterprise membership to someone's existing Solo org without intent).
 */
export async function provisionEnterpriseOrgAction(
  _prev: AdminEnterpriseResult | undefined,
  formData: FormData
): Promise<AdminEnterpriseResult> {
  const session = await auth();
  if (!session?.user || !isAdminEmail(session.user.email)) {
    return { ok: false, error: "Not found." };
  }

  const parsed = provisionSchema.safeParse({
    customerEmail: formData.get("customerEmail"),
    customerName: formData.get("customerName"),
    orgName: formData.get("orgName"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const email = parsed.data.customerEmail.toLowerCase().trim();

  // Reject if email already exists — operator should use /admin/orgs
  // promote flow instead, which intentionally preserves the existing org.
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });
  if (existing) {
    return {
      ok: false,
      error:
        "That email already has an account. Find their org in the table below and use Promote to Enterprise instead.",
    };
  }

  // Create user with a random unguessable password — they'll set their
  // real one via the password-reset link in the welcome email.
  const placeholderPassword = randomBytes(32).toString("hex");
  const passwordHash = await bcrypt.hash(placeholderPassword, 12);

  const [user] = await db
    .insert(schema.users)
    .values({
      email,
      name: parsed.data.customerName,
      passwordHash,
      role: "hr_admin",
      emailVerifiedAt: new Date(),
    })
    .returning();

  const [org] = await db
    .insert(schema.organizations)
    .values({
      name: parsed.data.orgName,
      createdById: user.id,
      subscriptionTier: "enterprise",
      subscriptionStatus: "active",
    })
    .returning();

  await db.insert(schema.orgMemberships).values({
    orgId: org.id,
    userId: user.id,
    role: "hr_admin",
  });

  await db
    .insert(schema.orgSettings)
    .values({ orgId: org.id })
    .onConflictDoNothing();

  // Password-reset token so the customer can set their own password.
  const rawToken = generateAuthToken();
  await db.insert(schema.authTokens).values({
    userId: user.id,
    kind: "password_reset",
    tokenHash: hashAuthToken(rawToken),
    email,
    expiresAt: passwordResetExpiresAt(),
  });

  try {
    await logAuditEvent({
      orgId: org.id,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.MEMBER_ROLE_CHANGED,
      resourceType: "organization",
      resourceId: org.id,
      details: {
        change: "enterprise_provisioned",
        ownerUserId: user.id,
        provisionedBy: session.user.email,
      },
    });
  } catch (err) {
    console.error("[admin-enterprise] provision audit failed:", err);
  }

  try {
    const setPasswordUrl = `${APP_URL}/reset-password/${rawToken}`;
    await sendEmail({
      to: email,
      subject: "Welcome to AuditHalo Enterprise — set your password",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#08111F; max-width: 560px;">
          <h2 style="font-size: 22px; margin: 0 0 16px;">Welcome to AuditHalo Enterprise.</h2>
          <p style="font-size: 16px; line-height: 1.6;">
            Hi ${parsed.data.customerName}, your <strong>${org.name}</strong>
            Enterprise account is ready. You're set up as the HR Admin —
            manage your team, billing, audit log, and integrations from one
            place.
          </p>
          <p style="font-size: 16px; line-height: 1.6;">
            Click below to set your password. The link expires in 24 hours;
            request a new one any time at ${APP_URL}/forgot-password.
          </p>
          <p style="margin: 28px 0;">
            <a href="${setPasswordUrl}" style="display: inline-block; padding: 12px 24px; background:#071A3D; color:#FBFAF6; text-decoration:none; font-weight:600; border-radius: 4px;">
              Set your password
            </a>
          </p>
          <p style="font-size: 12px; color: #5f6470;">
            Or copy this link: ${setPasswordUrl}
          </p>
          <p style="font-size: 13px; color: #5f6470; margin-top: 24px;">
            Reach me at info@audithalo.com if anything's off.<br/>
            — Damon, founder, AuditHalo
          </p>
        </div>
      `,
      text:
        `Hi ${parsed.data.customerName}, your ${org.name} Enterprise account is ready. ` +
        `You're set up as the HR Admin. Set your password: ${setPasswordUrl}\n\n` +
        `Link expires in 24 hours. Request a new one at ${APP_URL}/forgot-password\n\n` +
        `— Damon, founder, AuditHalo`,
    });
  } catch (err) {
    console.error("[admin-enterprise] welcome email failed:", err);
  }

  revalidatePath("/admin/orgs");
  return { ok: true };
}
