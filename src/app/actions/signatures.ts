"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, isNull, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { canSupervise, getCurrentMembership } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import type { SessionSignature } from "@/lib/db/schema";
import { decideNextSignature } from "@/lib/signatures";
import { generateEvidencePackage } from "@/lib/evidence";
import { sendCountersignatureNeededEmail } from "@/lib/email";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit-log";
import { createNotification } from "@/lib/notifications";
import { capture } from "@/lib/observability/posthog-server";

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

  // Block signing on rows that aren't eligible. The UI hides the sign form
  // for canceled / no-show rows, but a stale tab or direct action POST
  // would otherwise sneak past — landing a signature (and potentially a
  // sealed evidence package) on a meeting that didn't happen.
  if (sessionEvent.scheduledStatus === "canceled") {
    return {
      ok: false,
      error: "This session was canceled and can't be signed.",
    };
  }
  if (sessionEvent.scheduledStatus === "no_show") {
    return {
      ok: false,
      error: "This session was marked as a no-show and can't be signed.",
    };
  }

  const membership = await getCurrentMembership(session.user.id);
  if (!membership || membership.orgId !== sessionEvent.orgId) {
    return { ok: false, error: "You can't sign sessions in this organization." };
  }

  let signerRole: "supervisee" | "supervisor";
  if (session.user.id === sessionEvent.superviseeId) {
    signerRole = "supervisee";
  } else if (canSupervise(membership.role)) {
    // Tighten: an org's other supervisors are NOT required signers on
    // sessions outside their own roster. The supervisor signer must
    // either have logged the session (covers legacy + supervisor's own
    // roster) OR be the currently-assigned supervisor of the primary
    // supervisee. The supervisor_attendees table also makes any user
    // listed there a required signer (handled by the attendees-check
    // sealing logic below).
    const isOriginalLogger = sessionEvent.loggedById === session.user.id;
    let isAssignedSupervisor = false;
    if (!isOriginalLogger) {
      const active = await db.query.supervisorAssignments.findFirst({
        where: and(
          eq(
            schema.supervisorAssignments.superviseeId,
            sessionEvent.superviseeId
          ),
          eq(schema.supervisorAssignments.orgId, sessionEvent.orgId),
          eq(schema.supervisorAssignments.supervisorId, session.user.id),
          isNull(schema.supervisorAssignments.endedAt)
        ),
      });
      isAssignedSupervisor = !!active;
    }
    if (!isOriginalLogger && !isAssignedSupervisor) {
      return {
        ok: false,
        error: "You aren't a required signer for this session.",
      };
    }
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
  // CURRENTLY in the row (not the snapshot we read above). signed_at is
  // computed in a second step (below) because the seal condition now depends
  // on session_attendees, not just the two role literals — group sessions
  // require every attendee to sign.
  const newSigJson = JSON.stringify(candidate);
  const result = await db.execute(sql`
    UPDATE session_events
    SET signatures = signatures || ${newSigJson}::jsonb
    WHERE id = ${sessionEvent.id}
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(signatures) AS s
        WHERE s->>'signerId' = ${candidate.signerId}
      )
    RETURNING signed_at, signatures
  `);

  const rows = (
    result as unknown as {
      rows: {
        signed_at: string | null;
        signatures: SessionSignature[];
      }[];
    }
  ).rows;
  if (rows.length === 0) {
    return { ok: false, error: "You already signed this session." };
  }

  // Seal evaluation:
  //   - Every row in session_attendees must have a signature whose
  //     signerId matches userId. For 1:1 this is one supervisee. For
  //     group sessions (Phase 5) it's every additional supervisee too.
  //   - At least one signer must carry signerRole='supervisor'.
  // Existing post-Phase-1d rows always have at least the primary
  // supervisee in session_attendees. Legacy pre-scheduling rows have
  // no attendees row — fall back to the historical 1:1 rule.
  const attendees = await db
    .select({ userId: schema.sessionAttendees.userId })
    .from(schema.sessionAttendees)
    .where(eq(schema.sessionAttendees.sessionEventId, sessionEvent.id));
  const signatures = rows[0].signatures;
  const signedBy = new Set(signatures.map((s) => s.signerId));
  const allAttendeesSigned =
    attendees.length === 0
      ? // Legacy fallback: at least one row with supervisee role.
        signatures.some((s) => s.signerRole === "supervisee")
      : attendees.every((a) => signedBy.has(a.userId));
  const hasSupervisorSig = signatures.some(
    (s) => s.signerRole === "supervisor"
  );
  const shouldSeal = allAttendeesSigned && hasSupervisorSig;

  const alreadySealed = rows[0].signed_at !== null;
  // Whether THIS action call is the one that actually flipped signed_at
  // — used to gate the one-shot generateEvidencePackage + capture +
  // sealed-notification side-effects. Without this guard, two attendees
  // signing at the same instant both compute shouldSeal=true (their
  // signature payloads converge after the append), both regenerate the
  // evidence package, and both fire `evidence_sealed` notifications to
  // every signer. The CAS via `signed_at IS NULL` ensures exactly one
  // winner.
  let didSealNow = false;
  if (shouldSeal && !alreadySealed) {
    const sealRes = await db.execute(sql`
      UPDATE session_events
      SET signed_at = NOW()
      WHERE id = ${sessionEvent.id} AND signed_at IS NULL
      RETURNING id
    `);
    const sealedRows = (sealRes as unknown as { rows: unknown[] }).rows;
    didSealNow = sealedRows.length === 1;
  }
  const fullySigned = alreadySealed || didSealNow;
  if (didSealNow) {
    await generateEvidencePackage(sessionEvent.id);
  }

  capture("signature_completed", session.user.id, {
    orgId: sessionEvent.orgId,
    sessionEventId: sessionEvent.id,
    superviseeId: sessionEvent.superviseeId,
    signerRole,
    fullySigned,
  });

  if (didSealNow) {
    // North-star activation event — fires once both signers complete the
    // session and the tamper-evident package has been generated. Only
    // the winner of the CAS fires it; the loser stays quiet so the
    // event count matches sessions sealed.
    capture("evidence_package_sealed", session.user.id, {
      orgId: sessionEvent.orgId,
      sessionEventId: sessionEvent.id,
      superviseeId: sessionEvent.superviseeId,
      sessionType: sessionEvent.sessionType ?? null,
    });
  }

  try {
    await logAuditEvent({
      orgId: sessionEvent.orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.SESSION_SIGNED,
      resourceType: "session_event",
      resourceId: sessionEvent.id,
      details: { signerRole, sessionType: sessionEvent.sessionType ?? null },
    });
    if (didSealNow) {
      await logAuditEvent({
        orgId: sessionEvent.orgId,
        actorUserId: session.user.id,
        action: AUDIT_ACTIONS.SESSION_SEALED,
        resourceType: "session_event",
        resourceId: sessionEvent.id,
        details: {},
      });
    }
  } catch (err) {
    console.error("[audit-log] failed to record session sign:", err);
  }

  // Only the CAS winner sends the closing "evidence sealed" emails. If
  // we keyed this off fullySigned, both racers would fire the same set
  // of notifications to every attendee. didSealNow guarantees one
  // batch per session.
  if (didSealNow) {
    try {
      const pkg = await db.query.evidencePackages.findFirst({
        where: eq(schema.evidencePackages.sessionEventId, sessionEvent.id),
      });
      const supervisee = await db.query.users.findFirst({
        where: eq(schema.users.id, sessionEvent.superviseeId),
      });
      const superviseeName = supervisee?.name ?? supervisee?.email ?? "supervisee";
      if (pkg) {
        for (const sig of rows[0].signatures) {
          try {
            await createNotification({
              userId: sig.signerId,
              kind: "evidence_sealed",
              payload: {
                packageId: pkg.id,
                superviseeName,
                sessionDate: sessionEvent.date.toISOString().slice(0, 10),
                sessionType: sessionEvent.sessionType ?? "individual",
              },
            });
          } catch (err) {
            console.error("[notifications] evidence_sealed failed:", err);
          }
        }
      }
    } catch (err) {
      console.error("[notifications] evidence-sealed lookup failed:", err);
    }
  }

  // If this was the FIRST signer (post-update signatures length === 1) and the
  // session is not yet fully signed, notify the OTHER required signer that
  // their countersignature is needed. Email failure must NEVER block the action.
  if (!fullySigned && rows[0].signatures.length === 1) {
    try {
      const APP_URL = process.env.APP_URL ?? "https://app.audithalo.com";
      const thisSig = rows[0].signatures[0];
      const otherRole: "supervisee" | "supervisor" =
        thisSig.signerRole === "supervisee" ? "supervisor" : "supervisee";
      let recipientEmail: string | undefined;
      if (otherRole === "supervisee") {
        const supervisee = await db.query.users.findFirst({
          where: eq(schema.users.id, sessionEvent.superviseeId),
        });
        recipientEmail = supervisee?.email;
      } else {
        // Find any supervisor (role="supervisor") member of this org.
        // Known v1 limitation: in Practice orgs with multiple supervisors,
        // we email only the first one found — we don't yet have a
        // "primary supervisor" assignment concept per supervisee.
        const supervisorMembership = await db.query.orgMemberships.findFirst({
          where: and(
            eq(schema.orgMemberships.orgId, sessionEvent.orgId),
            eq(schema.orgMemberships.role, "supervisor")
          ),
        });
        if (supervisorMembership) {
          const supervisor = await db.query.users.findFirst({
            where: eq(schema.users.id, supervisorMembership.userId),
          });
          recipientEmail = supervisor?.email;
        }
      }
      if (recipientEmail) {
        await sendCountersignatureNeededEmail({
          to: recipientEmail,
          otherSignerName: thisSig.signerName,
          otherSignerRole: thisSig.signerRole as "supervisee" | "supervisor",
          sessionDate: sessionEvent.date.toISOString().slice(0, 10),
          sessionType: sessionEvent.sessionType ?? "individual",
          durationHours: sessionEvent.durationHours,
          signUrl: `${APP_URL}/sign/${sessionEvent.id}`,
        });
      }
    } catch (err) {
      console.error(
        "[email] countersignature-needed notification failed:",
        err
      );
    }
  }

  revalidatePath(`/dashboard/roster/${sessionEvent.superviseeId}`);
  return { ok: true };
}
