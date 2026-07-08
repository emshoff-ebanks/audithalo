"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { canSupervise, getCurrentMembership } from "@/lib/authz";
import { signPermissions } from "@/lib/sign-permissions";
import { db, schema } from "@/lib/db";
import { generateSessionNote } from "@/lib/ai/session-note";
import { aiNoteQuotaBlockedReason } from "@/lib/billing/seats";
import { hasTranscriptScope, type CalendarProvider } from "@/lib/calendar/oauth-config";
import { getNamedProviderForUser } from "@/lib/calendar/provider";

/**
 * Resolve relationship facts for the session, then run them through
 * signPermissions. Both AI-note actions share this — the gate is now
 * "assigned supervisor OR original logger" instead of "any supervisor
 * in the org", which prevents a peer supervisor in a multi-supervisor
 * Practice org from authoring AI notes on another supervisor's
 * supervisee. HR Admin and supervisee remain blocked (clinical-content
 * authoring is supervisor-only by design).
 */
async function canAuthorAiNote(
  userId: string,
  sessionEvent: typeof schema.sessionEvents.$inferSelect,
  role: string | null | undefined
): Promise<boolean> {
  const isOriginalLogger = sessionEvent.loggedById === userId;
  const isSelfSupervisee = sessionEvent.superviseeId === userId;
  let isAssignedSupervisor = false;
  if (canSupervise(role) && !isOriginalLogger && !isSelfSupervisee) {
    const active = await db.query.supervisorAssignments.findFirst({
      where: and(
        eq(schema.supervisorAssignments.superviseeId, sessionEvent.superviseeId),
        eq(schema.supervisorAssignments.orgId, sessionEvent.orgId),
        eq(schema.supervisorAssignments.supervisorId, userId),
        isNull(schema.supervisorAssignments.endedAt)
      ),
    });
    isAssignedSupervisor = !!active;
  }
  const perms = signPermissions({
    role,
    isSelfSupervisee,
    isOriginalLogger,
    isAssignedSupervisor,
  });
  return perms.canGenerateAiNote;
}

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
  if (!(await canAuthorAiNote(session.user.id, sessionEvent, membership.role))) {
    return {
      ok: false,
      error: "Only the assigned supervisor (or original scheduler) can generate AI notes for this session.",
    };
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
    return { ok: false, error: blockedReason.message };
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
  if (!(await canAuthorAiNote(session.user.id, sessionEvent, membership.role))) {
    return {
      ok: false,
      error: "Only the assigned supervisor (or original scheduler) can edit AI notes on this session.",
    };
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

// ---------------------------------------------------------------------------
// Fetch transcript from meeting provider + generate AI note in one step.
// ---------------------------------------------------------------------------

const PROVIDER_MAP: Record<string, CalendarProvider> = {
  teams: "microsoft",
  google_meet: "google",
};

const PROVIDER_LABELS: Record<string, string> = {
  teams: "Microsoft Teams",
  google_meet: "Google Meet",
};

export async function fetchTranscriptAndGenerateNoteAction(
  sessionEventId: string
): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const sessionEvent = await db.query.sessionEvents.findFirst({
    where: eq(schema.sessionEvents.id, sessionEventId),
  });
  if (!sessionEvent) return { ok: false, error: "Session not found." };
  if (sessionEvent.kind !== "supervision") {
    return { ok: false, error: "AI notes are only available for supervision sessions." };
  }
  if (sessionEvent.signedAt) {
    return { ok: false, error: "This session is already sealed." };
  }

  const membership = await getCurrentMembership(session.user.id);
  if (!membership || membership.orgId !== sessionEvent.orgId) {
    return { ok: false, error: "You can't generate notes for this session." };
  }
  if (!(await canAuthorAiNote(session.user.id, sessionEvent, membership.role))) {
    return { ok: false, error: "Only the assigned supervisor can generate AI notes." };
  }

  if (!sessionEvent.meetingProvider || !sessionEvent.meetingJoinUrl) {
    return { ok: false, error: "This session has no meeting provider configured." };
  }

  const calProvider = PROVIDER_MAP[sessionEvent.meetingProvider];
  if (!calProvider) {
    return { ok: false, error: `Unsupported meeting provider: ${sessionEvent.meetingProvider}.` };
  }

  const providerLabel = PROVIDER_LABELS[sessionEvent.meetingProvider] ?? sessionEvent.meetingProvider;

  // Use the hosting supervisor's calendar integration (the one who scheduled).
  const hostUserId = sessionEvent.loggedById;
  const resolved = await getNamedProviderForUser(hostUserId, calProvider);
  if (!resolved) {
    return {
      ok: false,
      error: `No ${providerLabel} integration found for the hosting supervisor. They need to connect ${providerLabel} on their Account page.`,
    };
  }

  // Check that the integration has transcript scopes
  const integration = await db.query.userCalendarIntegrations.findFirst({
    where: and(
      eq(schema.userCalendarIntegrations.userId, hostUserId),
      eq(schema.userCalendarIntegrations.provider, calProvider),
      isNull(schema.userCalendarIntegrations.disconnectedAt)
    ),
    columns: { scopes: true },
  });

  if (!integration || !hasTranscriptScope(calProvider, integration.scopes)) {
    return {
      ok: false,
      error: `The hosting supervisor needs to reconnect ${providerLabel} to enable transcript access. Go to Account > Integrations and disconnect/reconnect.`,
    };
  }

  // Quota check
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
    return { ok: false, error: blockedReason.message };
  }

  // Fetch transcript
  if (!resolved.client.getTranscript) {
    return { ok: false, error: `${providerLabel} transcript fetch is not supported.` };
  }

  let transcript: string | null;
  try {
    transcript = await resolved.client.getTranscript(
      sessionEvent.meetingId ?? "",
      sessionEvent.meetingJoinUrl
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return {
      ok: false,
      error: `Failed to fetch transcript from ${providerLabel}: ${msg}`,
    };
  }

  if (!transcript) {
    return {
      ok: false,
      error: `No transcript found for this meeting. The transcript may not be ready yet (it usually takes a few minutes after the meeting ends), or transcription may not have been enabled. You can try again shortly, or paste a transcript manually.`,
    };
  }

  // Generate note
  const source = sessionEvent.meetingProvider === "teams" ? "teams" as const : "google_meet" as const;
  let result;
  try {
    result = await generateSessionNote({
      transcript,
      generatedByUserId: session.user.id,
      source,
      teamsMeetingId: sessionEvent.meetingId ?? undefined,
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
