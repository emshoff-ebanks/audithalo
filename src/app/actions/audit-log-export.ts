"use server";

import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import {
  canExportAuditLog,
  getCurrentMembership,
  isHrAdmin,
} from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit-log";
import { findBackupCodeMatch, verifyTotpCode } from "@/lib/totp";

const requestSchema = z.object({
  format: z.enum(["csv", "json"]),
  totpCode: z.string().optional(),
});

export type ExportPrepareResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

/**
 * One-time download tokens for audit-log exports.
 *
 * Why an in-memory map: the export is small (we cap at 10k rows server-side
 * below) and the token's TTL is 60 seconds — plenty for the user to
 * follow the download link. Using a DB table would work too but adds a
 * migration for a feature that doesn't need durability. If the function
 * restarts between prepare and download, the user re-clicks Export.
 */
type PreparedExport = {
  orgId: string;
  format: "csv" | "json";
  requestedById: string;
  expiresAt: number;
};

const PREPARED: Map<string, PreparedExport> = (
  globalThis as unknown as { __auditExports?: Map<string, PreparedExport> }
).__auditExports ?? new Map<string, PreparedExport>();
(globalThis as unknown as { __auditExports: Map<string, PreparedExport> }).__auditExports = PREPARED;

const TOKEN_TTL_MS = 60_000;

function newToken(): string {
  return [...crypto.getRandomValues(new Uint8Array(24))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Two-step export flow:
 *   1. UI calls prepareAuditLogExport with format + TOTP (HR Admin only).
 *   2. Server returns a one-time token.
 *   3. UI redirects to GET /api/audit-log/export?token=... which streams
 *      the file.
 *
 * Why two steps: server actions return JSON, not file streams. The route
 * handler streams the actual file. The token ties them together with a
 * short TTL so the TOTP code stays out of the URL.
 */
export async function prepareAuditLogExport(
  _prev: ExportPrepareResult | undefined,
  formData: FormData
): Promise<ExportPrepareResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canExportAuditLog(membership.role)) {
    return { ok: false, error: "Not authorized to export this org's audit log." };
  }

  const parsed = requestSchema.safeParse({
    format: formData.get("format"),
    totpCode: formData.get("totpCode") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  // HR Admin export requires 2FA per the RBAC spec. Executive skips
  // because they're read-only oversight.
  if (isHrAdmin(membership.role)) {
    if (!parsed.data.totpCode) {
      return {
        ok: false,
        error: "Enter your 2FA code to export the audit log.",
      };
    }
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, session.user.id),
      columns: {
        totpEnabledAt: true,
        totpSecret: true,
        totpBackupCodes: true,
      },
    });
    if (!user?.totpEnabledAt || !user.totpSecret) {
      return {
        ok: false,
        error:
          "2FA must be enabled to export. Set it up at /dashboard/account#2fa first.",
      };
    }
    const code = parsed.data.totpCode;
    if (!verifyTotpCode(code, user.totpSecret)) {
      const codes = user.totpBackupCodes ?? [];
      const idx = findBackupCodeMatch(code, codes);
      if (idx === -1) return { ok: false, error: "Invalid 2FA code." };
      const remaining = [...codes];
      remaining.splice(idx, 1);
      await db
        .update(schema.users)
        .set({ totpBackupCodes: remaining })
        .where(eq(schema.users.id, session.user.id));
    }
  }

  // Log the prep step — the actual download fires another audit entry, but
  // having the prep call recorded lets us see attempted exports even when
  // the user closes the tab before downloading.
  try {
    await logAuditEvent({
      orgId: membership.orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.AUDIT_LOG_EXPORTED,
      resourceType: "audit_log",
      details: {
        phase: "prepared",
        format: parsed.data.format,
        role: membership.role,
      },
    });
  } catch (err) {
    console.error("[audit-export] prepare audit failed:", err);
  }

  const token = newToken();
  PREPARED.set(token, {
    orgId: membership.orgId,
    format: parsed.data.format,
    requestedById: session.user.id,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });

  // Sweep expired tokens opportunistically.
  for (const [k, v] of PREPARED) {
    if (v.expiresAt < Date.now()) PREPARED.delete(k);
  }

  return { ok: true, token };
}

/** Used by the route handler to redeem a prepared export. */
export async function redeemAuditLogExport(token: string): Promise<
  | {
      ok: true;
      orgId: string;
      format: "csv" | "json";
      requestedById: string;
    }
  | { ok: false; error: string }
> {
  const prep = PREPARED.get(token);
  if (!prep) return { ok: false, error: "Export token invalid or expired." };
  if (prep.expiresAt < Date.now()) {
    PREPARED.delete(token);
    return { ok: false, error: "Export token expired." };
  }
  PREPARED.delete(token); // one-time use
  return {
    ok: true,
    orgId: prep.orgId,
    format: prep.format,
    requestedById: prep.requestedById,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Org settings: retention years
// ───────────────────────────────────────────────────────────────────────────

const retentionSchema = z.object({
  years: z.coerce.number().int().min(1).max(20),
});

export type SettingsResult = { ok: true } | { ok: false; error: string };

export async function updateAuditRetentionAction(
  _prev: SettingsResult | undefined,
  formData: FormData
): Promise<SettingsResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !isHrAdmin(membership.role)) {
    return { ok: false, error: "Only HR Admins can change retention." };
  }

  const parsed = retentionSchema.safeParse({
    years: formData.get("years"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Pick a retention period between 1 and 20 years.",
    };
  }

  const existing = await db.query.orgSettings.findFirst({
    where: eq(schema.orgSettings.orgId, membership.orgId),
  });
  if (existing) {
    await db
      .update(schema.orgSettings)
      .set({
        auditLogRetentionYears: parsed.data.years,
        updatedAt: new Date(),
      })
      .where(eq(schema.orgSettings.orgId, membership.orgId));
  } else {
    await db.insert(schema.orgSettings).values({
      orgId: membership.orgId,
      auditLogRetentionYears: parsed.data.years,
    });
  }

  try {
    await logAuditEvent({
      orgId: membership.orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.ORG_SETTINGS_UPDATED,
      resourceType: "org_settings",
      details: { auditLogRetentionYears: parsed.data.years },
    });
  } catch (err) {
    console.error("[audit-export] settings update audit failed:", err);
  }

  return { ok: true };
}
