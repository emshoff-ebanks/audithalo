"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getCurrentMembership, isManagerRole } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import type { SessionSignature } from "@/lib/db/schema";
import { generateEvidencePackage } from "@/lib/evidence";

type Result = { ok: true } | { ok: false; error: string };

const signSchema = z.object({
  sessionEventId: z.string().uuid(),
});

async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

export async function signSessionAction(
  _prev: Result | undefined,
  formData: FormData
): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  // Intent confirmation is non-negotiable for legal-grade e-sign
  if (formData.get("intent") !== "on") {
    return {
      ok: false,
      error: "You must confirm intent before signing.",
    };
  }

  const parsed = signSchema.safeParse({
    sessionEventId: formData.get("sessionEventId"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid session." };
  }

  const sessionEvent = await db.query.sessionEvents.findFirst({
    where: eq(schema.sessionEvents.id, parsed.data.sessionEventId),
  });
  if (!sessionEvent) return { ok: false, error: "Session not found." };

  const membership = await getCurrentMembership(session.user.id);
  if (!membership || membership.orgId !== sessionEvent.orgId) {
    return { ok: false, error: "You can't sign sessions in this organization." };
  }

  // Determine the signer's role for this specific session
  let signerRole: "supervisee" | "supervisor";
  if (session.user.id === sessionEvent.superviseeId) {
    signerRole = "supervisee";
  } else if (isManagerRole(membership.role)) {
    signerRole = "supervisor";
  } else {
    return { ok: false, error: "You aren't a required signer for this session." };
  }

  const existing = sessionEvent.signatures ?? [];
  if (existing.some((s) => s.signerId === session.user.id)) {
    return { ok: false, error: "You already signed this session." };
  }

  const newSig: SessionSignature = {
    signerId: session.user.id,
    signerName: session.user.name ?? session.user.email,
    signerRole,
    signedAt: new Date().toISOString(),
    ipAddress: await clientIp(),
    intentConfirmed: true,
  };
  const updated = [...existing, newSig];

  // Required signers: supervisee + supervisor
  const fullySigned =
    updated.some((s) => s.signerRole === "supervisee") &&
    updated.some((s) => s.signerRole === "supervisor");

  await db
    .update(schema.sessionEvents)
    .set({
      signatures: updated,
      signedAt: fullySigned ? new Date() : null,
    })
    .where(eq(schema.sessionEvents.id, sessionEvent.id));

  // When all required signers are in, mint the evidence package — hashed, immutable, audit-grade.
  if (fullySigned) {
    await generateEvidencePackage(sessionEvent.id);
  }

  revalidatePath(`/dashboard/roster/${sessionEvent.superviseeId}`);
  return { ok: true };
}
