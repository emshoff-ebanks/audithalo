import { headers } from "next/headers";
import { db, schema } from "@/lib/db";

export type AuditLogInput = {
  orgId: string;
  actorUserId: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
};

/** Helper to grab the actor's IP from the current request headers. */
async function getActorIp(): Promise<string | null> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    return h.get("x-real-ip") ?? null;
  } catch {
    // headers() throws outside a request context — fine, return null
    return null;
  }
}

/** Append an audit log entry. Wrap call sites in try/catch — audit log failures
 *  must NEVER break the action being audited. */
export async function logAuditEvent(input: AuditLogInput): Promise<void> {
  const ipAddress = await getActorIp();
  await db.insert(schema.auditLogEntries).values({
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    details: input.details,
    ipAddress,
  });
}

/** Catalog of action codes. Keep snake_case dot-namespaced. */
export const AUDIT_ACTIONS = {
  // Invitations
  INVITATION_SENT: "invitation.sent",
  INVITATION_CANCELED: "invitation.canceled",
  INVITATION_RESENT: "invitation.resent",
  INVITATION_ACCEPTED: "invitation.accepted",
  // Rule assignment
  RULE_ASSIGNED: "rule.assigned",
  RULE_CHANGED: "rule.changed",
  // Sessions
  SESSION_LOGGED: "session.logged",
  SESSION_SIGNED: "session.signed",
  SESSION_SEALED: "session.sealed",
  SESSION_SCHEDULED: "session.scheduled",
  SESSION_CANCELED: "session.canceled",
  SESSION_NO_SHOW: "session.no_show",
  SESSION_RESCHEDULED: "session.rescheduled",
  SESSION_SIGN_REMINDER_SENT: "session.sign_reminder_sent",
  RECURRING_SERIES_CREATED: "session.recurring_series_created",
  // Roles
  MEMBER_ROLE_CHANGED: "member.role_changed",
  // Attestations (Phase 5.2)
  ATTESTATION_CREATED: "attestation.created",
  ATTESTATION_REVOKED: "attestation.revoked",
  // Org rule overrides (Cycle 3 — see docs/strategy/09-rules-admin.md)
  ORG_RULE_OVERRIDE_UPSERTED: "org_rule_override.upserted",
  ORG_RULE_OVERRIDE_DEACTIVATED: "org_rule_override.deactivated",
  // Custom org-authored rules (Cycle 4)
  ORG_CUSTOM_RULE_CREATED: "org_custom_rule.created",
  ORG_CUSTOM_RULE_DEACTIVATED: "org_custom_rule.deactivated",
  // Founding Supervisor program (NIM-4)
  FOUNDING_SUPERVISOR_GRANTED: "user.founding_supervisor_granted",
  FOUNDING_SUPERVISOR_REVOKED: "user.founding_supervisor_revoked",
  // Audit log export (E3 — Enterprise)
  AUDIT_LOG_EXPORTED: "audit_log.exported",
  // Org settings updates (E3 — Enterprise)
  ORG_SETTINGS_UPDATED: "org_settings.updated",
  // Paycor sync (Wave 2 Phase 2)
  PAYCOR_SYNC_EMPLOYEE_HIRED: "paycor_sync.employee_hired",
  PAYCOR_SYNC_EMPLOYEE_TERMINATED: "paycor_sync.employee_terminated",
  PAYCOR_SYNC_LEAVE_CHANGED: "paycor_sync.leave_changed",
  PAYCOR_SYNC_ROLE_CHANGED: "paycor_sync.role_changed",
  PAYCOR_SYNC_DELIVERY_QUEUED: "paycor_sync.delivery_queued",
  PAYCOR_SYNC_DELIVERY_COMPLETED: "paycor_sync.delivery_completed",
  PAYCOR_SYNC_DELIVERY_FAILED: "paycor_sync.delivery_failed",
  // Paycor connection management (Wave 2 Phase 3)
  PAYCOR_CONNECTED: "paycor.connected",
  PAYCOR_DISCONNECTED: "paycor.disconnected",
} as const;
