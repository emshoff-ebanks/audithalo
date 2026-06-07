"use server";

import { z } from "zod";
import { Resend } from "resend";
import { sendEmail } from "@/lib/email";
import { capture } from "@/lib/observability/posthog-server";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const APP_URL = process.env.APP_URL ?? "https://audithalo.com";

/**
 * Known lead magnet slugs. Each maps to a dynamic PDF route served from
 * /lead-magnets/<slug> (see src/app/lead-magnets/[slug]/route.tsx).
 * Adding a new magnet means adding a slug here + a renderer in the route
 * handler + mounting the capture component on the magnet's page.
 */
const MAGNETS = {
  "nc-supervision-audit-checklist": {
    label: "NC Supervision Audit Checklist",
  },
  "nc-supervision-log-template": {
    label: "NC Supervision Log Template",
  },
} as const;

type MagnetSlug = keyof typeof MAGNETS;

const captureSchema = z.object({
  slug: z.string().refine((s): s is MagnetSlug => s in MAGNETS, {
    message: "Unknown lead magnet.",
  }),
  firstName: z.string().min(1, "First name is required."),
  email: z.string().email("Enter a valid email address."),
  state: z.string().optional(),
});

export type LeadMagnetResult = { ok: true } | { ok: false; error: string };

/**
 * Lead-magnet email capture. Writes the lead to the shared lead-magnets
 * Resend audience (segmented by magnet slug + state), fires the
 * `lead_magnet_download` PostHog event for funnel measurement, and emails
 * the user a delivery message with a direct link to the PDF.
 *
 * PDF lives at /public/lead-magnets/<filename>.pdf — served as a static
 * asset from the marketing host. We don't sign the URL or expire the link
 * because the friction of an account-gated download eats conversion; the
 * email capture itself is the trade.
 */
export async function captureLeadMagnetAction(
  _prev: LeadMagnetResult | undefined,
  formData: FormData
): Promise<LeadMagnetResult> {
  const parsed = captureSchema.safeParse({
    slug: formData.get("slug"),
    firstName: formData.get("firstName"),
    email: formData.get("email"),
    state: formData.get("state") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please fill in every field.",
    };
  }
  const data = parsed.data;
  const magnet = MAGNETS[data.slug as MagnetSlug];
  const downloadUrl = `${APP_URL}/lead-magnets/${data.slug}`;

  // 1. Resend audience writeback. RESEND_LEAD_MAGNETS_AUDIENCE_ID is a
  // dedicated audience separate from contact + Founding so we can segment
  // outreach later.
  const audienceId = process.env.RESEND_LEAD_MAGNETS_AUDIENCE_ID;
  if (resend && audienceId) {
    try {
      await resend.contacts.create({
        audienceId,
        email: data.email.toLowerCase(),
        unsubscribed: false,
        firstName: data.firstName,
      });
    } catch (err) {
      // Non-blocking — the delivery email below ensures the magnet still
      // reaches the user even if the audience write hiccups.
      console.error("[lead-magnet] resend audience write failed:", err);
    }
  }

  // 2. Delivery email — the magnet link, in a clean shell.
  try {
    await sendEmail({
      to: data.email,
      subject: `Your ${magnet.label}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#08111F; max-width: 560px;">
          <h2 style="font-size: 22px; margin: 0 0 16px;">Here's your ${magnet.label}.</h2>
          <p style="font-size: 16px; line-height: 1.6;">
            Hi ${data.firstName}, the PDF is below. It's the same checklist we
            use internally when we encode a state's rule — every field a board
            wants to see, plus the mistakes that get logs rejected.
          </p>
          <p style="margin: 32px 0;">
            <a href="${downloadUrl}" style="display: inline-block; padding: 12px 24px; background:#071A3D; color:#FBFAF6; text-decoration:none; font-weight:600; border-radius: 4px;">
              Download the PDF
            </a>
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #5f6470;">
            If anything on it looks off for your state, tell me — I read every
            reply and we're constantly fact-checking these.
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #5f6470;">
            — Damon, founder, AuditHalo
          </p>
        </div>
      `,
      text:
        `Hi ${data.firstName},\n\n` +
        `Here's your ${magnet.label}: ${downloadUrl}\n\n` +
        `If anything looks off for your state, reply and tell me. I read every reply.\n\n` +
        `— Damon, founder, AuditHalo`,
    });
  } catch (err) {
    console.error("[lead-magnet] delivery email failed:", err);
    return {
      ok: false,
      error: `Couldn't email you the link. Download directly: ${downloadUrl}`,
    };
  }

  // 3. PostHog funnel event. Use the email as the distinct_id so a
  // future supervisor signup can stitch this event to the resulting
  // person profile (PostHog merges on alias).
  capture("lead_magnet_download", data.email.toLowerCase(), {
    magnetSlug: data.slug,
    state: data.state ?? null,
  });

  return { ok: true };
}
