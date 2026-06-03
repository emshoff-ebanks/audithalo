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
  // Roles
  MEMBER_ROLE_CHANGED: "member.role_changed",
} as const;
