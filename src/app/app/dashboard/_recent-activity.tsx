import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { db, schema } from "@/lib/db";

type Props = {
  orgId: string;
};

// Only surface user-facing actions on the home page. The full audit log
// (every event) lives at /dashboard/audit-log for HR Admins who want
// the unfiltered trail. This list intentionally omits low-signal events
// like view-only reads.
const SURFACED_ACTIONS = [
  "rule.assigned",
  "rule.changed",
  "session.signed",
  "session.sealed",
  "session.scheduled",
  "session.canceled",
  "session.no_show",
  "session.rescheduled",
  "invitation.accepted",
  "invitation.sent",
  "attestation.created",
  "org_rule_override.upserted",
  "org_rule_override.deactivated",
  "org_custom_rule.created",
  "member.role_changed",
] as const;

/**
 * "Recent activity" feed on the supervisor / HR Admin dashboard home.
 *
 * Pulls the last 5 audit-log entries scoped to the org. Each row is a
 * one-line narrative built from the action verb + actor name + the
 * affected resource. Gives a sense of org motion without sending the
 * user to the full audit log.
 *
 * Per UX-principle no.3: the widget hides itself when there's nothing
 * to show — fresh orgs that haven't generated any audit history don't
 * see an empty pane.
 */
export async function RecentActivity({ orgId }: Props) {
  const rows = await db
    .select({
      id: schema.auditLogEntries.id,
      createdAt: schema.auditLogEntries.createdAt,
      action: schema.auditLogEntries.action,
      actorUserId: schema.auditLogEntries.actorUserId,
      resourceType: schema.auditLogEntries.resourceType,
      resourceId: schema.auditLogEntries.resourceId,
      details: schema.auditLogEntries.details,
    })
    .from(schema.auditLogEntries)
    .where(
      and(
        eq(schema.auditLogEntries.orgId, orgId),
        inArray(
          schema.auditLogEntries.action,
          SURFACED_ACTIONS as unknown as string[]
        )
      )
    )
    .orderBy(desc(schema.auditLogEntries.createdAt))
    .limit(5);

  if (rows.length === 0) return null;

  // One round-trip to resolve actor display names. Most rows share actors
  // so the user query is small even on busy orgs.
  const actorIds = Array.from(
    new Set(rows.map((r) => r.actorUserId).filter((v): v is string => !!v))
  );
  const actors =
    actorIds.length > 0
      ? await db
          .select({
            id: schema.users.id,
            name: schema.users.name,
            email: schema.users.email,
          })
          .from(schema.users)
          .where(inArray(schema.users.id, actorIds))
      : [];
  const actorById = new Map(
    actors.map((a) => [a.id, a.name ?? a.email ?? "An admin"])
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Recent activity
        </h2>
        <Link
          href="/dashboard/audit-log"
          className="text-xs text-foreground/60 hover:text-foreground"
        >
          Open audit log &rarr;
        </Link>
      </div>
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li
                key={r.id}
                className="px-4 py-3 text-sm flex flex-wrap items-baseline gap-x-2"
              >
                <span className="text-foreground/60 text-xs font-mono shrink-0">
                  {formatRelative(r.createdAt)}
                </span>
                <span className="text-foreground/85 min-w-0">
                  {describe(
                    r.action,
                    r.actorUserId
                      ? actorById.get(r.actorUserId) ?? "an admin"
                      : "the system",
                    r.details ?? null
                  )}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function describe(
  action: string,
  actor: string,
  details: Record<string, unknown> | null
): string {
  const ruleId =
    details && typeof details.ruleId === "string" ? details.ruleId : null;
  const newRuleId =
    details && typeof details.newRuleId === "string"
      ? (details.newRuleId as string)
      : null;
  switch (action) {
    case "rule.assigned":
      return `${actor} assigned ${ruleId ?? "a rule"} to a supervisee.`;
    case "rule.changed":
      return `${actor} changed a supervisee's rule to ${newRuleId ?? ruleId ?? "a new version"}.`;
    case "session.signed":
      return `${actor} signed a supervision session.`;
    case "session.sealed":
      return `${actor} sealed a supervision session.`;
    case "session.scheduled":
      return `${actor} scheduled a supervision session.`;
    case "session.canceled":
      return `${actor} canceled a scheduled session.`;
    case "session.no_show":
      return `${actor} flagged a session as no-show.`;
    case "session.rescheduled":
      return `${actor} rescheduled a session.`;
    case "invitation.sent":
      return `${actor} sent an invitation.`;
    case "invitation.accepted":
      return `${actor} accepted an invitation.`;
    case "attestation.created":
      return `${actor} recorded an attestation.`;
    case "org_rule_override.upserted":
      return `${actor} updated a rule override.`;
    case "org_rule_override.deactivated":
      return `${actor} deactivated a rule override.`;
    case "org_custom_rule.created":
      return `${actor} created a custom state rule.`;
    case "member.role_changed":
      return `${actor} changed a team member's role.`;
    default:
      return `${actor} performed ${action}.`;
  }
}

function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d`;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(d);
}
