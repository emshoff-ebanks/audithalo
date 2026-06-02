import type { EvaluationContext } from "@/lib/rules";

/**
 * Helper to build a synthetic evaluation context with a mix of practice and
 * supervision sessions. Each `practiceDays` offset adds 8 practice hours.
 * Each `individualSupDays` offset adds 1 hour of individual supervision by
 * default; each `groupSupDays` offset adds 2 hours of group supervision.
 *
 * `supervisorCredentials` is REQUIRED: it varies per state, so callers must
 * pass it explicitly. Pass `[BAD_CRED]` to exercise the credential check.
 */
export function buildLog(opts: {
  startedAt: string;
  contractFiledAt?: string;
  practiceDays: number[];           // ISO offsets from start, each adds 8 practice hours
  individualSupDays?: number[];     // ISO offsets where 1 hr individual sup occurs
  groupSupDays?: number[];          // ISO offsets where 2 hr group sup occurs
  individualSupHours?: number;      // default 1
  groupSupHours?: number;           // default 2
  groupAttendees?: number;          // default 6
  supervisorCredentials: string[];  // REQUIRED — varies per state
  asOf?: string;
}): EvaluationContext {
  const start = Date.parse(opts.startedAt);
  const dayMs = 1000 * 60 * 60 * 24;
  const sessions: EvaluationContext["sessions"] = [];

  for (const [i, offset] of opts.practiceDays.entries()) {
    sessions.push({
      kind: "practice",
      id: `p${i}`,
      date: new Date(start + offset * dayMs).toISOString(),
      durationHours: 8,
    });
  }
  for (const [i, offset] of (opts.individualSupDays ?? []).entries()) {
    sessions.push({
      kind: "supervision",
      id: `i${i}`,
      date: new Date(start + offset * dayMs).toISOString(),
      durationHours: opts.individualSupHours ?? 1,
      sessionType: "individual",
      supervisorCredentials: opts.supervisorCredentials,
    });
  }
  for (const [i, offset] of (opts.groupSupDays ?? []).entries()) {
    sessions.push({
      kind: "supervision",
      id: `g${i}`,
      date: new Date(start + offset * dayMs).toISOString(),
      durationHours: opts.groupSupHours ?? 2,
      sessionType: "group",
      supervisorCredentials: opts.supervisorCredentials,
      groupAttendees: opts.groupAttendees ?? 6,
    });
  }

  return {
    superviseeId: "test-supervisee",
    startedAt: opts.startedAt,
    supervisionContractFiledAt: opts.contractFiledAt,
    sessions,
    asOf: opts.asOf,
  };
}
