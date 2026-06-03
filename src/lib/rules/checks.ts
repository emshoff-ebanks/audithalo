// Named compliance checks. Each check is a pure function that takes the
// evaluation context, the rule, and its own parameters, and returns any gaps
// it finds. Adding a new state's rule typically reuses these checks with
// different params; new behavior gets a new check id here.

import type {
  EvaluationContext,
  Gap,
  Rule,
  RuleCheck,
  SessionEvent,
} from "./types";

type CheckFn = (
  ctx: EvaluationContext,
  rule: Rule,
  check: RuleCheck
) => Gap[];

// ---------------------------------------------------------------------------
// Internals — session helpers
// ---------------------------------------------------------------------------

const isSupervision = (
  s: SessionEvent
): s is Extract<SessionEvent, { kind: "supervision" }> =>
  s.kind === "supervision";

const isPractice = (
  s: SessionEvent
): s is Extract<SessionEvent, { kind: "practice" }> => s.kind === "practice";

function sortedByDate(sessions: SessionEvent[]): SessionEvent[] {
  return [...sessions].sort(
    (a, b) => Date.parse(a.date) - Date.parse(b.date)
  );
}

function daysBetween(a: string, b: string): number {
  const ms = Math.abs(Date.parse(b) - Date.parse(a));
  return ms / (1000 * 60 * 60 * 24);
}

/** ISO 8601 week key in "YYYY-Www" form (Mon-Sun week; Thursday determines year). */
function isoWeekKey(isoDate: string): string {
  const d = new Date(isoDate);
  // Mon=0...Sun=6
  const day = (d.getUTCDay() + 6) % 7;
  // Move to Thursday of the same ISO week — Thursday determines the ISO year
  d.setUTCDate(d.getUTCDate() - day + 3);
  const thursdayYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(thursdayYear, 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  const weekNum =
    Math.round(
      (d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000)
    ) + 1;
  return `${thursdayYear}-W${weekNum.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/** Blocker: supervision contract must be filed before any hour can count. */
const preRegistrationRequired: CheckFn = (ctx, _rule, check) => {
  const signal = check.params.signal_field as string;
  const filed =
    signal === "supervisionContractFiledAt"
      ? ctx.supervisionContractFiledAt
      : undefined;
  if (!filed) {
    return [
      {
        code: check.id,
        severity: check.severity,
        message:
          "Supervision contract has not been filed with the state board. No hours can count until it is filed.",
      },
    ];
  }
  // Sessions that pre-date the filing don't count
  const firstSession = sortedByDate(ctx.sessions)[0];
  if (firstSession && Date.parse(firstSession.date) < Date.parse(filed)) {
    return [
      {
        code: check.id,
        severity: check.severity,
        message:
          "Hours logged before the supervision contract was filed do not count toward licensure.",
        detail: {
          contractFiledAt: filed,
          firstSessionDate: firstSession.date,
        },
      },
    ];
  }
  return [];
};

/** Blocker: every supervision session must be conducted by a credentialed supervisor. */
const supervisorCredentialRequired: CheckFn = (ctx, _rule, check) => {
  const accepted = (check.params.accepted_credentials as string[]) ?? [];
  const offenders = ctx.sessions.filter(
    (s): s is Extract<SessionEvent, { kind: "supervision" }> =>
      isSupervision(s) &&
      !s.supervisorCredentials.some((c) => accepted.includes(c))
  );
  if (offenders.length === 0) return [];
  return [
    {
      code: check.id,
      severity: check.severity,
      message: `${offenders.length} supervision session(s) lack a supervisor with required credential (${accepted.join(", ")}).`,
      detail: { offendingSessionIds: offenders.map((s) => s.id) },
    },
  ];
};

/** Warning: cadence — at least one individual supervision per N days of practice. */
const individualSupervisionCadence: CheckFn = (ctx, _rule, check) => {
  const maxGapDays = check.params.max_gap_days as number;
  const minHoursPerPeriod = check.params.min_hours_per_period as number;

  const sorted = sortedByDate(ctx.sessions);
  const practiceStart = sorted.find(isPractice);
  if (!practiceStart) return []; // no practice yet, no cadence to break

  const individualSups = sorted.filter(
    (s) => isSupervision(s) && s.sessionType === "individual"
  );

  // Walk through practice timeline; verify there is at least minHoursPerPeriod
  // of individual supervision in every rolling maxGapDays window after each practice event.
  const gaps: Gap[] = [];
  const asOf = ctx.asOf ? Date.parse(ctx.asOf) : Date.now();

  let lastIndividualByDate = Date.parse(practiceStart.date);
  for (const sup of individualSups) {
    const supDate = Date.parse(sup.date);
    const gap = daysBetween(
      new Date(lastIndividualByDate).toISOString(),
      sup.date
    );
    if (gap > maxGapDays) {
      gaps.push({
        code: check.id,
        severity: check.severity,
        message: `Individual supervision gap of ${Math.round(gap)} days exceeds the ${maxGapDays}-day maximum.`,
        detail: { from: new Date(lastIndividualByDate).toISOString().slice(0, 10), to: sup.date },
      });
    }
    lastIndividualByDate = supDate;
  }
  // Tail: how long since the last individual supervision relative to "now"
  const tailGap = (asOf - lastIndividualByDate) / (1000 * 60 * 60 * 24);
  if (tailGap > maxGapDays) {
    gaps.push({
      code: check.id,
      severity: check.severity,
      message: `It has been ${Math.round(tailGap)} days since the last individual supervision; the maximum is ${maxGapDays}.`,
      detail: { lastIndividualAt: new Date(lastIndividualByDate).toISOString().slice(0, 10) },
    });
  }

  // The check params also constrain min hours per period; we don't enforce
  // per-window total here in v1 — only the gap. A future check can compute
  // rolling-window totals if NC starts enforcing it more granularly.
  void minHoursPerPeriod;

  return gaps;
};

/** Warning: in any ISO week with > min_direct_hours_threshold practice hours,
 *  there must be at least min_individual_hours_per_week of individual or
 *  triadic supervision in that same week. Models CA's 16 CCR §1820 cadence. */
const weeklySupervisionCadence: CheckFn = (ctx, _rule, check) => {
  const threshold = (check.params.min_direct_hours_threshold as number) ?? 0;
  const minInd = (check.params.min_individual_hours_per_week as number) ?? 1;

  // Bucket sessions by ISO week (Mon-Sun). ISO week key: "YYYY-Www".
  const buckets = new Map<
    string,
    { practiceHours: number; individualHours: number; firstDate: string }
  >();
  for (const s of ctx.sessions) {
    const weekKey = isoWeekKey(s.date);
    const bucket =
      buckets.get(weekKey) ?? {
        practiceHours: 0,
        individualHours: 0,
        firstDate: s.date,
      };
    if (s.kind === "practice") {
      bucket.practiceHours += s.durationHours;
    } else if (
      s.kind === "supervision" &&
      (s.sessionType === "individual" || s.sessionType === "triadic")
    ) {
      bucket.individualHours += s.durationHours;
    }
    buckets.set(weekKey, bucket);
  }

  const offendingWeeks: Array<{
    week: string;
    practiceHours: number;
    individualHours: number;
  }> = [];
  for (const [weekKey, b] of buckets) {
    if (b.practiceHours > threshold && b.individualHours < minInd) {
      offendingWeeks.push({
        week: weekKey,
        practiceHours: b.practiceHours,
        individualHours: b.individualHours,
      });
    }
  }

  if (offendingWeeks.length === 0) return [];
  return [
    {
      code: check.id,
      severity: check.severity,
      message: `${offendingWeeks.length} week(s) exceeded ${threshold} practice hours without ${minInd} hr individual/triadic supervision.`,
      detail: { offendingWeeks: offendingWeeks.slice(0, 10) },
    },
  ];
};

/** Warning: each block of practice_hours_per_block must include enough supervision (individual OR group). */
const supervisionRatioPerPracticeBlock: CheckFn = (ctx, _rule, check) => {
  const block = check.params.practice_hours_per_block as number;
  const indReq = check.params.individual_hours_required as number;
  const grpReq = check.params.group_hours_required as number;

  // Walk the sorted timeline. Maintain a running practice-hours-since-last-credit.
  // Each block becomes "credited" when either indReq individual hours OR grpReq group hours
  // accrue inside that block window.
  const sorted = sortedByDate(ctx.sessions);
  let practiceInBlock = 0;
  let indInBlock = 0;
  let grpInBlock = 0;
  let uncoveredBlocks = 0;

  for (const s of sorted) {
    if (isPractice(s)) {
      practiceInBlock += s.durationHours;
    } else if (isSupervision(s)) {
      if (s.sessionType === "individual") indInBlock += s.durationHours;
      else grpInBlock += s.durationHours; // triadic + group both count toward group hours
    }

    // Have we crossed a block boundary?
    while (practiceInBlock >= block) {
      const credited = indInBlock >= indReq || grpInBlock >= grpReq;
      if (!credited) uncoveredBlocks += 1;
      practiceInBlock -= block;
      // Carry leftover supervision into next block proportionally
      indInBlock = Math.max(0, indInBlock - indReq);
      grpInBlock = Math.max(0, grpInBlock - grpReq);
    }
  }

  if (uncoveredBlocks > 0) {
    return [
      {
        code: check.id,
        severity: check.severity,
        message: `${uncoveredBlocks} block(s) of ${block} practice hours lack the required ${indReq} hr individual OR ${grpReq} hr group supervision.`,
        detail: { uncoveredBlocks },
      },
    ];
  }
  return [];
};

/** Warning: cumulative individual share must be ≥ N after a warm-up threshold. */
const individualSupervisionMinimumShare: CheckFn = (ctx, _rule, check) => {
  const minFrac = check.params.min_individual_fraction as number;
  const warmup = (check.params.enforce_after_practice_hours as number) ?? 0;

  let practice = 0;
  let ind = 0;
  let nonInd = 0;
  for (const s of ctx.sessions) {
    if (isPractice(s)) practice += s.durationHours;
    else if (isSupervision(s)) {
      if (s.sessionType === "individual") ind += s.durationHours;
      else nonInd += s.durationHours;
    }
  }
  if (practice < warmup) return [];
  const total = ind + nonInd;
  if (total === 0) return [];
  const frac = ind / total;
  if (frac < minFrac) {
    return [
      {
        code: check.id,
        severity: check.severity,
        message: `Individual supervision is ${(frac * 100).toFixed(0)}% of total supervision; the minimum is ${(minFrac * 100).toFixed(0)}%.`,
        detail: {
          individualHours: ind,
          nonIndividualHours: nonInd,
          fraction: frac,
        },
      },
    ];
  }
  return [];
};

/** Blocker: no group session exceeds the attendee cap. */
const groupSizeLimit: CheckFn = (ctx, _rule, check) => {
  const maxAttendees = check.params.max_attendees as number;
  const offenders = ctx.sessions.filter(
    (s): s is Extract<SessionEvent, { kind: "supervision" }> =>
      isSupervision(s) &&
      s.sessionType === "group" &&
      (s.groupAttendees ?? 0) > maxAttendees
  );
  if (offenders.length === 0) return [];
  return [
    {
      code: check.id,
      severity: check.severity,
      message: `${offenders.length} group session(s) exceeded the ${maxAttendees}-attendee maximum.`,
      detail: { offendingSessionIds: offenders.map((s) => s.id) },
    },
  ];
};

/** Info: practice-hour total progress toward total_practice_hours_required. */
const totalPracticeHours: CheckFn = (ctx, _rule, check) => {
  const required = check.params.required as number;
  const total = ctx.sessions
    .filter(isPractice)
    .reduce((acc, s) => acc + s.durationHours, 0);
  if (total >= required) return [];
  return [
    {
      code: check.id,
      severity: check.severity,
      message: `${total.toFixed(1)} of ${required} required practice hours logged (${((total / required) * 100).toFixed(0)}%).`,
      detail: { logged: total, required },
    },
  ];
};

/** Info: supervision-hour total progress toward total_supervision_hours_required. */
const totalSupervisionHours: CheckFn = (ctx, _rule, check) => {
  const required = check.params.required as number;
  const total = ctx.sessions
    .filter(isSupervision)
    .reduce((acc, s) => acc + s.durationHours, 0);
  if (total >= required) return [];
  return [
    {
      code: check.id,
      severity: check.severity,
      message: `${total.toFixed(1)} of ${required} required supervision hours logged (${((total / required) * 100).toFixed(0)}%).`,
      detail: { logged: total, required },
    },
  ];
};

/** Warning: obligation must fall within [min_months, max_months] window. */
const durationWindow: CheckFn = (ctx, _rule, check) => {
  const min = check.params.min_months as number;
  const max = check.params.max_months as number;
  const start = Date.parse(ctx.startedAt);
  const now = ctx.asOf ? Date.parse(ctx.asOf) : Date.now();
  const months = (now - start) / (1000 * 60 * 60 * 24 * 30.44);
  const gaps: Gap[] = [];
  if (months > max) {
    gaps.push({
      code: check.id,
      severity: check.severity,
      message: `Obligation has run ${months.toFixed(1)} months — past the ${max}-month maximum.`,
      detail: { months, max },
    });
  }
  // We don't gap on `months < min` because that's expected during the obligation;
  // it only matters at completion. The dashboard surfaces remaining time.
  void min;
  return gaps;
};

/** Permit/registration expiration check: blocker when past max_months,
 *  warning when within warning_window_days of expiry. The check overrides
 *  the YAML-declared severity dynamically based on state. */
const permitExpirationWindow: CheckFn = (ctx, _rule, check) => {
  const maxMonths = check.params.max_months as number;
  const warningWindowDays =
    (check.params.warning_window_days as number) ?? 90;

  const start = Date.parse(ctx.startedAt);
  const now = ctx.asOf ? Date.parse(ctx.asOf) : Date.now();
  const monthsElapsed = (now - start) / (1000 * 60 * 60 * 24 * 30.44);
  const monthsRemaining = maxMonths - monthsElapsed;
  const daysRemaining = monthsRemaining * 30.44;

  if (monthsElapsed > maxMonths) {
    return [
      {
        code: check.id,
        severity: "blocker", // override: past expiry is always blocker
        message: `Permit / registration expired ${(monthsElapsed - maxMonths).toFixed(1)} months ago. Non-renewable permits cannot be extended — the supervisee must re-apply.`,
        detail: { monthsElapsed, maxMonths },
      },
    ];
  }
  if (daysRemaining > 0 && daysRemaining <= warningWindowDays) {
    return [
      {
        code: check.id,
        severity: "warning", // override: in window is always warning
        message: `Permit / registration expires in ${Math.round(daysRemaining)} days. Plan the final supervision sessions accordingly.`,
        detail: { daysRemaining: Math.round(daysRemaining), maxMonths },
      },
    ];
  }
  return [];
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const CHECK_REGISTRY: Record<string, CheckFn> = {
  pre_registration_required: preRegistrationRequired,
  supervisor_credential_required: supervisorCredentialRequired,
  individual_supervision_cadence: individualSupervisionCadence,
  weekly_supervision_cadence: weeklySupervisionCadence,
  supervision_ratio_per_practice_block: supervisionRatioPerPracticeBlock,
  individual_supervision_minimum_share: individualSupervisionMinimumShare,
  group_size_limit: groupSizeLimit,
  total_practice_hours: totalPracticeHours,
  total_supervision_hours: totalSupervisionHours,
  duration_window: durationWindow,
  permit_expiration_window: permitExpirationWindow,
};

export function runCheck(
  ctx: EvaluationContext,
  rule: Rule,
  check: RuleCheck
): Gap[] {
  const fn = CHECK_REGISTRY[check.id];
  if (!fn) {
    throw new Error(
      `Unknown check id "${check.id}" referenced by rule ${rule.jurisdiction}-${rule.license_code}-v${rule.version}`
    );
  }
  return fn(ctx, rule, check);
}
