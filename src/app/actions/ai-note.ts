"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { canSupervise, getCurrentMembership } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { generateSessionNote } from "@/lib/ai/session-note";
import { aiNoteQuotaBlockedReason } from "@/lib/billing/seats";

type Result = { ok: true } | { ok: false; error: string };

const generateSchema = z.object({
  sessionEventId: z.string().uuid(),
  transcript: z.string().min(50, "Transcript is too short to generate a meaningful note."),
  noPhiConfirmed: z.literal("on"),
});

export async function generateSessionNoteAction(
  _prev: Result | undefined,
  formData: FormData
): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const parsed = generateSchema.safeParse({
    sessionEventId: formData.get("sessionEventId"),
    transcript: formData.get("transcript"),
    noPhiConfirmed: formData.get("noPhiConfirmed"),
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message;
    if (msg?.includes("noPhiConfirmed")) {
      return { ok: false, error: "Confirm 'no PHI' before generating." };
    }
    return { ok: false, error: msg ?? "Invalid input." };
  }

  const sessionEvent = await db.query.sessionEvents.findFirst({
    where: eq(schema.sessionEvents.id, parsed.data.sessionEventId),
  });
  if (!sessionEvent) return { ok: false, error: "Session not found." };
  if (sessionEvent.kind !== "supervision") {
    return { ok: false, error: "AI notes are only available for supervision sessions." };
  }
  if (sessionEvent.signedAt) {
    return { ok: false, error: "This session is already sealed — cannot generate a new note." };
  }

  const membership = await getCurrentMembership(session.user.id);
  if (!membership || membership.orgId !== sessionEvent.orgId) {
    return { ok: false, error: "You can't generate notes for this session." };
  }
  if (!canSupervise(membership.role)) {
    return { ok: false, error: "Only supervisors can generate AI notes." };
  }

  // Quota check — Solo plan is capped at 10 notes/month; Practice is unlimited.
  // Counted via `ai_note->>'generatedAt'` so initial generations AND regenerations
  // both count (each is a separate OpenAI call). Runs AFTER auth/role/seal checks
  // but BEFORE the OpenAI call so we don't burn an API call when quota is exhausted.
  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, sessionEvent.orgId),
  });
  if (!org) return { ok: false, error: "Organization not found." };

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const monthsNotes = await db.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM session_events
    WHERE org_id = ${sessionEvent.orgId}
      AND ai_note IS NOT NULL
      AND (ai_note->>'generatedAt')::timestamp >= ${startOfMonth.toISOString()}
  `);
  const usedThisMonth =
    (monthsNotes as unknown as { rows: { count: number }[] }).rows[0]?.count ?? 0;

  const blockedReason = aiNoteQuotaBlockedReason(org, usedThisMonth);
  if (blockedReason) {
    return { ok: false, error: blockedReason };
  }

  let result;
  try {
    result = await generateSessionNote({
      transcript: parsed.data.transcript,
      generatedByUserId: session.user.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate note.";
    return { ok: false, error: `AI generation failed: ${message}` };
  }

  await db
    .update(schema.sessionEvents)
    .set({
      aiNote: {
        topics: result.note.topics,
        competencies: result.note.competencies,
        supervisorFeedback: result.note.supervisorFeedback,
        nextSteps: result.note.nextSteps,
        ...result.metadata,
      },
    })
    .where(eq(schema.sessionEvents.id, sessionEvent.id));

  revalidatePath(`/sign/${sessionEvent.id}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Manual edit before sealing — supervisor-only, pre-seal only.
// Does NOT call OpenAI, so quota does NOT apply. Preserves generation metadata
// (model, transcriptHash, generatedAt, etc.) and stamps editedAt/editedByUserId.
// ---------------------------------------------------------------------------

const updateSchema = z.object({
  sessionEventId: z.string().uuid(),
  topics: z.array(z.string().trim().min(1)).default([]),
  competencies: z.array(z.string().trim().min(1)).default([]),
  supervisorFeedback: z.string().trim().default(""),
  nextSteps: z.array(z.string().trim().min(1)).default([]),
});

export async function updateSessionNoteAction(
  _prev: Result | undefined,
  formData: FormData
): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  // Parse arrays from textarea (one per line, trimmed, empty lines dropped)
  const linesToArray = (raw: string | null) =>
    (raw ?? "").split("\n").map((s) => s.trim()).filter(Boolean);

  const parsed = updateSchema.safeParse({
    sessionEventId: formData.get("sessionEventId"),
    topics: linesToArray(formData.get("topics") as string),
    competencies: linesToArray(formData.get("competencies") as string),
    supervisorFeedback: (formData.get("supervisorFeedback") as string)?.trim() ?? "",
    nextSteps: linesToArray(formData.get("nextSteps") as string),
  });
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const sessionEvent = await db.query.sessionEvents.findFirst({
    where: eq(schema.sessionEvents.id, parsed.data.sessionEventId),
  });
  if (!sessionEvent) return { ok: false, error: "Session not found." };
  if (sessionEvent.signedAt) {
    return { ok: false, error: "This session is sealed — note cannot be edited." };
  }
  if (!sessionEvent.aiNote) {
    return { ok: false, error: "No note exists to edit. Generate one first." };
  }

  const membership = await getCurrentMembership(session.user.id);
  if (!membership || membership.orgId !== sessionEvent.orgId) {
    return { ok: false, error: "You can't edit notes on this session." };
  }
  if (!canSupervise(membership.role)) {
    return { ok: false, error: "Only supervisors can edit AI notes." };
  }

  // Preserve original generation metadata; overwrite content + stamp edit metadata.
  const existing = sessionEvent.aiNote;
  await db
    .update(schema.sessionEvents)
    .set({
      aiNote: {
        ...existing,
        topics: parsed.data.topics,
        competencies: parsed.data.competencies,
        supervisorFeedback: parsed.data.supervisorFeedback,
        nextSteps: parsed.data.nextSteps,
        editedAt: new Date().toISOString(),
        editedByUserId: session.user.id,
      },
    })
    .where(eq(schema.sessionEvents.id, sessionEvent.id));

  revalidatePath(`/sign/${sessionEvent.id}`);
  return { ok: true };
}
