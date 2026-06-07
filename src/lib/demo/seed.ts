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

// All date math is in UTC to match the start dates (which are written as
// "2023-01-01T00:00:00Z"). Using local-tz setDate/setMonth would land
// practice events a day or month earlier when the seed runs in any
// timezone west of UTC — which was firing the "hours logged before the
// supervision contract was filed" gap on every supervisee.
function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function dateInMonth(base: Date, monthOffset: number, dayOfMonth = 10): Date {
  const d = addMonths(base, monthOffset);
  d.setUTCDate(dayOfMonth);
  d.setUTCHours(9, 0, 0, 0);
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
  signedAt: Date | null;
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
  signedAt: Date | null;
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
      signedAt: null,
    });
  }
  return events;
}

/**
 * Bi-weekly supervision cadence with a week-1 intake ramp. Three sessions
 * in the first 8 days (intake) plus bi-weekly thereafter from day 22.
 *
 * Why the intake ramp: the supervision_ratio_per_practice_block check
 * walks the timeline chronologically and verifies that supervision hours
 * accumulate fast enough to cover each 40-hour practice block. With our
 * monthly 70-80hr practice events, the very first month dumps two blocks'
 * worth of hours at once; without enough supervision banked beforehand the
 * second block lands uncovered and shows up as a "1 block lacks the
 * required supervision" gap on the detail page. Three intake sessions
 * (3 × hoursPerSession ≥ 2 hrs) cover both blocks on the first practice
 * event, and from there the rolling cadence keeps a positive buffer.
 *
 * NC LCMHCA's individual_supervision_cadence rule also caps the
 * session-to-session gap at 14 days, so the bi-weekly schedule is tight.
 */
function buildSupervisionEventsBiweekly(
  superviseeId: string,
  orgId: string,
  supervisorId: string,
  startDate: Date,
  durationMonths: number,
  hoursPerSession: number
): SupervisionEventRow[] {
  const events: SupervisionEventRow[] = [];
  const endDate = addMonths(startDate, durationMonths);

  function push(date: Date) {
    events.push({
      superviseeId,
      orgId,
      kind: "supervision",
      date,
      durationHours: hoursPerSession,
      sessionType: "individual",
      supervisorCredentials: ["LCMHCS"],
      loggedById: supervisorId,
      signatures: [],
      signedAt: null,
    });
  }

  // Intake ramp — 3 sessions in days 0, 4, 8.
  for (const offset of [0, 4, 8]) {
    const d = new Date(startDate);
    d.setUTCDate(d.getUTCDate() + offset);
    d.setUTCHours(10, 0, 0, 0);
    if (d < endDate) push(d);
  }
  // Bi-weekly thereafter, starting at day 22 (14 days after the last intake).
  const current = new Date(startDate);
  current.setUTCDate(current.getUTCDate() + 22);
  current.setUTCHours(10, 0, 0, 0);
  while (current < endDate) {
    push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 14);
  }
  return events;
}

/**
 * Apply (supervisor, supervisee) signatures to a supervision event. Signed
 * 2 days after the session date — typical "I'll sign it in the next session
 * window" cadence. Returns a new event with signatures + signedAt populated.
 */
function signSupervisionEvent(
  event: SupervisionEventRow,
  signers: {
    supervisor: { id: string; name: string };
    supervisee: { id: string; name: string };
  }
): SupervisionEventRow {
  const signedDate = new Date(event.date.getTime() + 2 * 24 * 60 * 60 * 1000);
  const signedAtIso = signedDate.toISOString();
  return {
    ...event,
    signedAt: signedDate,
    signatures: [
      {
        signerId: signers.supervisor.id,
        signerName: signers.supervisor.name,
        signerRole: "supervisor",
        signedAt: signedAtIso,
        ipAddress: "192.0.2.10",
        intentConfirmed: true,
      },
      {
        signerId: signers.supervisee.id,
        signerName: signers.supervisee.name,
        signerRole: "supervisee",
        signedAt: signedAtIso,
        ipAddress: "192.0.2.11",
        intentConfirmed: true,
      },
    ],
  };
}

/**
 * Sign all but the last `unsignedTailCount` supervision events. The tail
 * stays unsigned to simulate a realistic "I haven't gotten around to signing
 * the recent ones yet" backlog. Set unsignedTailCount=0 for a fully-clean
 * "on-track" supervisee.
 */
function applySignatures(
  events: SupervisionEventRow[],
  signers: Parameters<typeof signSupervisionEvent>[1],
  unsignedTailCount: number
): SupervisionEventRow[] {
  const signedCount = Math.max(0, events.length - unsignedTailCount);
  return events.map((e, i) =>
    i < signedCount ? signSupervisionEvent(e, signers) : e
  );
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

  // No transaction wrapper: the shared @/lib/db handle uses the Neon HTTP
  // driver (drizzle-orm/neon-http) which doesn't implement transactions —
  // it throws "No transactions support in neon-http driver" if you try.
  // The seed is idempotent — the reset step at the top of this function
  // wipes any partial prior run before re-inserting, so atomicity isn't
  // strictly required.
  const [supervisor] = await db
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
  const supervisorId = supervisor.id;

  const [org] = await db
    .insert(schema.organizations)
    .values({
      name: "NC Counseling Demo Practice",
      createdById: supervisor.id,
    })
    .returning({ id: schema.organizations.id });

  const supervisees = await db
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

  await db.insert(schema.orgMemberships).values([
    { orgId: org.id, userId: supervisor.id, role: "supervisor" },
    { orgId: org.id, userId: jamie.id, role: "supervisee" },
    { orgId: org.id, userId: morgan.id, role: "supervisee" },
    { orgId: org.id, userId: riley.id, role: "supervisee" },
  ]);

  // Anchor obligation start dates to NOW so the bi-weekly supervision
  // cadence keeps a session within the trailing 14-day window — otherwise
  // `individual_supervision_cadence` fires a yellow "X days since the last
  // individual supervision" gap on every supervisee the morning after the
  // seed runs.
  const now = new Date();
  const monthsAgo = (n: number) => addMonths(now, -n);
  const jamieStart = monthsAgo(24);
  const morganStart = monthsAgo(5);
  const rileyStart = monthsAgo(36);

  await db.insert(schema.superviseeRuleAssignments).values([
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

  const supervisorSigner = {
    id: supervisor.id,
    name: "Dr. Alex Rivera",
  };

  // Jamie: 24 months in, healthy bi-weekly cadence, but 3 most-recent
  // supervision sessions still need her signature — the realistic backlog
  // a supervisor would actually have to follow up on. Drives the "Needs
  // attention" panel and the yellow risk badge on her roster row.
  const jamieSupervision = applySignatures(
    buildSupervisionEventsBiweekly(jamie.id, org.id, supervisor.id, jamieStart, 24, 1.25),
    { supervisor: supervisorSigner, supervisee: { id: jamie.id, name: "Jamie Chen" } },
    3
  );
  const jamieEvents: SessionEventRow[] = [
    ...buildPracticeEvents(jamie.id, org.id, jamieStart, 24, 80),
    ...jamieSupervision,
  ];

  // Morgan: just starting (5 months in). Everything signed; her risk vector
  // is hours-to-deadline, not paperwork hygiene. Green-on-track-early.
  const morganSupervision = applySignatures(
    buildSupervisionEventsBiweekly(morgan.id, org.id, supervisor.id, morganStart, 5, 1),
    { supervisor: supervisorSigner, supervisee: { id: morgan.id, name: "Morgan Taylor" } },
    0
  );
  const morganEvents: SessionEventRow[] = [
    ...buildPracticeEvents(morgan.id, org.id, morganStart, 5, 70),
    ...morganSupervision,
  ];

  // Riley: near-licensure (95%, 36 months). Fully signed, clean record —
  // the "sealed evidence package" payoff narrative.
  const rileySupervision = applySignatures(
    buildSupervisionEventsBiweekly(riley.id, org.id, supervisor.id, rileyStart, 36, 1.3),
    { supervisor: supervisorSigner, supervisee: { id: riley.id, name: "Riley Park" } },
    0
  );
  const rileyEvents: SessionEventRow[] = [
    ...buildPracticeEvents(riley.id, org.id, rileyStart, 36, 80),
    ...rileySupervision,
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
  // Sign the AI-note event so the "wow demo" supervision row appears
  // fully sealed in the audit trail (rather than perpetually in the
  // signature queue). Backdate the signature timestamp by 4 days so it's
  // realistic relative to the session date.
  const aiNoteSignedAt = new Date(recentSupervisionDate.getTime() + 24 * 60 * 60 * 1000);
  const aiNoteEvent = {
    superviseeId: jamie.id,
    orgId: org.id,
    kind: "supervision" as const,
    date: recentSupervisionDate,
    durationHours: 1,
    sessionType: "individual" as const,
    supervisorCredentials: ["LCMHCS"],
    loggedById: supervisor.id,
    signatures: [
      {
        signerId: supervisor.id,
        signerName: "Dr. Alex Rivera",
        signerRole: "supervisor",
        signedAt: aiNoteSignedAt.toISOString(),
        ipAddress: "192.0.2.10",
        intentConfirmed: true,
      },
      {
        signerId: jamie.id,
        signerName: "Jamie Chen",
        signerRole: "supervisee",
        signedAt: aiNoteSignedAt.toISOString(),
        ipAddress: "192.0.2.11",
        intentConfirmed: true,
      },
    ] as schema.SessionSignature[],
    signedAt: aiNoteSignedAt,
    aiNote: sampleAiNote,
  };

  const allEvents = [...jamieEvents, ...morganEvents, ...rileyEvents];
  const BATCH_SIZE = 50;
  for (let i = 0; i < allEvents.length; i += BATCH_SIZE) {
    const batch = allEvents.slice(i, i + BATCH_SIZE);
    await db.insert(schema.sessionEvents).values(
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
        signatures: e.signatures,
        signedAt: e.signedAt,
      }))
    );
  }
  await db.insert(schema.sessionEvents).values(aiNoteEvent);

  return { supervisorId };
}
