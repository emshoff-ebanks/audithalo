/**
 * Demo seed — populates a complete demo org with 1 supervisor + 3 supervisees
 * at different compliance stages. Idempotent: clears any prior demo state
 * first, then recreates from scratch.
 *
 * Called from two surfaces:
 *   • scripts/seed-demo-cli.ts (local dev: `npm run seed:demo`)
 *   • src/app/api/admin/reset-demo/route.ts (admin endpoint on prod)
 *
 * Uses the shared `@/lib/db` connection so it inherits whatever DATABASE_URL
 * the calling environment has set — no dotenv, no process.exit.
 */
import { inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, schema } from "@/lib/db";

const DEMO_PASSWORD = "Demo1234!";
const RULE_ID = "nc-lcmhca-v1"; // NC LCMHCA: 3,000 practice hrs + 100 supervision hrs

const DEMO_EMAILS = [
  "demo-supervisor@audithalo.com",
  "demo-supervisee1@audithalo.com",
  "demo-supervisee2@audithalo.com",
  "demo-supervisee3@audithalo.com",
];

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function dateInMonth(base: Date, monthOffset: number, dayOfMonth = 10): Date {
  const d = addMonths(base, monthOffset);
  d.setDate(dayOfMonth);
  d.setHours(9, 0, 0, 0);
  return d;
}

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

function buildSupervisionEvents(
  superviseeId: string,
  orgId: string,
  supervisorId: string,
  startDate: Date,
  monthCount: number,
  intervalMonths: number,
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

export async function runDemoSeed(): Promise<{ supervisorId: string }> {
  // Reset: delete prior demo data so re-runs start fresh.
  const existingDemoUsers = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(inArray(schema.users.email, DEMO_EMAILS));

  if (existingDemoUsers.length > 0) {
    const demoUserIds = existingDemoUsers.map((u) => u.id);
    const orgsCreated = await db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(inArray(schema.organizations.createdById, demoUserIds));

    const demoOrgIds = orgsCreated.map((o) => o.id);
    if (demoOrgIds.length > 0) {
      await db
        .delete(schema.organizations)
        .where(inArray(schema.organizations.id, demoOrgIds));
    }
    await db.delete(schema.users).where(inArray(schema.users.id, demoUserIds));
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const verifiedAt = new Date();

  const superviseeData = [
    { email: "demo-supervisee1@audithalo.com", name: "Jamie Chen", label: "65%" },
    { email: "demo-supervisee2@audithalo.com", name: "Morgan Taylor", label: "15%" },
    { email: "demo-supervisee3@audithalo.com", name: "Riley Park", label: "95%" },
  ];

  let supervisorId = "";
  await db.transaction(async (tx) => {
    const [supervisor] = await tx
      .insert(schema.users)
      .values({
        email: "demo-supervisor@audithalo.com",
        passwordHash,
        name: "Dr. Alex Rivera",
        role: "supervisor",
        state: "NC",
        licenseType: "LCMHCS",
        emailVerifiedAt: verifiedAt,
        sessionsValidFrom: null,
      })
      .returning({ id: schema.users.id });
    supervisorId = supervisor.id;

    const [org] = await tx
      .insert(schema.organizations)
      .values({
        name: "NC Counseling Demo Practice",
        createdById: supervisor.id,
      })
      .returning({ id: schema.organizations.id });

    const supervisees = await tx
      .insert(schema.users)
      .values(
        superviseeData.map((s) => ({
          email: s.email,
          passwordHash,
          name: s.name,
          role: "supervisee" as const,
          state: "NC",
          licenseType: "LCMHCA",
          emailVerifiedAt: verifiedAt,
          sessionsValidFrom: null,
        }))
      )
      .returning({ id: schema.users.id, email: schema.users.email });

    const [jamie, morgan, riley] = supervisees;

    await tx.insert(schema.orgMemberships).values([
      { orgId: org.id, userId: supervisor.id, role: "supervisor" },
      { orgId: org.id, userId: jamie.id, role: "supervisee" },
      { orgId: org.id, userId: morgan.id, role: "supervisee" },
      { orgId: org.id, userId: riley.id, role: "supervisee" },
    ]);

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

    const jamieEvents: SessionEventRow[] = [
      ...buildPracticeEvents(jamie.id, org.id, jamieStart, 24, 80),
      ...buildSupervisionEvents(jamie.id, org.id, supervisor.id, jamieStart, 24, 1, 1),
    ];
    const morganEvents: SessionEventRow[] = [
      ...buildPracticeEvents(morgan.id, org.id, morganStart, 5, 70),
      ...buildSupervisionEvents(morgan.id, org.id, supervisor.id, morganStart, 5, 1, 1),
    ];
    const rileyEvents: SessionEventRow[] = [
      ...buildPracticeEvents(riley.id, org.id, rileyStart, 36, 80),
      ...buildSupervisionEvents(riley.id, org.id, supervisor.id, rileyStart, 36, 1, 2.56),
    ];

    const sampleAiNote = {
      topics: ["transference dynamics", "termination ethics", "cultural humility"],
      competencies: [
        "case conceptualization",
        "self-of-the-therapist awareness",
        "ethical decision-making",
      ],
      supervisorFeedback:
        "The supervisee demonstrated strong engagement with the complex termination case. They showed growing insight into how their own reactions shape the therapeutic relationship and identified specific countertransference patterns to monitor. Continue to support their development of cultural humility through case-specific reflection.",
      nextSteps: [
        "review the readings on relational trauma",
        "bring 3 case examples to next session",
        "practice the open-ended termination dialogue",
      ],
      generatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      generatedByUserId: supervisor.id,
      model: "gpt-4o-2024-08-06",
      transcriptHash: "demo-transcript-hash-not-real",
      transcriptWordCount: 1247,
    };

    const recentSupervisionDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const aiNoteEvent = {
      superviseeId: jamie.id,
      orgId: org.id,
      kind: "supervision" as const,
      date: recentSupervisionDate,
      durationHours: 1,
      sessionType: "individual" as const,
      supervisorCredentials: ["LCMHCS"],
      loggedById: supervisor.id,
      signatures: [] as schema.SessionSignature[],
      aiNote: sampleAiNote,
    };

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
          sessionType:
            e.kind === "supervision"
              ? (e as SupervisionEventRow).sessionType
              : undefined,
          supervisorCredentials:
            e.kind === "supervision"
              ? (e as SupervisionEventRow).supervisorCredentials
              : undefined,
          loggedById: e.loggedById,
          signatures: [],
        }))
      );
    }
    await tx.insert(schema.sessionEvents).values(aiNoteEvent);
  });

  return { supervisorId };
}
