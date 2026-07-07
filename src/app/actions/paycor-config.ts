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

export type PaycorConfigResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const connectSchema = z.object({
  legalEntityId: z.string().min(1, "Legal Entity ID is required"),
  environment: z.enum(["sandbox", "production"]),
  apimSubscriptionKey: z.string().min(1, "APIM Subscription Key is required"),
  oauthClientId: z.string().min(1, "Client ID is required"),
  oauthClientSecret: z.string().min(1, "Client Secret is required"),
  oauthRefreshToken: z.string().min(1, "Refresh Token is required"),
});

async function requireHrAdminWithOrg() {
  const session = await auth();
  if (!session?.user) return null;

  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !isHrAdmin(membership.role)) return null;

  return { userId: session.user.id, orgId: membership.orgId };
}

export async function connectPaycorAction(
  _prev: PaycorConfigResult | undefined,
  formData: FormData,
): Promise<PaycorConfigResult> {
  const ctx = await requireHrAdminWithOrg();
  if (!ctx) return { ok: false, error: "Unauthorized" };

  const parsed = connectSchema.safeParse({
    legalEntityId: formData.get("legalEntityId"),
    environment: formData.get("environment"),
    apimSubscriptionKey: formData.get("apimSubscriptionKey"),
    oauthClientId: formData.get("oauthClientId"),
    oauthClientSecret: formData.get("oauthClientSecret"),
    oauthRefreshToken: formData.get("oauthRefreshToken"),
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid input";
    return { ok: false, error: firstError };
  }

  const { legalEntityId, environment, apimSubscriptionKey, oauthClientId, oauthClientSecret, oauthRefreshToken } = parsed.data;

  const config: PaycorConfig = {
    legalEntityId,
    environment,
    apimSubscriptionKey: encryptToken(apimSubscriptionKey),
    oauthClientId,
    oauthClientSecret: encryptToken(oauthClientSecret),
    oauthRefreshToken: encryptToken(oauthRefreshToken),
    connectedAt: new Date().toISOString(),
    connectedByUserId: ctx.userId,
  };

  await db
    .update(schema.organizations)
    .set({ paycorConfig: config })
    .where(eq(schema.organizations.id, ctx.orgId));

  try {
    await logAuditEvent({
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: AUDIT_ACTIONS.PAYCOR_CONNECTED,
      resourceType: "organization",
      resourceId: ctx.orgId,
      details: { legalEntityId, environment },
    });
  } catch { /* audit failures must not break the action */ }

  revalidatePath("/dashboard/settings/integrations");
  revalidatePath("/dashboard");
  return { ok: true, message: "Paycor connected successfully." };
}

export async function testPaycorConnectionAction(
  _prev: PaycorConfigResult | undefined,
  formData: FormData,
): Promise<PaycorConfigResult> {
  const ctx = await requireHrAdminWithOrg();
  if (!ctx) return { ok: false, error: "Unauthorized" };

  const parsed = connectSchema.safeParse({
    legalEntityId: formData.get("legalEntityId"),
    environment: formData.get("environment"),
    apimSubscriptionKey: formData.get("apimSubscriptionKey"),
    oauthClientId: formData.get("oauthClientId"),
    oauthClientSecret: formData.get("oauthClientSecret"),
    oauthRefreshToken: formData.get("oauthRefreshToken"),
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid input";
    return { ok: false, error: firstError };
  }

  const testConfig: PaycorConfig = {
    legalEntityId: parsed.data.legalEntityId,
    environment: parsed.data.environment,
    apimSubscriptionKey: parsed.data.apimSubscriptionKey,
    oauthClientId: parsed.data.oauthClientId,
    oauthClientSecret: parsed.data.oauthClientSecret,
    oauthRefreshToken: parsed.data.oauthRefreshToken,
    connectedAt: new Date().toISOString(),
    connectedByUserId: ctx.userId,
  };

  const client = new PaycorApiClient(testConfig);
  const result = await client.healthCheck();

  if (!result.ok) {
    return { ok: false, error: result.error ?? "Connection test failed" };
  }

  return { ok: true, message: "Connection successful." };
}

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
  } catch { /* audit failures must not break the action */ }

  revalidatePath("/dashboard/settings/integrations");
  revalidatePath("/dashboard");
  return { ok: true, message: "Paycor disconnected." };
}
