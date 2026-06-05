import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { NotificationKind, NotificationPrefs } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";

const APP_URL = process.env.APP_URL ?? "https://app.audithalo.com";
const FROM_FOOTER = `<p style="font-size:12px;color:#5f6470;margin-top:24px;">You're receiving this email because the AuditHalo notification for "<KIND>" is enabled on your account. Manage preferences: <a href="${APP_URL}/dashboard/account#notifications">Account → Notifications</a>.</p>`;

/**
 * Default per-kind email preferences. Used when a user row has no
 * notificationPrefs persisted yet (NULL).
 *
 * supervisor_rule_not_set defaults to OFF because it's a daily cron — best
 * surfaced in the bell, not the inbox, until the user opts in.
 */
export const NOTIFICATION_DEFAULTS: Required<NotificationPrefs> = {
  email: {
    invite_accepted: true,
    signature_needed: true,
    rule_changed: true,
    evidence_sealed: true,
    supervisor_rule_not_set: false,
    attestation_overdue: true,
  },
};

/** Resolve effective email pref for a user/kind, falling back to defaults. */
export function emailEnabled(
  kind: NotificationKind,
  prefs: NotificationPrefs | null
): boolean {
  const userVal = prefs?.email?.[kind];
  if (typeof userVal === "boolean") return userVal;
  return NOTIFICATION_DEFAULTS.email[kind] ?? false;
}

type CreateNotificationInput = {
  userId: string;
  kind: NotificationKind;
  payload: Record<string, unknown>;
};

/**
 * Write a notification row and (when the user opts in) send the email.
 * Email failures are swallowed — they must never fail the action that
 * triggered the notification.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<void> {
  const dryRun = process.env.NOTIFICATION_DRY_RUN === "1";

  const [row] = await db
    .insert(schema.notifications)
    .values({
      userId: input.userId,
      kind: input.kind,
      payload: input.payload,
    })
    .returning();

  // Look up the user's email + prefs so we can send the email side-effect.
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, input.userId),
    columns: { email: true, name: true, notificationPrefs: true },
  });
  if (!user) return;
  if (!emailEnabled(input.kind, user.notificationPrefs)) return;
  if (dryRun) return;

  const tpl = renderEmail(input.kind, input.payload, user.name);
  try {
    await sendEmail({
      to: user.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });
    await db
      .update(schema.notifications)
      .set({ emailedAt: new Date() })
      .where(eq(schema.notifications.id, row.id));
  } catch (err) {
    console.error(`[notifications] email ${input.kind} failed:`, err);
  }
}

/** Bell-icon query: 20 most recent unread for one user. */
export async function listUnreadNotifications(userId: string, limit = 20) {
  return db
    .select()
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, userId),
        isNull(schema.notifications.readAt)
      )
    )
    .orderBy(desc(schema.notifications.createdAt))
    .limit(limit);
}

export async function countUnread(userId: string): Promise<number> {
  const rows = await db
    .select({ id: schema.notifications.id })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, userId),
        isNull(schema.notifications.readAt)
      )
    );
  return rows.length;
}

// ---------------------------------------------------------------------------
// Email rendering — kind-specific subject + html + text.
// Inline styles only (email clients).
// ---------------------------------------------------------------------------

type EmailTemplate = { subject: string; html: string; text: string };

function shell(opts: { heading: string; body: string; ctaHref?: string; ctaLabel?: string; kind: NotificationKind }) {
  const cta = opts.ctaHref && opts.ctaLabel
    ? `<p style="margin: 32px 0;">
        <a href="${opts.ctaHref}" style="display: inline-block; padding: 12px 24px; background:#071A3D; color:#FBFAF6; text-decoration:none; font-weight:600; border-radius: 4px;">
          ${opts.ctaLabel}
        </a>
      </p>`
    : "";
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#08111F; max-width: 560px;">
      <h2 style="font-size: 22px; margin: 0 0 16px;">${opts.heading}</h2>
      ${opts.body}
      ${cta}
      ${FROM_FOOTER.replace("<KIND>", opts.kind.replace(/_/g, " "))}
    </div>
  `;
}

function renderEmail(
  kind: NotificationKind,
  payload: Record<string, unknown>,
  recipientName: string | null
): EmailTemplate {
  const greeting = recipientName ? `Hi ${recipientName},` : "Hi,";
  switch (kind) {
    case "invite_accepted": {
      const supervisee = String(payload.superviseeName ?? "your supervisee");
      const url = `${APP_URL}/dashboard/roster`;
      return {
        subject: `${supervisee} accepted your AuditHalo invite`,
        html: shell({
          heading: `${supervisee} is on your roster.`,
          body: `<p>${greeting} ${supervisee} accepted your invitation. They now show up on your roster — assign their state rule so hour tracking begins.</p>`,
          ctaHref: url,
          ctaLabel: "Open roster",
          kind,
        }),
        text: `${greeting} ${supervisee} accepted your AuditHalo invitation. Open your roster: ${url}`,
      };
    }
    case "signature_needed": {
      const sessionId = String(payload.sessionId ?? "");
      const url = `${APP_URL}/sign/${sessionId}`;
      return {
        subject: "A supervision session needs your signature",
        html: shell({
          heading: "Signature needed",
          body: `<p>${greeting} a supervision session is awaiting your signature.</p>`,
          ctaHref: url,
          ctaLabel: "Open session",
          kind,
        }),
        text: `${greeting} a supervision session needs your signature. ${url}`,
      };
    }
    case "rule_changed": {
      const oldRule = String(payload.oldRuleLabel ?? "");
      const newRule = String(payload.newRuleLabel ?? "");
      const url = `${APP_URL}/dashboard`;
      return {
        subject: `Your supervision rule version changed to ${newRule}`,
        html: shell({
          heading: "Your state rule version changed",
          body: `<p>${greeting} your supervision is now tracked against <strong>${newRule}</strong> (previously ${oldRule}). Your evidence packages remain valid.</p>`,
          ctaHref: url,
          ctaLabel: "Open dashboard",
          kind,
        }),
        text: `${greeting} your supervision rule changed from ${oldRule} to ${newRule}. ${url}`,
      };
    }
    case "evidence_sealed": {
      const packageId = String(payload.packageId ?? "");
      const url = `${APP_URL}/api/evidence/${packageId}`;
      return {
        subject: "Evidence package sealed",
        html: shell({
          heading: "Evidence package sealed.",
          body: `<p>${greeting} a supervision session has been sealed into an audit-ready evidence package. The PDF is now downloadable.</p>`,
          ctaHref: url,
          ctaLabel: "Download PDF",
          kind,
        }),
        text: `${greeting} an evidence package was sealed. Download: ${url}`,
      };
    }
    case "supervisor_rule_not_set": {
      const supervisee = String(payload.superviseeName ?? "a supervisee");
      const url = `${APP_URL}/dashboard/roster`;
      return {
        subject: `${supervisee} is missing a state rule`,
        html: shell({
          heading: "A supervisee is missing a state rule.",
          body: `<p>${greeting} ${supervisee} accepted your invite, but their state rule hasn't been assigned yet. Hour tracking and at-risk flags only start once a rule is assigned.</p>`,
          ctaHref: url,
          ctaLabel: "Assign rule",
          kind,
        }),
        text: `${greeting} ${supervisee} needs a state rule assigned. ${url}`,
      };
    }
    case "attestation_overdue": {
      const checkId = String(payload.checkId ?? "");
      const supervisee = String(payload.superviseeName ?? "a supervisee");
      const url = `${APP_URL}/dashboard/roster`;
      return {
        subject: "Overdue compliance attestation",
        html: shell({
          heading: "A blocker-severity gap is over 7 days old.",
          body: `<p>${greeting} ${supervisee} has had the <strong>${checkId}</strong> blocker open for more than a week. Resolve it before the next evaluation.</p>`,
          ctaHref: url,
          ctaLabel: "Open roster",
          kind,
        }),
        text: `${greeting} ${supervisee} has an overdue ${checkId} gap. ${url}`,
      };
    }
  }
}
