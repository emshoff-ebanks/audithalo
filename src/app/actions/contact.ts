"use server";

import { Resend } from "resend";
import { sendEmail } from "@/lib/email";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

type ContactResult = { ok: true } | { ok: false; error: string };

export async function submitContactAction(formData: FormData): Promise<ContactResult> {
  const name = (formData.get("name") as string | null)?.trim();
  const email = (formData.get("email") as string | null)?.trim();
  const topic = (formData.get("topic") as string | null)?.trim();
  const message = (formData.get("message") as string | null)?.trim();

  if (!name || !email || !message) {
    return { ok: false, error: "Name, email, and message are required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  try {
    await sendEmail({
      to: "info@audithalo.com",
      subject: `[AuditHalo Contact] ${topic ?? "General inquiry"} — ${name}`,
      html: `
        <p><strong>From:</strong> ${name} (${email})</p>
        <p><strong>Topic:</strong> ${topic ?? "General"}</p>
        <hr />
        <p>${message.replace(/\n/g, "<br />")}</p>
      `,
      text: `From: ${name} (${email})\nTopic: ${topic ?? "General"}\n\n${message}`,
      replyTo: email,
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to send. Please email us directly at info@audithalo.com." };
  }
}

export async function subscribeNewsletterAction(formData: FormData): Promise<ContactResult> {
  const email = (formData.get("email") as string | null)?.trim();
  const state = (formData.get("state") as string | null)?.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const audienceId = process.env.RESEND_AUDIENCE_ID;

  if (resend && audienceId) {
    try {
      await resend.contacts.create({
        audienceId,
        email,
        unsubscribed: false,
        ...(state ? { firstName: state } : {}),
      });
    } catch {
      // If Resend fails, still notify us by email so no subscriber is lost
    }
  }

  // Always send a notification email so we can manually follow up
  await sendEmail({
    to: "info@audithalo.com",
    subject: `[AuditHalo Newsletter] New subscriber: ${email}`,
    html: `<p>New newsletter subscriber: <strong>${email}</strong>${state ? ` — State: ${state}` : ""}</p>`,
    text: `New newsletter subscriber: ${email}${state ? ` — State: ${state}` : ""}`,
  });

  return { ok: true };
}
