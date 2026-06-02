"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { getCurrentMembership, isManagerRole } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import type { SessionSignature } from "@/lib/db/schema";
import { decideNextSignature } from "@/lib/signatures";
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

  const parsed = signSchema.safeParse({
    sessionEventId: formData.get("sessionEventId"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid session." };

  const sessionEvent = await db.query.sessionEvents.findFirst({
    where: eq(schema.sessionEvents.id, parsed.data.sessionEventId),
  });
  if (!sessionEvent) return { ok: false, error: "Session not found." };

  const membership = await getCurrentMembership(session.user.id);
  if (!membership || membership.orgId !== sessionEvent.orgId) {
    return { ok: false, error: "You can't sign sessions in this organization." };
  }

  let signerRole: "supervisee" | "supervisor";
  if (session.user.id === sessionEvent.superviseeId) {
    signerRole = "supervisee";
  } else if (isManagerRole(membership.role)) {
    signerRole = "supervisor";
  } else {
    return { ok: false, error: "You aren't a required signer for this session." };
  }

  const candidate: SessionSignature = {
    signerId: session.user.id,
    signerName: session.user.name ?? session.user.email,
    signerRole,
    signedAt: new Date().toISOString(),
    ipAddress: await clientIp(),
    intentConfirmed: formData.get("intent") === "on",
  };

  // Pure decision first — produces the next array shape + friendly error messages.
  const decision = decideNextSignature(sessionEvent.signatures ?? [], candidate);
  if (!decision.ok) return decision;

  // Atomic SQL append — protects against the read-modify-write race when two
  // signers click "Sign" simultaneously. We append to whatever signatures are
  // CURRENTLY in the row (not the snapshot we read above), and decide
  // signed_at from the post-append array — all in one statement.
  // The WHERE clause's NOT EXISTS guards against the same signer appending twice
  // even if the JS-level check raced past.
  const newSigJson = JSON.stringify(candidate);
  const result = await db.execute(sql`
    UPDATE session_events
    SET
      signatures = signatures || ${newSigJson}::jsonb,
      signed_at = CASE
        WHEN (signatures || ${newSigJson}::jsonb) @> '[{"signerRole":"supervisee"}]'::jsonb
         AND (signatures || ${newSigJson}::jsonb) @> '[{"signerRole":"supervisor"}]'::jsonb
        THEN NOW()
        ELSE signed_at
      END
    WHERE id = ${sessionEvent.id}
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(signatures) AS s
        WHERE s->>'signerId' = ${candidate.signerId}
      )
    RETURNING signed_at
  `);

  // rowCount semantics vary by driver — neon-http returns rows array.
  // If zero rows updated, the NOT EXISTS guard triggered (duplicate signer).
  const rows = (result as unknown as { rows: { signed_at: string | null }[] }).rows;
  if (rows.length === 0) {
    return { ok: false, error: "You already signed this session." };
  }

  const fullySigned = rows[0].signed_at !== null;
  if (fullySigned) {
    await generateEvidencePackage(sessionEvent.id);
  }

  revalidatePath(`/dashboard/roster/${sessionEvent.superviseeId}`);
  return { ok: true };
}
