"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { canSupervise, getCurrentMembership } from "@/lib/authz";
import { db, schema } from "@/lib/db";

type Result = { ok: true } | { ok: false; error: string };

const updateSchema = z.object({
  sessionEventId: z.string().uuid(),
  transcript: z.string().min(1),
});

export async function updateTranscriptAction(
  _prev: Result | undefined,
  formData: FormData
): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const parsed = updateSchema.safeParse({
    sessionEventId: formData.get("sessionEventId"),
    transcript: formData.get("transcript"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canSupervise(membership.role)) {
    return { ok: false, error: "Only supervisors can edit transcripts." };
  }

  const sessionEvent = await db.query.sessionEvents.findFirst({
    where: and(
      eq(schema.sessionEvents.id, parsed.data.sessionEventId),
      eq(schema.sessionEvents.orgId, membership.orgId)
    ),
  });
  if (!sessionEvent) return { ok: false, error: "Session not found." };
  if (sessionEvent.signedAt) {
    return { ok: false, error: "Cannot edit a sealed session's transcript." };
  }

  await db
    .update(schema.sessionEvents)
    .set({ transcript: parsed.data.transcript })
    .where(eq(schema.sessionEvents.id, sessionEvent.id));

  revalidatePath(`/sign/${sessionEvent.id}`);
  return { ok: true };
}

export async function generateNoteFromTranscriptAction(
  _prev: Result | undefined,
  formData: FormData
): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const sessionEventId = formData.get("sessionEventId") as string;
  if (!sessionEventId) return { ok: false, error: "Missing session ID." };

  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canSupervise(membership.role)) {
    return { ok: false, error: "Only supervisors can generate notes." };
  }

  const sessionEvent = await db.query.sessionEvents.findFirst({
    where: and(
      eq(schema.sessionEvents.id, sessionEventId),
      eq(schema.sessionEvents.orgId, membership.orgId),
      isNull(schema.sessionEvents.signedAt)
    ),
  });
  if (!sessionEvent) return { ok: false, error: "Session not found or already sealed." };
  if (!sessionEvent.transcript) {
    return { ok: false, error: "No transcript saved. Record or paste a transcript first." };
  }

  const { generateSessionNote } = await import("@/lib/ai/session-note");
  const { aiNoteQuotaBlockedReason } = await import("@/lib/billing/seats");

  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, sessionEvent.orgId),
  });
  if (!org) return { ok: false, error: "Organization not found." };

  const { sql } = await import("drizzle-orm");
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
    return { ok: false, error: blockedReason.message };
  }

  let result;
  try {
    result = await generateSessionNote({
      transcript: sessionEvent.transcript,
      generatedByUserId: session.user.id,
      source: sessionEvent.transcriptSource === "teams" ? "teams"
        : sessionEvent.transcriptSource === "google_meet" ? "google_meet"
        : "manual",
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
