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
 * See docs/strategy/14-wave2-phase2-scaffolding.md §Pass 2.
 */

import { eq, and, isNotNull, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit-log";
import { verifyCronAuth } from "@/lib/cron-auth";
import { diffRoster } from "@/lib/hris/diff-roster";
import type { CurrentMember } from "@/lib/hris/diff-roster";
import { applyPaycorChange } from "@/lib/hris/apply-change";
import { MockPaycorProvider } from "@/lib/hris/paycor-provider";
import type { PaycorProvider } from "@/lib/hris/paycor-provider";
import { SeatCapExceededError } from "@/lib/hris/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getProvider(): PaycorProvider {
  // Phase 3: swap for real Paycor API client once credentials arrive.
  // The mock provider returns empty rosters (no changes) unless
  // test data is configured — safe for production.
  return new MockPaycorProvider();
}

async function handle(request: Request) {
  const authFail = verifyCronAuth(request);
  if (authFail) return authFail;

  const now = new Date();
  const provider = getProvider();

  const orgs = await db.query.organizations.findMany({
    where: isNotNull(schema.organizations.paycorConfig),
  });

  let orgsProcessed = 0;
  let totalHired = 0;
  let totalTerminated = 0;
  let totalLeaveChanged = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const orgErrors: Array<{ orgId: string; orgName: string; error: string }> = [];

  for (const org of orgs) {
    if (!org.paycorConfig) continue;
    const { legalEntityId } = org.paycorConfig;
    if (!legalEntityId) continue;

    try {
      const paycorEmployees = await provider.fetchEmployees(legalEntityId);

      const memberships = await db
        .select({
          membershipId: schema.orgMemberships.id,
          userId: schema.orgMemberships.userId,
          role: schema.orgMemberships.role,
          deactivatedAt: schema.orgMemberships.deactivatedAt,
          leaveStatus: schema.orgMemberships.leaveStatus,
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
      }));

      const diffs = diffRoster(paycorEmployees, currentMembers, org.id);

      for (const { change, context } of diffs) {
        try {
          const result = await applyPaycorChange(change, context);
          switch (result.action) {
            case "created":
              totalHired++;
              break;
            case "deactivated":
              totalTerminated++;
              break;
            case "updated":
              if (change.kind === "leave_status_changed") totalLeaveChanged++;
              else if (change.kind === "employee_hired") totalHired++;
              break;
            case "skipped":
              totalSkipped++;
              break;
          }
        } catch (err) {
          totalErrors++;
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
