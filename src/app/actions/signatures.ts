"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { canSupervise, getCurrentMembership } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import type { SessionSignature } from "@/lib/db/schema";
import { decideNextSignature } from "@/lib/signatures";
import { generateEvidencePackage } from "@/lib/evidence";
import {
  sendCountersignatureNeededEmail,
  sendEvidenceSealedEmail,
} from "@/lib/email";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit-log";
import { createNotification } from "@/lib/notifications";

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
  } else if (canSupervise(membership.role)) {
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
    RETURNING signed_at, signatures
  `);

  // rowCount semantics vary by driver — neon-http returns rows array.
  // If zero rows updated, the NOT EXISTS guard triggered (duplicate signer).
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

  const fullySigned = rows[0].signed_at !== null;
  if (fullySigned) {
    await generateEvidencePackage(sessionEvent.id);
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
    if (fullySigned) {
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

  // If the session is now fully sealed, notify both signers with a closing
  // confirmation that includes the evidence-package download URL and a public
  // verify URL suitable for forwarding to state boards. Email failure must
  // NEVER block the action — wrapped in try/catch.
  if (fullySigned) {
    try {
      const pkg = await db.query.evidencePackages.findFirst({
        where: eq(schema.evidencePackages.sessionEventId, sessionEvent.id),
      });
      const supervisee = await db.query.users.findFirst({
        where: eq(schema.users.id, sessionEvent.superviseeId),
      });
      const superviseeName = supervisee?.name ?? supervisee?.email ?? "supervisee";
      if (pkg) {
        // Bell notification for every signer.
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
        // Legacy direct-email path keeps the richer template until we've
        // proven the new notification email side-effect at parity.
        for (const sig of rows[0].signatures) {
          const signerUser = await db.query.users.findFirst({
            where: eq(schema.users.id, sig.signerId),
          });
          if (signerUser?.email) {
            await sendEvidenceSealedEmail({
              to: signerUser.email,
              recipientName: signerUser.name ?? signerUser.email,
              superviseeName,
              sessionDate: sessionEvent.date.toISOString().slice(0, 10),
              sessionType: sessionEvent.sessionType ?? "individual",
              durationHours: sessionEvent.durationHours,
              packageId: pkg.id,
              documentHash: pkg.documentHash,
            });
          }
        }
      }
    } catch (err) {
      console.error("[email] evidence-sealed notification failed:", err);
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
