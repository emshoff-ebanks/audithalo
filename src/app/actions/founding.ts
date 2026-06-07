"use server";

import { z } from "zod";
import { Resend } from "resend";
import { sendEmail } from "@/lib/email";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const applySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Enter a valid email address."),
  state: z.string().min(2, "Pick your state."),
  credential: z
    .string()
    .min(2, "Pick or type your supervisor credential."),
  rosterSize: z.enum(["1-3", "4-10", "11-25"]),
  challenge: z
    .string()
    .min(10, "Tell us a bit about what's hard — even one or two sentences.")
    .max(2000),
});

export type FoundingApplyResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Submit a Founding Supervisor application.
 *
 * 1. Validate the payload.
 * 2. Write the lead to a dedicated Resend audience (env var:
 *    RESEND_FOUNDING_AUDIENCE_ID) so the cohort is segmentable. Falls
 *    back gracefully if either env var is missing.
 * 3. Email info@audithalo.com a structured digest so Damon can read +
 *    approve/decline manually.
 * 4. Send the applicant a Founding-specific auto-responder (separate from
 *    the contact-form one) that sets cohort tone and expectation.
 *
 * Email failures never fall through silently — at least the applicant
 * sees an error and can retry.
 */
export async function applyFoundingAction(
  _prev: FoundingApplyResult | undefined,
  formData: FormData
): Promise<FoundingApplyResult> {
  const parsed = applySchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    state: formData.get("state"),
    credential: formData.get("credential"),
    rosterSize: formData.get("rosterSize"),
    challenge: formData.get("challenge"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please fill in every field.",
    };
  }
  const data = parsed.data;

  const audienceId = process.env.RESEND_FOUNDING_AUDIENCE_ID;
  if (resend && audienceId) {
    try {
      const [firstName, ...rest] = data.name.split(" ");
      await resend.contacts.create({
        audienceId,
        email: data.email.toLowerCase(),
        unsubscribed: false,
        firstName,
        lastName: rest.join(" ") || undefined,
      });
    } catch (err) {
      // Don't block the application on a Resend failure — the digest email
      // below ensures the lead reaches Damon.
      console.error("[founding] resend audience write failed:", err);
    }
  }

  try {
    await sendEmail({
      to: "info@audithalo.com",
      subject: `[Founding] ${data.name} (${data.state} · ${data.credential}) — ${data.rosterSize} supervisees`,
      html: `
        <p><strong>${data.name}</strong> wants to join the Founding Supervisor cohort.</p>
        <p>
          <strong>Email:</strong> ${data.email}<br/>
          <strong>State:</strong> ${data.state}<br/>
          <strong>Credential:</strong> ${data.credential}<br/>
          <strong>Roster size:</strong> ${data.rosterSize}
        </p>
        <hr />
        <p><strong>What's hard about supervision-compliance today:</strong></p>
        <p style="white-space: pre-wrap;">${data.challenge.replace(/</g, "&lt;")}</p>
        <hr />
        <p style="font-size: 12px; color: #5f6470;">
          Approve by toggling Founding Supervisor on at
          <a href="https://app.audithalo.com/admin/founding-supervisors">/admin/founding-supervisors</a>
          after they create an account.
        </p>
      `,
      text:
        `${data.name} wants to join the Founding Supervisor cohort.\n` +
        `Email: ${data.email}\n` +
        `State: ${data.state}\n` +
        `Credential: ${data.credential}\n` +
        `Roster size: ${data.rosterSize}\n\n` +
        `What's hard:\n${data.challenge}`,
      replyTo: data.email,
    });
  } catch (err) {
    console.error("[founding] digest email failed:", err);
    return {
      ok: false,
      error:
        "Couldn't reach our inbox. Email info@audithalo.com directly with your details and we'll add you to the queue.",
    };
  }

  // Auto-responder — Founding-specific tone. Failure here is non-blocking
  // because the application is already captured by the digest above.
  try {
    await sendEmail({
      to: data.email,
      subject: "Thanks — we'll be in touch about Founding Supervisor",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#08111F; max-width: 560px;">
          <h2 style="font-size: 22px; margin: 0 0 16px;">Got it — and thank you.</h2>
          <p style="font-size: 16px; line-height: 1.6;">
            Hi ${data.name.split(" ")[0]},
          </p>
          <p style="font-size: 16px; line-height: 1.6;">
            Your Founding Supervisor application is in front of me. I read every
            single one personally and I'll write back within 48 hours — either
            to confirm a spot in the first cohort or to tell you exactly why
            the timing doesn't fit and what would change that.
          </p>
          <p style="font-size: 16px; line-height: 1.6;">
            The cohort is capped at 25 and the offer is real — 12 months of
            the Practice tier feature set free, and a 50% lifetime discount
            after that. If we go forward, you'll get a personal walk-through
            and direct access to me whenever supervision-compliance gets in
            the way of your actual work.
          </p>
          <p style="font-size: 16px; line-height: 1.6;">
            Talk soon,<br/>
            Damon · founder, AuditHalo
          </p>
        </div>
      `,
      text:
        `Hi ${data.name.split(" ")[0]},\n\n` +
        `Your Founding Supervisor application is in. I read every one personally and ` +
        `I'll write back within 48 hours — either to confirm a spot or to tell you ` +
        `exactly why the timing doesn't fit.\n\n` +
        `The cohort is capped at 25 and the offer is real: 12 months of the Practice ` +
        `feature set free, then 50% off for life. If we go forward you'll get a ` +
        `personal walk-through and direct access to me.\n\n` +
        `Talk soon,\nDamon · founder, AuditHalo`,
    });
  } catch (err) {
    console.error("[founding] auto-responder failed:", err);
  }

  return { ok: true };
}
