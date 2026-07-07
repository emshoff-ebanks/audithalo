/**
 * Paycor daily sync cron.
 *
 * Polls Paycor for each org with paycorConfig set, diffs the roster
 * against AuditHalo's org_memberships, and applies changes (hires,
 * terminations, leave status updates) via applyPaycorChange().
 *
 * Schedule: daily at 18:00 ET (after RI's COB). GitHub Actions
 * workflow `.github/workflows/paycor-sync.yml`, schedule paused
 * initially (same pattern as sign-reminders).
 *
 * See docs/strategy/15-settings-ui-and-api-client.md §Pass 4.
 */

import { eq, and, isNotNull, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import type { PaycorConfig } from "@/lib/db/schema";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit-log";
import { verifyCronAuth } from "@/lib/cron-auth";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { diffRoster } from "@/lib/hris/diff-roster";
import type { CurrentMember } from "@/lib/hris/diff-roster";
import { applyPaycorChange } from "@/lib/hris/apply-change";
import { PaycorApiClient } from "@/lib/hris/paycor-api-client";
import { SeatCapExceededError } from "@/lib/hris/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function decryptPaycorConfig(config: PaycorConfig): PaycorConfig {
  return {
    ...config,
    apimSubscriptionKey: decryptToken(config.apimSubscriptionKey),
    oauthClientSecret: decryptToken(config.oauthClientSecret),
    oauthRefreshToken: config.oauthRefreshToken
      ? decryptToken(config.oauthRefreshToken)
      : undefined,
    oauthAccessToken: config.oauthAccessToken
      ? decryptToken(config.oauthAccessToken)
      : undefined,
    sftpPrivateKey: config.sftpPrivateKey
      ? decryptToken(config.sftpPrivateKey)
      : undefined,
  };
}

async function handle(request: Request) {
  const authFail = verifyCronAuth(request);
  if (authFail) return authFail;

  const now = new Date();

  const orgs = await db.query.organizations.findMany({
    where: isNotNull(schema.organizations.paycorConfig),
  });

  let orgsProcessed = 0;
  let totalHired = 0;
  let totalTerminated = 0;
  let totalLeaveChanged = 0;
  let totalRoleChanged = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const orgErrors: Array<{ orgId: string; orgName: string; error: string }> = [];

  for (const org of orgs) {
    if (!org.paycorConfig) continue;
    const { legalEntityId } = org.paycorConfig;
    if (!legalEntityId) continue;

    let orgChangeCount = 0;
    let orgSyncStatus: "success" | "partial" | "failed" = "success";

    try {
      const decrypted = decryptPaycorConfig(org.paycorConfig);

      const client = new PaycorApiClient(decrypted, async (tokens) => {
        const updatedConfig: PaycorConfig = {
          ...org.paycorConfig!,
          oauthAccessToken: encryptToken(tokens.oauthAccessToken),
          oauthRefreshToken: encryptToken(tokens.oauthRefreshToken),
          tokenExpiresAt: tokens.tokenExpiresAt,
        };
        await db
          .update(schema.organizations)
          .set({ paycorConfig: updatedConfig })
          .where(eq(schema.organizations.id, org.id));
        org.paycorConfig = updatedConfig;
      });

      const paycorEmployees = await client.fetchEmployees(legalEntityId);

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

      const diffs = diffRoster(paycorEmployees, currentMembers, org.id);

      for (const { change, context } of diffs) {
        try {
          const result = await applyPaycorChange(change, context);
          switch (result.action) {
            case "created":
              totalHired++;
              orgChangeCount++;
              break;
            case "deactivated":
              totalTerminated++;
              orgChangeCount++;
              break;
            case "updated":
              if (change.kind === "leave_status_changed") totalLeaveChanged++;
              else if (change.kind === "employee_hired") totalHired++;
              else if (change.kind === "role_changed") totalRoleChanged++;
              orgChangeCount++;
              break;
            case "skipped":
              totalSkipped++;
              break;
          }
        } catch (err) {
          totalErrors++;
          orgSyncStatus = "partial";
          if (err instanceof SeatCapExceededError) {
            console.error(
              `[paycor-sync] Seat cap exceeded for org ${org.id}: ${err.message}`,
            );
          } else {
            console.error(
              `[paycor-sync] Failed to apply ${change.kind} for org ${org.id}:`,
              err,
            );
          }
        }
      }

      orgsProcessed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[paycor-sync] Failed to sync org ${org.id}:`, err);
      orgErrors.push({ orgId: org.id, orgName: org.name, error: message });
      orgSyncStatus = "failed";
    }

    try {
      const updatedConfig: PaycorConfig = {
        ...org.paycorConfig!,
        lastSyncAt: now.toISOString(),
        lastSyncStatus: orgSyncStatus,
        lastSyncChanges: orgChangeCount,
      };
      await db
        .update(schema.organizations)
        .set({ paycorConfig: updatedConfig })
        .where(eq(schema.organizations.id, org.id));
    } catch (err) {
      console.error(
        `[paycor-sync] Failed to update sync metadata for org ${org.id}:`,
        err,
      );
    }
  }

  return NextResponse.json({
    ok: orgErrors.length === 0,
    runAt: now.toISOString(),
    orgsProcessed,
    changes: {
      hired: totalHired,
      terminated: totalTerminated,
      leaveChanged: totalLeaveChanged,
      roleChanged: totalRoleChanged,
      skipped: totalSkipped,
      errors: totalErrors,
    },
    ...(orgErrors.length > 0 ? { orgErrors } : {}),
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
