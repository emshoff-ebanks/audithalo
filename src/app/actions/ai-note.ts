"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getCurrentMembership, isManagerRole } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { generateSessionNote } from "@/lib/ai/session-note";

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
  if (!isManagerRole(membership.role)) {
    return { ok: false, error: "Only supervisors can generate AI notes." };
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
