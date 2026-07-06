"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { canSupervise, getCurrentMembership } from "@/lib/authz";
import { signPermissions } from "@/lib/sign-permissions";
import { db, schema } from "@/lib/db";
import { SUPERVISION_TYPES } from "@/lib/db/schema";
import type { ClinicalFormData } from "@/lib/clinical-form/types";

type Result = { ok: true } | { ok: false; error: string };

async function canEditClinicalForm(
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

// ---------------------------------------------------------------------------
// updateSupervisionType — sets the supervision type on a session event
// ---------------------------------------------------------------------------

const supervisionTypeSchema = z.object({
  sessionEventId: z.string().uuid(),
  supervisionType: z.enum(SUPERVISION_TYPES),
});

export async function updateSupervisionTypeAction(
  input: z.infer<typeof supervisionTypeSchema>
): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const parsed = supervisionTypeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const sessionEvent = await db.query.sessionEvents.findFirst({
    where: eq(schema.sessionEvents.id, parsed.data.sessionEventId),
  });
  if (!sessionEvent) return { ok: false, error: "Session not found." };

  if (sessionEvent.signedAt) {
    return { ok: false, error: "Cannot modify a sealed session." };
  }

  const membership = await getCurrentMembership(session.user.id);
  if (!membership || membership.orgId !== sessionEvent.orgId) {
    return { ok: false, error: "Not authorized." };
  }

  const allowed = await canEditClinicalForm(
    session.user.id,
    sessionEvent,
    membership.role
  );
  if (!allowed) return { ok: false, error: "Not authorized." };

  await db
    .update(schema.sessionEvents)
    .set({ supervisionType: parsed.data.supervisionType })
    .where(eq(schema.sessionEvents.id, parsed.data.sessionEventId));

  revalidatePath(`/sign/${parsed.data.sessionEventId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// saveClinicalFormData — persists the RI Clinical Supervision Form fields
// ---------------------------------------------------------------------------

export async function saveClinicalFormDataAction(
  sessionEventId: string,
  data: Partial<ClinicalFormData>
): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  if (!sessionEventId || typeof sessionEventId !== "string") {
    return { ok: false, error: "Invalid session ID." };
  }

  const sessionEvent = await db.query.sessionEvents.findFirst({
    where: eq(schema.sessionEvents.id, sessionEventId),
  });
  if (!sessionEvent) return { ok: false, error: "Session not found." };

  if (sessionEvent.signedAt) {
    return { ok: false, error: "Cannot modify a sealed session." };
  }

  const membership = await getCurrentMembership(session.user.id);
  if (!membership || membership.orgId !== sessionEvent.orgId) {
    return { ok: false, error: "Not authorized." };
  }

  const allowed = await canEditClinicalForm(
    session.user.id,
    sessionEvent,
    membership.role
  );
  if (!allowed) return { ok: false, error: "Not authorized." };

  const existing =
    (sessionEvent.clinicalFormData as ClinicalFormData | null) ?? {};
  const merged: ClinicalFormData = { ...existing, ...data };

  await db
    .update(schema.sessionEvents)
    .set({ clinicalFormData: merged })
    .where(eq(schema.sessionEvents.id, sessionEventId));

  revalidatePath(`/sign/${sessionEventId}`);
  return { ok: true };
}
