/**
 * seed-demo.ts — populate a complete demo org for AuditHalo dashboard testing.
 *
 * Creates:
 *   - Org: "NC Counseling Demo Practice"
 *   - Supervisor: demo-supervisor@audithalo.com / Demo1234!
 *   - 3 supervisees at different compliance stages (Jamie 65%, Morgan 15%, Riley 95%)
 *   - Org memberships for all 4 users
 *   - superviseeRuleAssignments pinned to "nc-lcmhca-v1"
 *   - session_events matching each supervisee's progress level
 *
 * Usage: npx tsx scripts/seed-demo.ts
 * Env:   DATABASE_URL read from .env.local via dotenv
 */

import "dotenv/config";
// dotenv/config reads .env by default; for .env.local we need explicit config
import dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

// ─── DB setup ────────────────────────────────────────────────────────────────

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set — add it to .env.local");
  process.exit(1);
}

const sql = neon(connectionString);
const db = drizzle(sql, { schema });

// ─── Constants ────────────────────────────────────────────────────────────────

// bcrypt hash of "Demo1234!" at cost 12 — pre-computed to avoid runtime dependency
const PASSWORD_HASH = "$2b$12$Oo/uNfV0phopa4j7GT3LZO4lPMDEc/AAJ2JYONjx3n6eXLacCt/hC";

const RULE_ID = "nc-lcmhca-v1"; // NC LCMHCA: 3,000 practice hrs + 100 supervision hrs

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Returns a date within the given month at ~mid-month with some day jitter. */
function dateInMonth(base: Date, monthOffset: number, dayOfMonth = 10): Date {
  const d = addMonths(base, monthOffset);
  d.setDate(dayOfMonth);
  d.setHours(9, 0, 0, 0);
  return d;
}

// ─── Session event builders ───────────────────────────────────────────────────

interface PracticeEventRow {
  superviseeId: string;
  orgId: string;
  kind: "practice";
  date: Date;
  durationHours: number;
  loggedById: string;
  signatures: schema.SessionSignature[];
}

interface SupervisionEventRow {
  superviseeId: string;
  orgId: string;
  kind: "supervision";
  date: Date;
  durationHours: number;
  sessionType: "individual" | "triadic" | "group";
  supervisorCredentials: string[];
  loggedById: string;
  signatures: schema.SessionSignature[];
}

type SessionEventRow = PracticeEventRow | SupervisionEventRow;

/**
 * Build practice events: one event per month, durationHours per month.
 */
function buildPracticeEvents(
  superviseeId: string,
  orgId: string,
  startDate: Date,
  monthCount: number,
  hoursPerMonth: number
): PracticeEventRow[] {
  const events: PracticeEventRow[] = [];
  for (let m = 0; m < monthCount; m++) {
    events.push({
      superviseeId,
      orgId,
      kind: "practice",
      date: dateInMonth(startDate, m, 12),
      durationHours: hoursPerMonth,
      loggedById: superviseeId,
      signatures: [],
    });
  }
  return events;
}

/**
 * Build individual supervision events: one event every N months.
 */
function buildSupervisionEvents(
  superviseeId: string,
  orgId: string,
  supervisorId: string,
  startDate: Date,
  monthCount: number,
  intervalMonths: number, // 1 = monthly, 0.5 = every 2 weeks (represented as two per month)
  hoursPerSession: number
): SupervisionEventRow[] {
  const events: SupervisionEventRow[] = [];
  for (let m = 0; m < monthCount; m += intervalMonths) {
    events.push({
      superviseeId,
      orgId,
      kind: "supervision",
      date: dateInMonth(startDate, Math.floor(m), 15),
      durationHours: hoursPerSession,
      sessionType: "individual",
      supervisorCredentials: ["LCMHCS"],
      loggedById: supervisorId,
      signatures: [],
    });
  }
  return events;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // ── Duplicate guard ──────────────────────────────────────────────────────
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, "demo-supervisor@audithalo.com"))
    .limit(1);

  if (existing.length > 0) {
    console.log("Demo data already exists (demo-supervisor@audithalo.com found). Skipping.");
    process.exit(0);
  }

  console.log("Seeding demo data...");

  // ── Define supervisee data (used in tx and summary) ──────────────────────
  const superviseeData = [
    {
      email: "demo-supervisee1@audithalo.com",
      name: "Jamie Chen",
      label: "65%",
    },
    {
      email: "demo-supervisee2@audithalo.com",
      name: "Morgan Taylor",
      label: "15%",
    },
    {
      email: "demo-supervisee3@audithalo.com",
      name: "Riley Park",
      label: "95%",
    },
  ];

  await db.transaction(async (tx) => {
    // ── 1. Create supervisor ───────────────────────────────────────────────
    const [supervisor] = await tx
      .insert(schema.users)
      .values({
        email: "demo-supervisor@audithalo.com",
        passwordHash: PASSWORD_HASH,
        name: "Dr. Alex Rivera",
        role: "supervisor",
        state: "NC",
        licenseType: "LCMHCS",
      })
      .returning({ id: schema.users.id });

    console.log(`  Created supervisor: ${supervisor.id}`);

    // ── 2. Create org ──────────────────────────────────────────────────────
    const [org] = await tx
      .insert(schema.organizations)
      .values({
        name: "NC Counseling Demo Practice",
        createdById: supervisor.id,
      })
      .returning({ id: schema.organizations.id });

    console.log(`  Created org: ${org.id}`);

    // ── 3. Create supervisees ──────────────────────────────────────────────
    const supervisees = await tx
      .insert(schema.users)
      .values(
        superviseeData.map((s) => ({
          email: s.email,
          passwordHash: PASSWORD_HASH,
          name: s.name,
          role: "supervisee" as const,
          state: "NC",
          licenseType: "LCMHCA",
        }))
      )
      .returning({ id: schema.users.id, email: schema.users.email });

    const [jamie, morgan, riley] = supervisees;
    console.log(`  Created supervisees: ${supervisees.map((s) => s.id).join(", ")}`);

    // ── 4. Org memberships ─────────────────────────────────────────────────
    await tx.insert(schema.orgMemberships).values([
      { orgId: org.id, userId: supervisor.id, role: "supervisor" },
      { orgId: org.id, userId: jamie.id, role: "supervisee" },
      { orgId: org.id, userId: morgan.id, role: "supervisee" },
      { orgId: org.id, userId: riley.id, role: "supervisee" },
    ]);

    console.log("  Created org memberships");

    // ── 5. Rule assignments ────────────────────────────────────────────────
    // Jamie started 2024-06-01, Morgan 2025-01-01, Riley 2023-01-01
    const jamieStart = new Date("2024-06-01T00:00:00Z");
    const morganStart = new Date("2025-01-01T00:00:00Z");
    const rileyStart = new Date("2023-01-01T00:00:00Z");

    await tx.insert(schema.superviseeRuleAssignments).values([
      {
        superviseeId: jamie.id,
        orgId: org.id,
        ruleId: RULE_ID,
        obligationStartedAt: jamieStart,
        supervisionContractFiledAt: jamieStart,
      },
      {
        superviseeId: morgan.id,
        orgId: org.id,
        ruleId: RULE_ID,
        obligationStartedAt: morganStart,
        supervisionContractFiledAt: morganStart,
      },
      {
        superviseeId: riley.id,
        orgId: org.id,
        ruleId: RULE_ID,
        obligationStartedAt: rileyStart,
        supervisionContractFiledAt: rileyStart,
      },
    ]);

    console.log("  Created rule assignments");

    // ── 6. Session events ──────────────────────────────────────────────────
    // Jamie (65%): target ~1,920 practice + 24 supervision hrs
    //   24 months from 2024-06-01: 80 hrs/month practice = 1,920 hrs total
    //   1 hr individual supervision every 2 weeks = 2/month × 24 months = 24 × 1hr sessions = 24 hrs
    const jamieEvents: SessionEventRow[] = [
      ...buildPracticeEvents(jamie.id, org.id, jamieStart, 24, 80),
      // 1 hr supervision every 2 weeks = 2 sessions per month, each 1 hr
      ...buildSupervisionEvents(jamie.id, org.id, supervisor.id, jamieStart, 24, 1, 1),
    ];

    // Morgan (15%): target ~350 practice + 5 supervision hrs
    //   5 months from 2025-01-01: 70 hrs/month practice = 350 hrs total
    //   1 supervision session per month × 5 months = 5 hrs
    const morganEvents: SessionEventRow[] = [
      ...buildPracticeEvents(morgan.id, org.id, morganStart, 5, 70),
      ...buildSupervisionEvents(morgan.id, org.id, supervisor.id, morganStart, 5, 1, 1),
    ];

    // Riley (95%): target ~2,880 practice + 92 supervision hrs
    //   36 months from 2023-01-01: 80 hrs/month practice = 2,880 hrs total
    //   1 session/month × 36 months × ~2.56 hrs avg = 92 hrs total
    const rileyPracticeEvents = buildPracticeEvents(riley.id, org.id, rileyStart, 36, 80);
    // Supervision: 1 session/month × 36 months at 2.56 hrs = 92.16 ≈ 92 hrs
    const rileySupervisionEvents = buildSupervisionEvents(
      riley.id, org.id, supervisor.id, rileyStart, 36, 1, 2.56
    );
    const rileyEvents: SessionEventRow[] = [...rileyPracticeEvents, ...rileySupervisionEvents];

    // Insert all events in batches (Neon http has a statement limit)
    const allEvents = [...jamieEvents, ...morganEvents, ...rileyEvents];
    const BATCH_SIZE = 50;

    for (let i = 0; i < allEvents.length; i += BATCH_SIZE) {
      const batch = allEvents.slice(i, i + BATCH_SIZE);
      await tx.insert(schema.sessionEvents).values(
        batch.map((e) => ({
          superviseeId: e.superviseeId,
          orgId: e.orgId,
          kind: e.kind,
          date: e.date,
          durationHours: e.durationHours,
          sessionType: e.kind === "supervision" ? (e as SupervisionEventRow).sessionType : undefined,
          supervisorCredentials:
            e.kind === "supervision" ? (e as SupervisionEventRow).supervisorCredentials : undefined,
          loggedById: e.loggedById,
          signatures: [],
        }))
      );
    }

    console.log(`  Inserted ${allEvents.length} session events`);

    // ── Summary ────────────────────────────────────────────────────────────
    const jamieHrs = jamieEvents.reduce((s, e) => s + e.durationHours, 0);
    const morganHrs = morganEvents.reduce((s, e) => s + e.durationHours, 0);
    const rileyHrs = rileyEvents.reduce((s, e) => s + e.durationHours, 0);
    const [jamieData, morganData, rileyData] = superviseeData;

    console.log(`
Done. Demo accounts:
  Supervisor:              demo-supervisor@audithalo.com  / Demo1234!
  Jamie Chen   Progress: ${jamieData.label}   demo-supervisee1@audithalo.com / Demo1234!  [${jamieHrs} total hrs]
  Morgan Taylor Progress: ${morganData.label}   demo-supervisee2@audithalo.com / Demo1234!  [${morganHrs} total hrs]
  Riley Park   Progress: ${rileyData.label}   demo-supervisee3@audithalo.com / Demo1234!  [${rileyHrs} total hrs]
`);
  });
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
