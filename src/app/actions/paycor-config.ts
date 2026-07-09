"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getCurrentMembership, isHrAdmin } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import type { PaycorConfig } from "@/lib/db/schema";
import { encryptToken } from "@/lib/crypto";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit-log";
import { PaycorApiClient } from "@/lib/hris/paycor-api-client";
import { diffRoster, type CurrentMember } from "@/lib/hris/diff-roster";
import { applyPaycorChange } from "@/lib/hris/apply-change";
import { SeatCapExceededError } from "@/lib/hris/types";
import {
  getPaycorEndpoints,
  getPaycorRedirectUri,
  loadPaycorCredentials,
  PAYCOR_SCOPES,
} from "@/lib/paycor/oauth-config";
import { issuePaycorOAuthState } from "@/lib/paycor/oauth-state";
import { decryptPaycorConfig } from "@/lib/paycor/decrypt-config";

export type PaycorConfigResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export type InitiateOAuthResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; error: string };

const initiateOAuthSchema = z.object({
  legalEntityId: z.string().min(1, "Legal Entity ID is required"),
  environment: z.enum(["sandbox", "production"]),
  apimSubscriptionKey: z.string().min(1, "APIM Subscription Key is required"),
});

async function requireHrAdminWithOrg() {
  const session = await auth();
  if (!session?.user) return null;

  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !isHrAdmin(membership.role)) return null;

  return { userId: session.user.id, orgId: membership.orgId };
}

// ---------------------------------------------------------------------------
// Initiate OAuth — saves partial config, returns Paycor redirect URL
// ---------------------------------------------------------------------------

export async function initiatePaycorOAuthAction(
  _prev: InitiateOAuthResult | undefined,
  formData: FormData,
): Promise<InitiateOAuthResult> {
  const ctx = await requireHrAdminWithOrg();
  if (!ctx) return { ok: false, error: "Unauthorized" };

  const parsed = initiateOAuthSchema.safeParse({
    legalEntityId: formData.get("legalEntityId"),
    environment: formData.get("environment"),
    apimSubscriptionKey: formData.get("apimSubscriptionKey"),
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid input";
    return { ok: false, error: firstError };
  }

  const { legalEntityId, environment, apimSubscriptionKey } = parsed.data;

  let creds;
  try {
    creds = loadPaycorCredentials();
  } catch {
    return {
      ok: false,
      error: "Paycor OAuth is not configured on this server. Contact support.",
    };
  }

  // Preserve existing tokens + SFTP fields if reconnecting an active org.
  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, ctx.orgId),
  });

  const existing = org?.paycorConfig;
  const config: PaycorConfig = {
    ...existing,
    legalEntityId,
    environment,
    apimSubscriptionKey: encryptToken(apimSubscriptionKey),
    connectedAt: existing?.connectedAt ?? new Date().toISOString(),
    connectedByUserId: existing?.connectedByUserId ?? ctx.userId,
  };

  await db
    .update(schema.organizations)
    .set({ paycorConfig: config })
    .where(eq(schema.organizations.id, ctx.orgId));

  const state = await issuePaycorOAuthState();
  const endpoints = getPaycorEndpoints(environment);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: creds.clientId,
    redirect_uri: getPaycorRedirectUri(),
    scope: PAYCOR_SCOPES.join(" "),
    state,
  });

  return { ok: true, redirectUrl: `${endpoints.authUrl}?${params}` };
}

// ---------------------------------------------------------------------------
// Disconnect — clears paycorConfig
// ---------------------------------------------------------------------------

export async function disconnectPaycorAction(): Promise<PaycorConfigResult> {
  const ctx = await requireHrAdminWithOrg();
  if (!ctx) return { ok: false, error: "Unauthorized" };

  await db
    .update(schema.organizations)
    .set({ paycorConfig: null })
    .where(eq(schema.organizations.id, ctx.orgId));

  try {
    await logAuditEvent({
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: AUDIT_ACTIONS.PAYCOR_DISCONNECTED,
      resourceType: "organization",
      resourceId: ctx.orgId,
    });
  } catch {
    /* audit failures must not break the action */
  }

  revalidatePath("/dashboard/settings/integrations");
  revalidatePath("/dashboard");
  return { ok: true, message: "Paycor disconnected." };
}

// ---------------------------------------------------------------------------
// Manual sync — runs the roster diff for the current org
// ---------------------------------------------------------------------------

export async function triggerPaycorSyncAction(): Promise<PaycorConfigResult> {
  const ctx = await requireHrAdminWithOrg();
  if (!ctx) return { ok: false, error: "Unauthorized" };

  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, ctx.orgId),
  });

  if (!org?.paycorConfig) {
    return { ok: false, error: "Paycor is not connected." };
  }

  if (!org.paycorConfig.oauthRefreshToken) {
    return {
      ok: false,
      error: "OAuth tokens missing. Please reconnect Paycor.",
    };
  }

  const { legalEntityId } = org.paycorConfig;
  if (!legalEntityId) {
    return { ok: false, error: "Legal Entity ID is not configured." };
  }

  try {
    const decrypted = decryptPaycorConfig(org.paycorConfig);

    const client = new PaycorApiClient(decrypted, async (tokens) => {
      const updated: PaycorConfig = {
        ...org.paycorConfig!,
        oauthAccessToken: encryptToken(tokens.oauthAccessToken),
        oauthRefreshToken: encryptToken(tokens.oauthRefreshToken),
        tokenExpiresAt: tokens.tokenExpiresAt,
      };
      await db
        .update(schema.organizations)
        .set({ paycorConfig: updated })
        .where(eq(schema.organizations.id, org.id));
    });

    const employees = await client.fetchEmployees(legalEntityId);

    const memberships = await db
      .select({
        membershipId: schema.orgMemberships.id,
        userId: schema.orgMemberships.userId,
        role: schema.orgMemberships.role,
        deactivatedAt: schema.orgMemberships.deactivatedAt,
        leaveStatus: schema.orgMemberships.leaveStatus,
        paycorEmployeeId: schema.orgMemberships.paycorEmployeeId,
        email: schema.users.email,
      })
      .from(schema.orgMemberships)
      .innerJoin(
        schema.users,
        eq(schema.users.id, schema.orgMemberships.userId),
      )
      .where(eq(schema.orgMemberships.orgId, org.id));

    const currentMembers: CurrentMember[] = memberships.map((m) => ({
      membershipId: m.membershipId,
      userId: m.userId,
      email: m.email,
      role: m.role,
      deactivatedAt: m.deactivatedAt,
      leaveStatus: m.leaveStatus,
      paycorEmployeeId: m.paycorEmployeeId,
    }));

    const diffs = diffRoster(employees, currentMembers, org.id);

    let changeCount = 0;
    let errors = 0;
    for (const { change, context } of diffs) {
      try {
        const result = await applyPaycorChange(change, context);
        if (result.action !== "skipped") changeCount++;
      } catch (err) {
        errors++;
        if (err instanceof SeatCapExceededError) {
          console.error(`[paycor-sync manual] Seat cap: ${err.message}`);
        } else {
          console.error(
            `[paycor-sync manual] Failed ${change.kind}:`,
            err,
          );
        }
      }
    }

    const syncStatus =
      errors > 0 ? (changeCount > 0 ? "partial" : "failed") : "success";

    const updatedConfig: PaycorConfig = {
      ...org.paycorConfig,
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: syncStatus,
      lastSyncChanges: changeCount,
    };
    await db
      .update(schema.organizations)
      .set({ paycorConfig: updatedConfig })
      .where(eq(schema.organizations.id, org.id));

    revalidatePath("/dashboard/settings/integrations");
    revalidatePath("/dashboard");

    if (errors > 0) {
      return {
        ok: false,
        error: `Sync completed with ${errors} error${errors === 1 ? "" : "s"}. ${changeCount} change${changeCount === 1 ? "" : "s"} applied.`,
      };
    }

    const msg =
      changeCount > 0
        ? `Sync complete. ${changeCount} change${changeCount === 1 ? "" : "s"} applied.`
        : "Sync complete. Roster is up to date.";
    return { ok: true, message: msg };
  } catch (err) {
    try {
      const updatedConfig: PaycorConfig = {
        ...org.paycorConfig,
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: "failed",
        lastSyncChanges: 0,
      };
      await db
        .update(schema.organizations)
        .set({ paycorConfig: updatedConfig })
        .where(eq(schema.organizations.id, org.id));
    } catch {
      /* don't mask the original error */
    }

    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Sync failed: ${message}` };
  }
}
