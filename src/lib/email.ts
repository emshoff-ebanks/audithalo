import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM ?? "AuditHalo <info@audithalo.com>";

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

/**
 * Notifies a supervisee that their supervisor has logged a supervision session
 * and their signature is required to seal it.
 */
export async function sendSupervisionLoggedEmail(opts: {
  to: string;
  supervisorName: string;
  sessionDate: string; // YYYY-MM-DD
  sessionType: string; // "individual" | "triadic" | "group"
  durationHours: number;
  signUrl: string;
}): Promise<void> {
  await sendEmail({
    to: opts.to,
    subject: `${opts.supervisorName} logged a supervision session — your signature is needed`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#0A1428; max-width: 560px;">
        <h2 style="font-size: 22px; margin: 0 0 16px;">A supervision session is awaiting your signature.</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          <strong>${opts.supervisorName}</strong> logged a ${opts.sessionType} supervision session.
        </p>
        <table style="font-size: 14px; color: #5f6470; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 16px 4px 0;">Date</td><td style="color:#0A1428; font-family: monospace;">${opts.sessionDate}</td></tr>
          <tr><td style="padding: 4px 16px 4px 0;">Duration</td><td style="color:#0A1428; font-family: monospace;">${opts.durationHours.toFixed(1)} hours</td></tr>
          <tr><td style="padding: 4px 16px 4px 0;">Type</td><td style="color:#0A1428; text-transform: capitalize;">${opts.sessionType}</td></tr>
        </table>
        <p style="font-size: 15px; line-height: 1.6;">
          Your signature seals the session and contributes to your evidence package.
          Both your signature and your supervisor's are required before the session is audit-ready.
        </p>
        <p style="margin: 28px 0;">
          <a href="${opts.signUrl}" style="display: inline-block; padding: 12px 24px; background:#0F1F4C; color:#FAFAF7; text-decoration:none; font-weight:600; border-radius: 4px;">
            Review and sign
          </a>
        </p>
        <p style="font-size: 12px; color: #5f6470;">
          Or copy this link: ${opts.signUrl}
        </p>
      </div>
    `,
    text: `${opts.supervisorName} logged a ${opts.sessionType} supervision session on ${opts.sessionDate} for ${opts.durationHours.toFixed(1)} hours. Review and sign: ${opts.signUrl}`,
  });
}

/**
 * Notifies the second required signer that the first party has signed a
 * supervision session and their countersignature is now needed to seal it.
 */
export async function sendCountersignatureNeededEmail(opts: {
  to: string;
  otherSignerName: string;
  otherSignerRole: "supervisee" | "supervisor";
  sessionDate: string;
  sessionType: string;
  durationHours: number;
  signUrl: string;
}): Promise<void> {
  const subject = `${opts.otherSignerName} signed a supervision session — your countersignature is needed`;
  await sendEmail({
    to: opts.to,
    subject,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#0A1428; max-width: 560px;">
        <h2 style="font-size: 22px; margin: 0 0 16px;">A supervision session is half-signed.</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          <strong>${opts.otherSignerName}</strong> (${opts.otherSignerRole}) signed the session below.
          It will be sealed and added to the evidence package once you countersign.
        </p>
        <table style="font-size: 14px; color: #5f6470; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 16px 4px 0;">Date</td><td style="color:#0A1428; font-family: monospace;">${opts.sessionDate}</td></tr>
          <tr><td style="padding: 4px 16px 4px 0;">Duration</td><td style="color:#0A1428; font-family: monospace;">${opts.durationHours.toFixed(1)} hours</td></tr>
          <tr><td style="padding: 4px 16px 4px 0;">Type</td><td style="color:#0A1428; text-transform: capitalize;">${opts.sessionType}</td></tr>
        </table>
        <p style="margin: 28px 0;">
          <a href="${opts.signUrl}" style="display: inline-block; padding: 12px 24px; background:#0F1F4C; color:#FAFAF7; text-decoration:none; font-weight:600; border-radius: 4px;">
            Review and countersign
          </a>
        </p>
        <p style="font-size: 12px; color: #5f6470;">
          Or copy this link: ${opts.signUrl}
        </p>
      </div>
    `,
    text: `${opts.otherSignerName} (${opts.otherSignerRole}) signed a ${opts.sessionType} supervision session on ${opts.sessionDate} for ${opts.durationHours.toFixed(1)} hours. Review and countersign: ${opts.signUrl}`,
  });
}
