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
    trial_ending_soon: true,
    session_scheduled: true,
    session_canceled: true,
    session_rescheduled: true,
    session_reminder_1hour: true,
    session_reminder_15min: false,
    session_no_show: true,
    // In-app reminder is the primary surface; email default off since the
    // supervisor is typically already in the app within minutes of the
    // meeting ending. Users can opt into email via their notification prefs.
    session_sign_reminder: false,
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

/**
 * Escape HTML special characters in user-supplied strings before interpolating
 * them into an email body. Defensive: payload values come from the actor's
 * account name / email / typed values, which are trusted-ish but not
 * adversarial-proof. Belt-and-suspenders for cases where a name like
 * "<script>alert(1)</script>" makes it through somewhere upstream.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
  // recipientName comes from the users table and is interpolated raw into
  // the greeting both in HTML (escaped) and plaintext (unchanged).
  const safeRecipient = recipientName ? esc(recipientName) : null;
  const greetingHtml = safeRecipient ? `Hi ${safeRecipient},` : "Hi,";
  const greetingText = recipientName ? `Hi ${recipientName},` : "Hi,";
  switch (kind) {
    case "invite_accepted": {
      const supervisee = String(payload.superviseeName ?? "your supervisee");
      const url = `${APP_URL}/dashboard/roster`;
      return {
        subject: `${supervisee} accepted your AuditHalo invite`,
        html: shell({
          heading: `${esc(supervisee)} is on your roster.`,
          body: `<p>${greetingHtml} ${esc(supervisee)} accepted your invitation. They now show up on your roster — assign their state rule so hour tracking begins.</p>`,
          ctaHref: url,
          ctaLabel: "Open roster",
          kind,
        }),
        text: `${greetingText} ${supervisee} accepted your AuditHalo invitation. Open your roster: ${url}`,
      };
    }
    case "signature_needed": {
      const sessionId = String(payload.sessionId ?? "");
      const url = `${APP_URL}/sign/${sessionId}`;
      return {
        subject: "A supervision session needs your signature",
        html: shell({
          heading: "Signature needed",
          body: `<p>${greetingHtml} a supervision session is awaiting your signature.</p>`,
          ctaHref: url,
          ctaLabel: "Open session",
          kind,
        }),
        text: `${greetingText} a supervision session needs your signature. ${url}`,
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
          body: `<p>${greetingHtml} your supervision is now tracked against <strong>${esc(newRule)}</strong> (previously ${esc(oldRule)}). Your evidence packages remain valid.</p>`,
          ctaHref: url,
          ctaLabel: "Open dashboard",
          kind,
        }),
        text: `${greetingText} your supervision rule changed from ${oldRule} to ${newRule}. ${url}`,
      };
    }
    case "evidence_sealed": {
      const packageId = String(payload.packageId ?? "");
      const url = `${APP_URL}/api/evidence/${packageId}`;
      return {
        subject: "Evidence package sealed",
        html: shell({
          heading: "Evidence package sealed.",
          body: `<p>${greetingHtml} a supervision session has been sealed into an audit-ready evidence package. The PDF is now downloadable.</p>`,
          ctaHref: url,
          ctaLabel: "Download PDF",
          kind,
        }),
        text: `${greetingText} an evidence package was sealed. Download: ${url}`,
      };
    }
    case "supervisor_rule_not_set": {
      const supervisee = String(payload.superviseeName ?? "a supervisee");
      const url = `${APP_URL}/dashboard/roster`;
      return {
        subject: `${supervisee} is missing a state rule`,
        html: shell({
          heading: "A supervisee is missing a state rule.",
          body: `<p>${greetingHtml} ${esc(supervisee)} accepted your invite, but their state rule hasn't been assigned yet. Hour tracking and at-risk flags only start once a rule is assigned.</p>`,
          ctaHref: url,
          ctaLabel: "Assign rule",
          kind,
        }),
        text: `${greetingText} ${supervisee} needs a state rule assigned. ${url}`,
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
          body: `<p>${greetingHtml} ${esc(supervisee)} has had the <strong>${esc(checkId)}</strong> blocker open for more than a week. Resolve it before the next evaluation.</p>`,
          ctaHref: url,
          ctaLabel: "Open roster",
          kind,
        }),
        text: `${greetingText} ${supervisee} has an overdue ${checkId} gap. ${url}`,
      };
    }
    case "trial_ending_soon": {
      const daysLeft = Number(payload.daysLeft ?? 3);
      const trialEndsAt = String(payload.trialEndsAt ?? "");
      const url = `${APP_URL}/dashboard/billing`;
      const dayWord = daysLeft === 1 ? "day" : "days";
      return {
        subject: `Your AuditHalo trial ends in ${daysLeft} ${dayWord}`,
        html: shell({
          heading: `Your trial ends in ${daysLeft} ${dayWord}.`,
          body: `<p>${greetingHtml} your 14-day AuditHalo trial ends on <strong>${esc(trialEndsAt)}</strong>. Add a payment method to keep tracking supervised hours, signing sessions, and producing evidence packages. Your data stays in place either way.</p>`,
          ctaHref: url,
          ctaLabel: "Add payment method",
          kind,
        }),
        text: `${greetingText} your AuditHalo trial ends ${trialEndsAt} (${daysLeft} ${dayWord} from now). Add a payment method: ${url}`,
      };
    }
    case "session_scheduled": {
      const sessionId = String(payload.sessionId ?? "");
      const scheduledForLocal = String(payload.scheduledForLocal ?? "");
      const supervisorName = String(payload.supervisorName ?? "your supervisor");
      const meetingProvider = String(payload.meetingProvider ?? "in_person");
      const url = `${APP_URL}/sign/${sessionId}`;
      const where =
        meetingProvider === "teams"
          ? "Microsoft Teams"
          : meetingProvider === "google_meet"
            ? "Google Meet"
            : meetingProvider === "in_person"
              ? "In person"
              : meetingProvider;
      return {
        subject: `Supervision scheduled — ${scheduledForLocal}`,
        html: shell({
          heading: "A supervision session is on the calendar.",
          body: `<p>${greetingHtml} ${esc(supervisorName)} scheduled a supervision session with you for <strong>${esc(scheduledForLocal)}</strong> (${esc(where)}). The calendar invite has been sent to your inbox; you can also join from AuditHalo when the time comes.</p>`,
          ctaHref: url,
          ctaLabel: "Open session",
          kind,
        }),
        text: `${greetingText} ${supervisorName} scheduled supervision for ${scheduledForLocal} (${where}). Open: ${url}`,
      };
    }
    case "session_rescheduled": {
      const sessionId = String(payload.sessionId ?? "");
      const oldLocal = String(payload.oldScheduledForLocal ?? "");
      const newLocal = String(payload.newScheduledForLocal ?? "");
      const rescheduledByName = String(
        payload.rescheduledByName ?? "your supervisor"
      );
      const url = `${APP_URL}/sign/${sessionId}`;
      return {
        subject: `Supervision moved — now ${newLocal}`,
        html: shell({
          heading: "Your supervision session was rescheduled.",
          body: `<p>${greetingHtml} ${esc(rescheduledByName)} moved the supervision session from <strong>${esc(oldLocal)}</strong> to <strong>${esc(newLocal)}</strong>. The calendar invite has been updated.</p>`,
          ctaHref: url,
          ctaLabel: "Open session",
          kind,
        }),
        text: `${greetingText} ${rescheduledByName} moved the supervision session from ${oldLocal} to ${newLocal}. Open: ${url}`,
      };
    }
    case "session_reminder_1hour":
    case "session_reminder_15min": {
      const minutesAway = kind === "session_reminder_1hour" ? 60 : 15;
      const sessionId = String(payload.sessionId ?? "");
      const scheduledForLocal = String(payload.scheduledForLocal ?? "");
      const joinUrl =
        typeof payload.joinUrl === "string" && payload.joinUrl
          ? payload.joinUrl
          : `${APP_URL}/sign/${sessionId}`;
      const where =
        payload.meetingProvider === "teams"
          ? "Microsoft Teams"
          : payload.meetingProvider === "google_meet"
            ? "Google Meet"
            : "In person";
      const subj =
        minutesAway === 60
          ? `Supervision in an hour — ${scheduledForLocal}`
          : `Supervision in 15 minutes — ${scheduledForLocal}`;
      return {
        subject: subj,
        html: shell({
          heading:
            minutesAway === 60
              ? "Your supervision session starts in about an hour."
              : "Your supervision session starts in about 15 minutes.",
          body: `<p>${greetingHtml} just a heads-up — the session is set for <strong>${esc(scheduledForLocal)}</strong> (${esc(where)}).</p>`,
          ctaHref: joinUrl,
          ctaLabel:
            payload.meetingProvider === "in_person"
              ? "Open session"
              : "Join meeting",
          kind,
        }),
        text: `${greetingText} your supervision session starts in about ${minutesAway} minutes (${scheduledForLocal}, ${where}). ${joinUrl}`,
      };
    }
    case "session_no_show": {
      const superviseeName = String(
        payload.superviseeName ?? "your supervisee"
      );
      const scheduledForLocal = String(payload.scheduledForLocal ?? "");
      const url = `${APP_URL}/dashboard/roster`;
      return {
        subject: `No-show flagged — ${superviseeName}`,
        html: shell({
          heading: "Scheduled session marked as a no-show.",
          body: `<p>${greetingHtml} ${esc(superviseeName)} had a supervision session scheduled for <strong>${esc(scheduledForLocal)}</strong> that was never marked complete. AuditHalo flagged it as a no-show. No compliance hours were credited. Reach out to reschedule when you're ready.</p>`,
          ctaHref: url,
          ctaLabel: "Open roster",
          kind,
        }),
        text: `${greetingText} ${superviseeName}'s ${scheduledForLocal} supervision was flagged as a no-show. Open: ${url}`,
      };
    }
    case "session_canceled": {
      const scheduledForLocal = String(payload.scheduledForLocal ?? "");
      const canceledByName = String(payload.canceledByName ?? "your supervisor");
      const url = `${APP_URL}/dashboard/roster`;
      return {
        subject: `Supervision canceled — ${scheduledForLocal}`,
        html: shell({
          heading: "Supervision session canceled.",
          body: `<p>${greetingHtml} ${esc(canceledByName)} canceled the supervision session previously scheduled for <strong>${esc(scheduledForLocal)}</strong>. The calendar invite has been withdrawn. Reach out to reschedule when you're ready.</p>`,
          ctaHref: url,
          ctaLabel: "Open AuditHalo",
          kind,
        }),
        text: `${greetingText} ${canceledByName} canceled the supervision session scheduled for ${scheduledForLocal}. Reach out to reschedule.`,
      };
    }
    case "session_sign_reminder": {
      const superviseeName = String(
        payload.superviseeName ?? "your supervisee"
      );
      const scheduledForLocal = String(payload.scheduledForLocal ?? "");
      const sessionId = String(payload.sessionId ?? "");
      const url = `${APP_URL}/sign/${sessionId}`;
      return {
        subject: `Time to sign — ${superviseeName} (${scheduledForLocal})`,
        html: shell({
          heading: "Your supervision session is over.",
          body: `<p>${greetingHtml} the supervision session with <strong>${esc(superviseeName)}</strong> scheduled for <strong>${esc(scheduledForLocal)}</strong> has ended. If the session happened, please sign it so it counts toward licensure. If it didn't happen, you can mark it from the same screen.</p>`,
          ctaHref: url,
          ctaLabel: "Open session",
          kind,
        }),
        text: `${greetingText} the supervision session with ${superviseeName} on ${scheduledForLocal} has ended. Sign or mark it didn't happen: ${url}`,
      };
    }
  }
  // Exhaustiveness check — if a new NotificationKind is added without a case
  // above, this assignment fails compilation.
  const _exhaustive: never = kind;
  throw new Error(`Unhandled notification kind: ${_exhaustive as string}`);
}
