"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { canSupervise, getCurrentMembership } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit-log";
import { createNotification } from "@/lib/notifications";

type Result = { ok: true; count?: number } | { ok: false; error: string };

const approveSchema = z.object({
  sessionEventIds: z.array(z.string().uuid()).min(1).max(200),
});

export async function approvePracticeHoursAction(
  _prev: Result | undefined,
  formData: FormData
): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const raw = formData.get("sessionEventIds");
  const parsed = approveSchema.safeParse({
    sessionEventIds: typeof raw === "string" ? JSON.parse(raw) : [],
  });
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canSupervise(membership.role)) {
    return { ok: false, error: "Only supervisors can approve practice hours." };
  }

  const events = await db.query.sessionEvents.findMany({
    where: and(
      inArray(schema.sessionEvents.id, parsed.data.sessionEventIds),
      eq(schema.sessionEvents.orgId, membership.orgId),
      eq(schema.sessionEvents.kind, "practice"),
      isNull(schema.sessionEvents.approvedAt)
    ),
  });

  if (events.length === 0) {
    return { ok: false, error: "No pending practice hours found." };
  }

  await db
    .update(schema.sessionEvents)
    .set({
      approvedAt: new Date(),
      approvedByUserId: session.user.id,
    })
    .where(
      and(
        inArray(
          schema.sessionEvents.id,
          events.map((e) => e.id)
        ),
        isNull(schema.sessionEvents.approvedAt)
      )
    );

  for (const e of events) {
    try {
      await logAuditEvent({
        orgId: membership.orgId,
        actorUserId: session.user.id,
        action: AUDIT_ACTIONS.PRACTICE_HOURS_APPROVED,
        resourceType: "session_event",
        resourceId: e.id,
        details: {
          superviseeId: e.superviseeId,
          date: e.date.toISOString().slice(0, 10),
          durationHours: e.durationHours,
        },
      });
    } catch (err) {
      console.error("[audit-log] practice_hours.approved failed:", err);
    }
  }

  const superviseeIds = [...new Set(events.map((e) => e.superviseeId))];
  for (const sid of superviseeIds) {
    if (sid) revalidatePath(`/dashboard/roster/${sid}`);
  }

  return { ok: true, count: events.length };
}

const rejectSchema = z.object({
  sessionEventId: z.string().uuid(),
  reason: z.string().min(1, "A reason is required.").max(500),
});

export async function rejectPracticeHoursAction(
  _prev: Result | undefined,
  formData: FormData
): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const parsed = rejectSchema.safeParse({
    sessionEventId: formData.get("sessionEventId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canSupervise(membership.role)) {
    return { ok: false, error: "Only supervisors can reject practice hours." };
  }

  const event = await db.query.sessionEvents.findFirst({
    where: and(
      eq(schema.sessionEvents.id, parsed.data.sessionEventId),
      eq(schema.sessionEvents.orgId, membership.orgId),
      eq(schema.sessionEvents.kind, "practice"),
      isNull(schema.sessionEvents.approvedAt)
    ),
  });

  if (!event) {
    return { ok: false, error: "Practice hour entry not found or already approved." };
  }

  const superviseeId = event.superviseeId;

  await db
    .delete(schema.sessionEvents)
    .where(eq(schema.sessionEvents.id, event.id));

  try {
    await logAuditEvent({
      orgId: membership.orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.PRACTICE_HOURS_REJECTED,
      resourceType: "session_event",
      resourceId: event.id,
      details: {
        superviseeId,
        date: event.date.toISOString().slice(0, 10),
        durationHours: event.durationHours,
        reason: parsed.data.reason,
      },
    });
  } catch (err) {
    console.error("[audit-log] practice_hours.rejected failed:", err);
  }

  if (superviseeId) {
    try {
      await createNotification({
        userId: superviseeId,
        kind: "practice_hours_rejected",
        payload: {
          date: event.date.toISOString().slice(0, 10),
          durationHours: event.durationHours,
          reason: parsed.data.reason,
        },
      });
    } catch (err) {
      console.error("[notifications] practice_hours_rejected failed:", err);
    }
    revalidatePath(`/dashboard/roster/${superviseeId}`);
  }

  return { ok: true };
}
