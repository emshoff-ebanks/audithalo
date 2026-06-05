/**
 * Roster compliance queries.
 *
 * getOrgRosterWithCompliance uses exactly 3 DB queries:
 *   1. orgMemberships JOIN users  (supervisees only)
 *   2. superviseeRuleAssignments  (for those supervisees)
 *   3. sessionEvents              (for those supervisees)
 *
 * All joining is done in memory, then computeRosterCompliance (pure, testable)
 * performs the rule evaluation and pending-signature count.
 *
 * The DB client (`@/lib/db`) throws on import when DATABASE_URL is absent, so
 * we lazy-import it inside the async function to keep `computeRosterCompliance`
 * importable in unit tests.
 */

import { evaluate, loadAllRules } from "@/lib/rules";
import type { EvaluationContext, EvaluationResult } from "@/lib/rules/types";
import type { SessionSignature } from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Inline mirror of schema.sessionEvents.$inferSelect
// Defined here so the type is usable in tests without triggering the DB import.
// ---------------------------------------------------------------------------

// SYNC WITH schema.sessionEvents — update if columns change
export type SessionEventRecord = {
  id: string;
  superviseeId: string;
  orgId: string;
  kind: string;
  date: Date;
  durationHours: number;
  sessionType: string | null;
  supervisorCredentials: unknown;
  groupAttendees: number | null;
  loggedById: string;
  signatures: SessionSignature[] | null;
  signedAt: Date | null;
  createdAt: Date;
};

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type RawEntry = {
  userId: string;
  name: string;
  email: string;
  state: string | null;
  licenseType: string | null;
  ruleId: string | null;
  obligationStartedAt: Date | null;
  supervisionContractFiledAt: Date | null;
  permitExpiresAt: Date | null;
  rawEvents: SessionEventRecord[];
};

export type RosterRow = {
  userId: string;
  name: string;
  email: string;
  state: string | null;
  licenseType: string | null;
  ruleId: string | null;
  obligationStartedAt: Date | null;
  supervisionContractFiledAt: Date | null;
  permitExpiresAt: Date | null;
  evaluation: EvaluationResult | null;
  pendingSignatureCount: number;
};

// ---------------------------------------------------------------------------
// Pure computation (exported for unit testing)
// ---------------------------------------------------------------------------

export function computeRosterCompliance(entries: RawEntry[]): RosterRow[] {
  const rules = loadAllRules();

  return entries.map((entry) => {
    // Count pending signatures: supervision events where signedAt is null
    const pendingSignatureCount = entry.rawEvents.filter(
      (e) => e.kind === "supervision" && e.signedAt === null
    ).length;

    // Cannot evaluate without a rule assignment and obligation start date
    if (!entry.ruleId || !entry.obligationStartedAt) {
      return {
        userId: entry.userId,
        name: entry.name,
        email: entry.email,
        state: entry.state,
        licenseType: entry.licenseType,
        ruleId: entry.ruleId,
        obligationStartedAt: entry.obligationStartedAt,
        supervisionContractFiledAt: entry.supervisionContractFiledAt,
        permitExpiresAt: entry.permitExpiresAt,
        evaluation: null,
        pendingSignatureCount,
      };
    }

    const rule = rules.get(entry.ruleId.toLowerCase());

    if (!rule) {
      return {
        userId: entry.userId,
        name: entry.name,
        email: entry.email,
        state: entry.state,
        licenseType: entry.licenseType,
        ruleId: entry.ruleId,
        obligationStartedAt: entry.obligationStartedAt,
        supervisionContractFiledAt: entry.supervisionContractFiledAt,
        permitExpiresAt: entry.permitExpiresAt,
        evaluation: null,
        pendingSignatureCount,
      };
    }

    // Map DB session events to EvaluationContext sessions.
    // All logged events count toward compliance hours; signed vs. unsigned status
    // is tracked separately via pendingSignatureCount and the evidence package layer.
    const sessions: EvaluationContext["sessions"] = [];
    for (const evt of entry.rawEvents) {
      if (evt.kind === "practice") {
        sessions.push({
          kind: "practice",
          id: evt.id,
          date: evt.date.toISOString(),
          durationHours: evt.durationHours,
        });
      } else if (evt.kind === "supervision") {
        const sessionType = (evt.sessionType ?? "individual") as
          | "individual"
          | "triadic"
          | "group";
        const supervisorCredentials: string[] = Array.isArray(
          evt.supervisorCredentials
        )
          ? (evt.supervisorCredentials as string[])
          : [];

        sessions.push({
          kind: "supervision",
          id: evt.id,
          date: evt.date.toISOString(),
          durationHours: evt.durationHours,
          sessionType,
          supervisorCredentials,
          ...(evt.groupAttendees !== null
            ? { groupAttendees: evt.groupAttendees }
            : {}),
        });
      }
    }

    const ctx: EvaluationContext = {
      superviseeId: entry.userId,
      startedAt: entry.obligationStartedAt.toISOString(),
      supervisionContractFiledAt:
        entry.supervisionContractFiledAt?.toISOString(),
      permitExpiresAt: entry.permitExpiresAt?.toISOString(),
      sessions,
    };

    const evaluation = evaluate(ctx, rule);

    return {
      userId: entry.userId,
      name: entry.name,
      email: entry.email,
      state: entry.state,
      licenseType: entry.licenseType,
      ruleId: entry.ruleId,
      obligationStartedAt: entry.obligationStartedAt,
      supervisionContractFiledAt: entry.supervisionContractFiledAt,
      permitExpiresAt: entry.permitExpiresAt,
      evaluation,
      pendingSignatureCount,
    };
  });
}

// ---------------------------------------------------------------------------
// DB query (exactly 3 queries — no N+1)
// Lazy-imports @/lib/db so this module can be imported in tests without a
// live DATABASE_URL.
// ---------------------------------------------------------------------------

export async function getOrgRosterWithCompliance(
  orgId: string
): Promise<RosterRow[]> {
  const [{ db, schema }, { and, eq, inArray }] = await Promise.all([
    import("@/lib/db"),
    import("drizzle-orm"),
  ]);

  // Query 1: supervisees in this org joined with user profile data
  const superviseeRows = await db
    .select({
      userId: schema.orgMemberships.userId,
      name: schema.users.name,
      email: schema.users.email,
      state: schema.users.state,
      licenseType: schema.users.licenseType,
    })
    .from(schema.orgMemberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.orgMemberships.userId))
    .where(
      and(
        eq(schema.orgMemberships.orgId, orgId),
        eq(schema.orgMemberships.role, "supervisee")
      )
    );

  const superviseeIds = superviseeRows.map((r) => r.userId);
  if (superviseeIds.length === 0) return [];

  // Query 2: rule assignments for those supervisees in this org
  const assignments = await db
    .select()
    .from(schema.superviseeRuleAssignments)
    .where(
      and(
        inArray(schema.superviseeRuleAssignments.superviseeId, superviseeIds),
        eq(schema.superviseeRuleAssignments.orgId, orgId)
      )
    );

  const assignmentByUser = new Map(
    assignments.map((a) => [a.superviseeId, a])
  );

  // Query 3: all session events for those supervisees in this org
  const events = await db
    .select()
    .from(schema.sessionEvents)
    .where(
      and(
        inArray(schema.sessionEvents.superviseeId, superviseeIds),
        eq(schema.sessionEvents.orgId, orgId)
      )
    );

  // Group events by superviseeId
  const eventsByUser = new Map<string, typeof events>();
  for (const evt of events) {
    const existing = eventsByUser.get(evt.superviseeId) ?? [];
    existing.push(evt);
    eventsByUser.set(evt.superviseeId, existing);
  }

  // Assemble RawEntry list and compute compliance in memory
  const rawEntries: RawEntry[] = superviseeRows.map((row) => {
    const assignment = assignmentByUser.get(row.userId);
    return {
      userId: row.userId,
      name: row.name,
      email: row.email,
      state: row.state,
      licenseType: row.licenseType,
      ruleId: assignment?.ruleId ?? null,
      obligationStartedAt: assignment?.obligationStartedAt ?? null,
      supervisionContractFiledAt:
        assignment?.supervisionContractFiledAt ?? null,
      permitExpiresAt: assignment?.permitExpiresAt ?? null,
      rawEvents: (eventsByUser.get(row.userId) ?? []) as SessionEventRecord[],
    };
  });

  return computeRosterCompliance(rawEntries);
}
