/**
 * Seed a fresh demo org with realistic supervisees + sessions, then
 * soft-delete the old damon-test-* test accounts. Designed for the
 * 2026-06-16 customer demo.
 *
 * Creates (in one transaction):
 *   - 1 org           "Atlas Counseling Group" (Practice tier, 20 seats)
 *   - 1 HR Admin      Maria Rodriguez       (maria.rodriguez@audithalo.test)
 *   - 1 Supervisor    Dr. James Mitchell    (james.mitchell@audithalo.test)
 *   - 1 Executive     Robert Chen           (robert.chen@audithalo.test)
 *   - 4 Supervisees   spread across NC, CA, FL, TX:
 *       • Emily Thompson   NC LCMHCA v1       primary demo (14 mo in)
 *       • Marcus Johnson   CA APCC v1         late-stage (30 mo in)
 *       • Sofia Garcia     FL RMHCI v1        yellow risk (8 mo in)
 *       • David Park       TX LPC-Associate   early program (3 mo in)
 *   - Memberships, supervisor assignments, rule assignments
 *   - Seeded session_events for each supervisee (signed history + a few
 *     scheduled/pending/canceled/no_show rows for Emily to exercise the
 *     state-machine UI)
 *
 * Soft-deletes (sets deletedAt + sessions_valid_from):
 *   - damon-test-hr@audithalo.test
 *   - damon-test-supervisor@audithalo.test
 *   - damon-test-supervisee@audithalo.test
 *
 * USAGE:
 *   npx tsx scripts/seed-demo-org.ts          # dry-run, no writes
 *   npx tsx scripts/seed-demo-org.ts --apply  # write to prod
 *
 * IDEMPOTENCY: aborts up front if any of the new user emails already
 * exist, OR if the org name already exists. Safe to re-run a partially-
 * failed attempt (the transaction rolled back so the DB is clean).
 */

import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { Pool, type PoolClient } from "pg";
import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "node:crypto";

const BCRYPT_COST = 12;
const APPLY = process.argv.includes("--apply");

const ORG_NAME = "Atlas Counseling Group";

type SeedUser = {
  email: string;
  name: string;
  role: "hr_admin" | "supervisor" | "executive" | "supervisee";
  state?: string;
  licenseType?: string;
  /** Set on supervisor — feeds the snapshot column on supervision events. */
  supervisorTrainingHours?: number;
  /** populated by the script */
  password?: string;
  passwordHash?: string;
  id?: string;
};

const SEED: { hrAdmin: SeedUser; supervisor: SeedUser; executive: SeedUser; supervisees: SeedUser[] } = {
  hrAdmin: {
    email: "maria.rodriguez@audithalo.test",
    name: "Maria Rodriguez",
    role: "hr_admin",
  },
  supervisor: {
    email: "james.mitchell@audithalo.test",
    name: "Dr. James Mitchell",
    role: "supervisor",
    supervisorTrainingHours: 30,
  },
  executive: {
    email: "robert.chen@audithalo.test",
    name: "Robert Chen",
    role: "executive",
  },
  supervisees: [
    {
      email: "emily.thompson@audithalo.test",
      name: "Emily Thompson",
      role: "supervisee",
      state: "NC",
      licenseType: "LCMHCA",
    },
    {
      email: "marcus.johnson@audithalo.test",
      name: "Marcus Johnson",
      role: "supervisee",
      state: "CA",
      licenseType: "APCC",
    },
    {
      email: "sofia.garcia@audithalo.test",
      name: "Sofia Garcia",
      role: "supervisee",
      state: "FL",
      licenseType: "RMHCI",
    },
    {
      email: "david.park@audithalo.test",
      name: "David Park",
      role: "supervisee",
      state: "TX",
      licenseType: "LPC-Associate",
    },
  ],
};

const OLD_TEST_EMAILS = [
  "damon-test-hr@audithalo.test",
  "damon-test-supervisor@audithalo.test",
  "damon-test-supervisee@audithalo.test",
];

const ALL_NEW_EMAILS = [
  SEED.hrAdmin.email,
  SEED.supervisor.email,
  SEED.executive.email,
  ...SEED.supervisees.map((s) => s.email),
];

function genPassword(): string {
  return randomBytes(18).toString("base64url");
}

function isoMonthsAgo(months: number, hour = 14, minute = 0): Date {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

function isoDaysAgo(days: number, hour = 14, minute = 0): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

function isoDaysAhead(days: number, hour = 15, minute = 0): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

function ruleIdFor(state: string, license: string): string {
  // Match the slug format used in /rules — state-license-v1, lowercased.
  // License may itself contain hyphens (e.g. "lpc-associate"), so don't strip.
  return `${state.toLowerCase()}-${license.toLowerCase()}-v1`;
}

type SessionSeed = {
  kind: "supervision" | "practice";
  date: Date;
  durationHours: number;
  sessionType: "individual" | "triadic" | "group" | null;
  groupAttendees: number | null;
  signed: boolean;
  scheduledStatus: "scheduled" | "completed" | "canceled" | "no_show" | null;
  canceledAt: Date | null;
  signReminderSentAt?: Date | null;
  directContactHours?: number | null;
};

/**
 * Build a supervisee's session history. Aims for the target supervision /
 * practice totals via repeated events spread across the program duration.
 */
function buildSessionHistory(opts: {
  programStartMonthsAgo: number;
  supervisionHourTarget: number;
  practiceHourTarget: number;
  /** Sessions per month, average. Higher = more granular history. */
  supervisionsPerMonth: number;
}): SessionSeed[] {
  const out: SessionSeed[] = [];
  const { programStartMonthsAgo, supervisionHourTarget, practiceHourTarget, supervisionsPerMonth } =
    opts;

  // Supervision events: distribute across the program duration.
  const totalSupSessions = Math.max(
    1,
    Math.round(programStartMonthsAgo * supervisionsPerMonth)
  );
  const avgHoursPerSession = supervisionHourTarget / totalSupSessions;
  const types: Array<"individual" | "triadic" | "group"> = [
    "individual",
    "individual",
    "individual",
    "triadic",
    "group",
  ];
  for (let i = 0; i < totalSupSessions; i++) {
    const monthsAgo = (i / totalSupSessions) * programStartMonthsAgo;
    const date = isoMonthsAgo(programStartMonthsAgo - monthsAgo, 14, 0);
    // Push into the past by a few days so all are clearly historical.
    date.setUTCDate(date.getUTCDate() - 3);
    const type = types[i % types.length];
    // Bias durations by type to look realistic; close to the average.
    let duration: number;
    if (type === "individual") duration = Math.max(0.5, avgHoursPerSession * 0.7);
    else if (type === "triadic") duration = avgHoursPerSession * 1.2;
    else duration = avgHoursPerSession * 1.6;
    out.push({
      kind: "supervision",
      date,
      durationHours: Number(duration.toFixed(2)),
      sessionType: type,
      groupAttendees: type === "group" ? 4 : null,
      signed: true,
      scheduledStatus: null, // legacy after-the-fact log shape
      canceledAt: null,
    });
  }

  // Practice events: one chunky monthly event.
  const monthsOfPractice = Math.max(1, Math.floor(programStartMonthsAgo));
  const hoursPerMonth = practiceHourTarget / monthsOfPractice;
  for (let i = 0; i < monthsOfPractice; i++) {
    const date = isoMonthsAgo(monthsOfPractice - i, 9, 0);
    out.push({
      kind: "practice",
      date,
      durationHours: Number(hoursPerMonth.toFixed(2)),
      sessionType: null,
      groupAttendees: null,
      signed: false, // practice events don't get co-signed
      scheduledStatus: null,
      canceledAt: null,
      directContactHours: Number((hoursPerMonth * 0.6).toFixed(2)),
    });
  }

  return out;
}

/** Quoted PG literal helper for human-readable plan output (NOT used for queries — those use $-params). */
function summarize(label: string, value: unknown) {
  console.log(`  ${label.padEnd(28)} ${value}`);
}

async function preflight(client: PoolClient) {
  // Abort if any new email already exists.
  const existingNew = await client.query(
    `SELECT email FROM users WHERE email = ANY($1::text[])`,
    [ALL_NEW_EMAILS]
  );
  if (existingNew.rowCount && existingNew.rowCount > 0) {
    throw new Error(
      `ABORT: ${existingNew.rowCount} of the proposed new emails already exist: ` +
        existingNew.rows.map((r) => r.email).join(", ")
    );
  }
  // Abort if the org name already exists.
  const existingOrg = await client.query(
    `SELECT id FROM organizations WHERE name = $1`,
    [ORG_NAME]
  );
  if (existingOrg.rowCount && existingOrg.rowCount > 0) {
    throw new Error(`ABORT: an org named "${ORG_NAME}" already exists`);
  }
  // Confirm the old test users exist (so the soft-delete actually does something).
  const oldUsers = await client.query(
    `SELECT email FROM users WHERE email = ANY($1::text[]) AND deleted_at IS NULL`,
    [OLD_TEST_EMAILS]
  );
  console.log(
    `Pre-flight: ${oldUsers.rowCount}/${OLD_TEST_EMAILS.length} damon-test-* accounts active and eligible for soft-delete.`
  );
}

async function generatePasswords() {
  for (const u of [SEED.hrAdmin, SEED.supervisor, SEED.executive, ...SEED.supervisees]) {
    u.password = genPassword();
    u.passwordHash = await bcrypt.hash(u.password, BCRYPT_COST);
  }
}

async function insertUser(client: PoolClient, u: SeedUser): Promise<string> {
  const r = await client.query<{ id: string }>(
    `INSERT INTO users (
       email, password_hash, name, role, state, license_type,
       email_verified_at, supervisor_training_hours, created_at
     ) VALUES (
       $1, $2, $3, $4::user_role, $5, $6,
       NOW(), $7, NOW()
     )
     RETURNING id`,
    [
      u.email,
      u.passwordHash,
      u.name,
      u.role,
      u.state ?? null,
      u.licenseType ?? null,
      u.supervisorTrainingHours ?? null,
    ]
  );
  const id = r.rows[0].id;
  u.id = id;
  return id;
}

async function seedSessionEvents(
  client: PoolClient,
  opts: {
    orgId: string;
    superviseeId: string;
    supervisorId: string;
    supervisorName: string;
    supervisorCreds: string[];
    superviseeName: string;
    sessions: SessionSeed[];
  }
) {
  for (const s of opts.sessions) {
    const signatures = s.signed
      ? [
          {
            signerId: opts.supervisorId,
            signerName: opts.supervisorName,
            signerRole: "supervisor",
            signedAt: new Date(s.date.getTime() + 60_000).toISOString(),
            ipAddress: "10.0.0.1",
            intentConfirmed: true,
          },
          {
            signerId: opts.superviseeId,
            signerName: opts.superviseeName,
            signerRole: "supervisee",
            signedAt: new Date(s.date.getTime() + 120_000).toISOString(),
            ipAddress: "10.0.0.2",
            intentConfirmed: true,
          },
        ]
      : [];
    await client.query(
      `INSERT INTO session_events (
         supervisee_id, org_id, kind, date, duration_hours,
         direct_contact_hours, session_type, supervisor_credentials,
         supervisor_training_hours, group_attendees, logged_by_id,
         signatures, signed_at, scheduled_status, canceled_at,
         sign_reminder_sent_at, created_at
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8::jsonb, $9, $10, $11,
         $12::jsonb, $13, $14, $15, $16, NOW()
       )`,
      [
        opts.superviseeId,
        opts.orgId,
        s.kind,
        s.date,
        s.durationHours,
        s.directContactHours ?? null,
        s.sessionType,
        s.kind === "supervision" ? JSON.stringify(opts.supervisorCreds) : null,
        s.kind === "supervision" ? 30 : null,
        s.groupAttendees,
        opts.supervisorId,
        JSON.stringify(signatures),
        s.signed
          ? new Date(s.date.getTime() + 120_000)
          : null,
        s.scheduledStatus,
        s.canceledAt,
        s.signReminderSentAt ?? null,
      ]
    );
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await preflight(client);

    console.log("");
    console.log("──── PLAN ────");
    console.log(`Mode:           ${APPLY ? "APPLY (writes to prod)" : "DRY-RUN (no writes)"}`);
    console.log(`Target host:    ${new URL(url).host}`);
    console.log(`Target DB:      ${new URL(url).pathname.replace(/^\//, "")}`);
    console.log("");
    console.log(`Will create org "${ORG_NAME}" (Practice tier, 20 seats) with:`);
    console.log(`  - HR Admin:   ${SEED.hrAdmin.name} <${SEED.hrAdmin.email}>`);
    console.log(`  - Supervisor: ${SEED.supervisor.name} <${SEED.supervisor.email}>`);
    console.log(`  - Executive:  ${SEED.executive.name} <${SEED.executive.email}>`);
    for (const s of SEED.supervisees) {
      console.log(
        `  - Supervisee: ${s.name} <${s.email}> — ${s.state} ${s.licenseType}`
      );
    }
    console.log("");
    console.log(`Will soft-delete (deletedAt + sessions_valid_from = NOW()):`);
    for (const e of OLD_TEST_EMAILS) console.log(`  - ${e}`);
    console.log("");
    console.log("Session events will be seeded per supervisee:");
    console.log("  Emily (NC LCMHCA, primary):  ~50 sup, 14 monthly practice, +1 pending, +2 scheduled, +1 canceled, +1 no_show");
    console.log("  Marcus (CA APCC, late):      ~30 sup, ~30 practice");
    console.log("  Sofia (FL RMHCI, yellow):    ~15 sup, ~8 practice");
    console.log("  David (TX LPC-A, early):     ~5 sup, ~3 practice, +1 scheduled");
    console.log("");

    if (!APPLY) {
      console.log("DRY-RUN. Re-run with --apply to actually write.");
      await client.query("ROLLBACK");
      return;
    }

    // ── Generate passwords + hashes upfront ───────────────────────────────
    await generatePasswords();

    // ── Insert users ──────────────────────────────────────────────────────
    // Need to insert HR Admin first to satisfy organizations.created_by_id NOT NULL.
    await insertUser(client, SEED.hrAdmin);
    await insertUser(client, SEED.supervisor);
    await insertUser(client, SEED.executive);
    for (const s of SEED.supervisees) await insertUser(client, s);

    // ── Insert organization ───────────────────────────────────────────────
    const orgR = await client.query<{ id: string }>(
      `INSERT INTO organizations (
         name, created_by_id, subscription_tier, seat_count, created_at
       ) VALUES ($1, $2, $3, $4, NOW())
       RETURNING id`,
      [ORG_NAME, SEED.hrAdmin.id, "practice", 20]
    );
    const orgId = orgR.rows[0].id;

    // ── Insert org_settings (defaults) ────────────────────────────────────
    await client.query(
      `INSERT INTO org_settings (org_id) VALUES ($1)`,
      [orgId]
    );

    // ── Insert memberships ────────────────────────────────────────────────
    for (const u of [SEED.hrAdmin, SEED.supervisor, SEED.executive, ...SEED.supervisees]) {
      await client.query(
        `INSERT INTO org_memberships (org_id, user_id, role)
         VALUES ($1, $2, $3::user_role)`,
        [orgId, u.id, u.role]
      );
    }

    // ── Insert supervisor_assignments (all supervisees → Dr. Mitchell) ───
    const supervisorId = SEED.supervisor.id!;
    for (const sv of SEED.supervisees) {
      await client.query(
        `INSERT INTO supervisor_assignments (
           org_id, supervisor_id, supervisee_id, is_primary, started_at
         ) VALUES ($1, $2, $3, true, $4)`,
        [orgId, supervisorId, sv.id, isoMonthsAgo(programStartFor(sv) + 1)]
      );
    }

    // ── Insert supervisee_rule_assignments ────────────────────────────────
    for (const sv of SEED.supervisees) {
      const ruleId = ruleIdFor(sv.state!, sv.licenseType!);
      const monthsAgo = programStartFor(sv);
      const obligationStart = isoMonthsAgo(monthsAgo, 9, 0);
      // Sofia is the "yellow risk" one: supervision_contract_filed_at is NULL,
      // which trips the pre_registration_required check on FL RMHCI.
      const filed = sv.email === "sofia.garcia@audithalo.test"
        ? null
        : isoMonthsAgo(monthsAgo, 9, 0);
      await client.query(
        `INSERT INTO supervisee_rule_assignments (
           supervisee_id, org_id, rule_id,
           obligation_started_at, supervision_contract_filed_at
         ) VALUES ($1, $2, $3, $4, $5)`,
        [sv.id, orgId, ruleId, obligationStart, filed]
      );
    }

    // ── Seed session_events per supervisee ────────────────────────────────
    const supervisorCreds = ["LCMHCS"];
    const supervisorName = SEED.supervisor.name;

    // Emily (NC LCMHCA): full demo data
    {
      const emily = SEED.supervisees.find((s) => s.email.startsWith("emily."))!;
      const sessions = buildSessionHistory({
        programStartMonthsAgo: 14,
        supervisionHourTarget: 120,
        practiceHourTarget: 2700,
        supervisionsPerMonth: 3.5,
      });
      // Plus state-machine variety:
      // 1 pending sig — ended 2h ago
      const endedAgo = new Date(Date.now() - 2 * 60 * 60_000);
      const startedAgo = new Date(endedAgo.getTime() - 60 * 60_000);
      sessions.push({
        kind: "supervision",
        date: startedAgo,
        durationHours: 1.0,
        sessionType: "individual",
        groupAttendees: null,
        signed: false,
        scheduledStatus: "scheduled",
        canceledAt: null,
      });
      // 2 upcoming scheduled
      sessions.push({
        kind: "supervision",
        date: isoDaysAhead(0, 15, 0), // today 3pm
        durationHours: 1.0,
        sessionType: "individual",
        groupAttendees: null,
        signed: false,
        scheduledStatus: "scheduled",
        canceledAt: null,
      });
      sessions.push({
        kind: "supervision",
        date: isoDaysAhead(4, 10, 0), // Thursday-ish 10am
        durationHours: 1.5,
        sessionType: "triadic",
        groupAttendees: null,
        signed: false,
        scheduledStatus: "scheduled",
        canceledAt: null,
      });
      // 1 canceled in the past
      sessions.push({
        kind: "supervision",
        date: isoDaysAgo(21, 14, 0),
        durationHours: 1.0,
        sessionType: "individual",
        groupAttendees: null,
        signed: false,
        scheduledStatus: "canceled",
        canceledAt: isoDaysAgo(22, 9, 0),
      });
      // 1 no_show in the past
      sessions.push({
        kind: "supervision",
        date: isoDaysAgo(10, 14, 0),
        durationHours: 1.0,
        sessionType: "individual",
        groupAttendees: null,
        signed: false,
        scheduledStatus: "no_show",
        canceledAt: null,
      });
      await seedSessionEvents(client, {
        orgId,
        superviseeId: emily.id!,
        supervisorId,
        supervisorName,
        supervisorCreds,
        superviseeName: emily.name,
        sessions,
      });
    }

    // Marcus (CA APCC): late-stage, mostly green
    {
      const marcus = SEED.supervisees.find((s) => s.email.startsWith("marcus."))!;
      const sessions = buildSessionHistory({
        programStartMonthsAgo: 30,
        supervisionHourTarget: 160,
        practiceHourTarget: 2900,
        supervisionsPerMonth: 1.0,
      });
      await seedSessionEvents(client, {
        orgId,
        superviseeId: marcus.id!,
        supervisorId,
        supervisorName,
        supervisorCreds,
        superviseeName: marcus.name,
        sessions,
      });
    }

    // Sofia (FL RMHCI): yellow risk (missing contract filed date + light hours)
    {
      const sofia = SEED.supervisees.find((s) => s.email.startsWith("sofia."))!;
      const sessions = buildSessionHistory({
        programStartMonthsAgo: 8,
        supervisionHourTarget: 35,
        practiceHourTarget: 700,
        supervisionsPerMonth: 1.8,
      });
      await seedSessionEvents(client, {
        orgId,
        superviseeId: sofia.id!,
        supervisorId,
        supervisorName,
        supervisorCreds,
        superviseeName: sofia.name,
        sessions,
      });
    }

    // David (TX LPC-Associate): early-program
    {
      const david = SEED.supervisees.find((s) => s.email.startsWith("david."))!;
      const sessions = buildSessionHistory({
        programStartMonthsAgo: 3,
        supervisionHourTarget: 10,
        practiceHourTarget: 280,
        supervisionsPerMonth: 1.5,
      });
      // 1 upcoming scheduled
      sessions.push({
        kind: "supervision",
        date: isoDaysAhead(2, 11, 0),
        durationHours: 1.0,
        sessionType: "individual",
        groupAttendees: null,
        signed: false,
        scheduledStatus: "scheduled",
        canceledAt: null,
      });
      await seedSessionEvents(client, {
        orgId,
        superviseeId: david.id!,
        supervisorId,
        supervisorName,
        supervisorCreds,
        superviseeName: david.name,
        sessions,
      });
    }

    // ── Soft-delete the damon-test-* accounts ─────────────────────────────
    const softDel = await client.query(
      `UPDATE users
          SET deleted_at = NOW(),
              sessions_valid_from = NOW()
        WHERE email = ANY($1::text[])
          AND deleted_at IS NULL
        RETURNING email`,
      [OLD_TEST_EMAILS]
    );
    console.log(`Soft-deleted ${softDel.rowCount} damon-test-* accounts.`);

    await client.query("COMMIT");

    // ── Print env block ───────────────────────────────────────────────────
    console.log("");
    console.log("──── DONE — PASTE INTO .env.local (replacing the DEMO_* block) ────");
    console.log("");
    console.log(`# Atlas Counseling Group demo creds (2026-06-15) — rotate or delete after demo`);
    console.log(`DEMO_HR_ADMIN_EMAIL=${SEED.hrAdmin.email}`);
    console.log(`DEMO_HR_ADMIN_PASSWORD=${SEED.hrAdmin.password}`);
    console.log(`DEMO_SUPERVISOR_EMAIL=${SEED.supervisor.email}`);
    console.log(`DEMO_SUPERVISOR_PASSWORD=${SEED.supervisor.password}`);
    console.log(`DEMO_SUPERVISEE_EMAIL=${SEED.supervisees[0].email}`);
    console.log(`DEMO_SUPERVISEE_PASSWORD=${SEED.supervisees[0].password}`);
    console.log(`DEMO_EXECUTIVE_EMAIL=${SEED.executive.email}`);
    console.log(`DEMO_EXECUTIVE_PASSWORD=${SEED.executive.password}`);
    console.log("");
    console.log("# Non-login supervisees (data only, included for completeness)");
    for (const sv of SEED.supervisees.slice(1)) {
      console.log(`# ${sv.name} (${sv.state} ${sv.licenseType}): ${sv.email} / ${sv.password}`);
    }
    console.log("");
    console.log("These are SCRATCH credentials. Rotate or delete after the demo.");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("");
    console.error("ABORTED — transaction rolled back. DB is unchanged.");
    console.error(err);
    process.exit(2);
  } finally {
    client.release();
    await pool.end();
  }
}

/** How many months into their program a given supervisee is. Used to anchor
 *  supervisor_assignments.started_at and supervisee_rule_assignments.obligation_started_at. */
function programStartFor(sv: SeedUser): number {
  switch (sv.email) {
    case "emily.thompson@audithalo.test":
      return 14;
    case "marcus.johnson@audithalo.test":
      return 30;
    case "sofia.garcia@audithalo.test":
      return 8;
    case "david.park@audithalo.test":
      return 3;
    default:
      return 6;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
