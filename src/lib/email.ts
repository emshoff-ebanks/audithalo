import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM ?? "AuditHalo <invites@audithalo.com>";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

/**
 * Sends a transactional email.
 *
 * If RESEND_API_KEY is not set (local dev before Resend is wired up), the email
 * is logged to the console with the body so we can still test the flow end-to-end.
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  if (!resend) {
    console.log(
      `\n=== [email] RESEND_API_KEY not set — logging only ===\n` +
        `To: ${params.to}\n` +
        `Subject: ${params.subject}\n` +
        `From: ${FROM}\n` +
        `Body (plain): ${params.text ?? params.html.replace(/<[^>]+>/g, "")}\n` +
        `===\n`
    );
    return;
  }

  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    replyTo: params.replyTo,
  });
}
