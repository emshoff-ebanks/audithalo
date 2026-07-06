/**
 * Seed an RI test org with the clinical supervision form template enabled.
 *
 * Creates:
 *   - Migration 0030 (adds pdf_template_key, supervision_type, clinical_form_data)
 *   - 1 org   "Recovery Innovations Test" (Practice tier, pdf_template_key = 'recovery_innovations_v1')
 *   - 1 HR Admin     Bree Martinez        (bree.martinez@audithalo.test)
 *   - 1 Supervisor   Dr. Sarah Chen       (sarah.chen@audithalo.test)
 *   - 1 Supervisee   Jordan Williams      (jordan.williams@audithalo.test)
 *   - Membership, supervisor assignment, rule assignment (NC LCMHCA)
 *   - 2 session events: 1 signed (to test PDF download), 1 pending (to test clinical form UI)
 *
 * USAGE:
 *   npx tsx scripts/seed-ri-test-org.ts          # dry-run
 *   npx tsx scripts/seed-ri-test-org.ts --apply  # write to DB
 */

import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { Pool, type PoolClient } from "pg";
import bcrypt from "bcryptjs";
import { randomBytes, randomUUID, createHash } from "node:crypto";

const BCRYPT_COST = 12;
const APPLY = process.argv.includes("--apply");
const ORG_NAME = "Recovery Innovations Test";

type UserDef = {
  email: string;
  name: string;
  role: "hr_admin" | "supervisor" | "supervisee";
  state?: string;
  licenseType?: string;
  password?: string;
  passwordHash?: string;
  id?: string;
};

const USERS: { hrAdmin: UserDef; supervisor: UserDef; supervisee: UserDef } = {
  hrAdmin: {
    email: "bree.martinez@audithalo.test",
    name: "Bree Martinez",
    role: "hr_admin",
  },
  supervisor: {
    email: "sarah.chen@audithalo.test",
    name: "Dr. Sarah Chen",
    role: "supervisor",
  },
  supervisee: {
    email: "jordan.williams@audithalo.test",
    name: "Jordan Williams",
    role: "supervisee",
    state: "NC",
    licenseType: "LCMHCA",
  },
};

function genPassword(): string {
  return randomBytes(18).toString("base64url");
}

function daysAgo(days: number, hour = 14): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

function daysAhead(days: number, hour = 10): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // Check idempotency
    const existing = await client.query(
      `SELECT id FROM organizations WHERE name = $1`,
      [ORG_NAME]
    );
    if (existing.rows.length > 0) {
      console.log(`Org "${ORG_NAME}" already exists (${existing.rows[0].id}). Aborting.`);
      return;
    }

    const allEmails = [USERS.hrAdmin.email, USERS.supervisor.email, USERS.supervisee.email];
    const emailCheck = await client.query(
      `SELECT email FROM users WHERE email = ANY($1)`,
      [allEmails]
    );
    if (emailCheck.rows.length > 0) {
      console.log(`Users already exist: ${emailCheck.rows.map((r: { email: string }) => r.email).join(", ")}. Aborting.`);
      return;
    }

    // Generate passwords
    for (const u of Object.values(USERS)) {
      u.password = genPassword();
      u.passwordHash = await bcrypt.hash(u.password, BCRYPT_COST);
      u.id = randomUUID();
    }

    const orgId = randomUUID();

    console.log("\n=== RI Test Org Seed Plan ===\n");
    console.log(`Org: ${ORG_NAME} (${orgId})`);
    console.log(`  pdf_template_key: recovery_innovations_v1\n`);
    console.log("Accounts:");
    for (const [role, u] of Object.entries(USERS)) {
      console.log(`  ${role.padEnd(12)} ${u.name.padEnd(20)} ${u.email.padEnd(40)} pw: ${u.password}`);
    }

    if (!APPLY) {
      console.log("\nDry run — pass --apply to write to DB.");
      return;
    }

    console.log("\nApplying...\n");

    await client.query("BEGIN");

    // Step 1: Apply migration 0030 if not already applied
    console.log("Checking migration 0030...");
    const colCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'organizations' AND column_name = 'pdf_template_key'
    `);
    if (colCheck.rows.length === 0) {
      console.log("  Applying migration 0030...");
      await client.query(`ALTER TABLE "organizations" ADD COLUMN "pdf_template_key" text NOT NULL DEFAULT 'audithalo_generic'`);
      await client.query(`ALTER TABLE "session_events" ADD COLUMN "supervision_type" text`);
      await client.query(`ALTER TABLE "session_events" ADD COLUMN "clinical_form_data" jsonb`);
      console.log("  Migration 0030 applied.");
    } else {
      console.log("  Migration 0030 already applied.");
    }

    // Step 2: Create users (before org, because org.created_by_id is a FK)
    for (const u of Object.values(USERS)) {
      await client.query(
        `INSERT INTO users (id, email, name, password_hash, email_verified_at, state, license_type)
         VALUES ($1, $2, $3, $4, NOW(), $5, $6)`,
        [u.id, u.email, u.name, u.passwordHash, u.state ?? null, u.licenseType ?? null]
      );
      console.log(`Created user: ${u.name} (${u.email})`);
    }

    // Step 3: Create org
    await client.query(
      `INSERT INTO organizations (id, name, created_by_id, subscription_status, subscription_tier, seat_count, pdf_template_key)
       VALUES ($1, $2, $3, 'active', 'practice', 10, 'recovery_innovations_v1')`,
      [orgId, ORG_NAME, USERS.hrAdmin.id]
    );
    console.log(`Created org: ${ORG_NAME}`);

    // Step 4: Create org memberships
    for (const u of Object.values(USERS)) {
      await client.query(
        `INSERT INTO org_memberships (id, org_id, user_id, role, leave_status)
         VALUES ($1, $2, $3, $4, 'active')`,
        [randomUUID(), orgId, u.id, u.role]
      );
    }
    console.log("Created memberships.");

    // Step 5: Supervisor assignment
    const assignmentId = randomUUID();
    await client.query(
      `INSERT INTO supervisor_assignments (id, org_id, supervisee_id, supervisor_id)
       VALUES ($1, $2, $3, $4)`,
      [assignmentId, orgId, USERS.supervisee.id, USERS.supervisor.id]
    );
    console.log("Created supervisor assignment.");

    // Step 6: Rule assignment (NC LCMHCA v1)
    const ruleAssignId = randomUUID();
    const obligationStart = daysAgo(180); // 6 months ago
    await client.query(
      `INSERT INTO supervisee_rule_assignments (id, org_id, supervisee_id, rule_id, obligation_started_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [ruleAssignId, orgId, USERS.supervisee.id, "nc-lcmhca-v1", obligationStart]
    );
    console.log("Created rule assignment (NC LCMHCA v1).");

    // Step 7: Session events
    // 7a: A past session that's fully signed (for PDF download testing)
    const signedSessionId = randomUUID();
    const signedDate = daysAgo(7, 14);
    const supervisorSig = {
      signerId: USERS.supervisor.id,
      signerName: USERS.supervisor.name,
      signerRole: "supervisor",
      signedAt: new Date(signedDate.getTime() + 3600000 * 1.5 + 60000).toISOString(),
      ipAddress: "10.0.0.1",
      intentConfirmed: true,
    };
    const superviseeSig = {
      signerId: USERS.supervisee.id,
      signerName: USERS.supervisee.name,
      signerRole: "supervisee",
      signedAt: new Date(signedDate.getTime() + 3600000 * 1.5 + 120000).toISOString(),
      ipAddress: "10.0.0.2",
      intentConfirmed: true,
    };
    await client.query(
      `INSERT INTO session_events (id, supervisee_id, org_id, kind, date, duration_hours, session_type, logged_by_id, signatures, signed_at, supervision_type, clinical_form_data)
       VALUES ($1, $2, $3, 'supervision', $4, 1.5, 'individual', $5, $6, $7, 'clinician', $8)`,
      [
        signedSessionId,
        USERS.supervisee.id,
        orgId,
        signedDate,
        USERS.supervisor.id,
        JSON.stringify([supervisorSig, superviseeSig]),
        superviseeSig.signedAt,
        JSON.stringify({
          competenciesChecked: ["technical_knowledge", "communication_skills", "trauma_informed_care"],
          coreSkillsChecked: ["barrier_intervention", "interpersonal_community"],
          actionSteps: [
            { step: "Complete WRAP facilitation module", targetDate: "2026-07-20" },
            { step: "Shadow senior clinician on intakes", targetDate: "2026-07-31" },
          ],
          followUpFromPrevious: "Reviewed progress on de-escalation training from last session.",
          additionalContext: "Jordan demonstrated strong rapport-building skills. Recommend continuing crisis intervention practice.",
          superviseeJobTitle: "Behavioral Health Technician",
          superviseeCredentials: "QMHP",
        }),
      ]
    );
    console.log("Created signed session (7 days ago) with clinical form data.");

    // Generate evidence package for the signed session
    const evidenceDoc = {
      schemaVersion: "v1",
      generatedAt: new Date().toISOString(),
      ruleId: "nc-lcmhca-v1",
      rule: {
        jurisdiction: "NC",
        licenseCode: "LCMHCA",
        licenseName: "Licensed Clinical Mental Health Counselor Associate",
        issuingBoard: "North Carolina Board of Licensed Clinical Mental Health Counselors",
        version: 1,
        citation: { admincode: "21 NCAC 53 .0209", url: "https://www.ncblcmhc.org" },
        effectiveStart: "2023-01-01",
      },
      organization: { id: orgId, name: ORG_NAME },
      supervisee: { id: USERS.supervisee.id, name: USERS.supervisee.name, email: USERS.supervisee.email },
      session: {
        id: signedSessionId,
        date: signedDate.toISOString(),
        durationHours: 1.5,
        kind: "supervision",
        sessionType: "individual",
        supervisionType: "clinician",
        supervisorCredentials: null,
        groupAttendees: null,
        signedAt: superviseeSig.signedAt,
      },
      obligation: { startedAt: obligationStart.toISOString(), supervisionContractFiledAt: null },
      signatures: [supervisorSig, superviseeSig],
      aiNote: null,
      clinicalFormData: {
        competenciesChecked: ["technical_knowledge", "communication_skills", "trauma_informed_care"],
        coreSkillsChecked: ["barrier_intervention", "interpersonal_community"],
        actionSteps: [
          { step: "Complete WRAP facilitation module", targetDate: "2026-07-20" },
          { step: "Shadow senior clinician on intakes", targetDate: "2026-07-31" },
        ],
        followUpFromPrevious: "Reviewed progress on de-escalation training from last session.",
        additionalContext: "Jordan demonstrated strong rapport-building skills. Recommend continuing crisis intervention practice.",
        superviseeJobTitle: "Behavioral Health Technician",
        superviseeCredentials: "QMHP",
      },
      pdfTemplateKey: "recovery_innovations_v1",
    };

    function canonicalize(value: unknown): unknown {
      if (Array.isArray(value)) return value.map(canonicalize);
      if (value && typeof value === "object" && !(value instanceof Date)) {
        const sorted: Record<string, unknown> = {};
        for (const k of Object.keys(value as Record<string, unknown>).sort()) {
          sorted[k] = canonicalize((value as Record<string, unknown>)[k]);
        }
        return sorted;
      }
      return value;
    }
    const canonical = JSON.stringify(canonicalize(evidenceDoc));
    const hash = createHash("sha256").update(canonical).digest("hex");
    const evidenceId = randomUUID();

    await client.query(
      `INSERT INTO evidence_packages (id, session_event_id, org_id, supervisee_id, rule_id, signatures, document_hash, document_content)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        evidenceId,
        signedSessionId,
        orgId,
        USERS.supervisee.id,
        "nc-lcmhca-v1",
        JSON.stringify([supervisorSig, superviseeSig]),
        hash,
        JSON.stringify(evidenceDoc),
      ]
    );
    console.log(`Created evidence package (${evidenceId}) — PDF download will use RI template.`);

    // 7b: A pending session (for testing the clinical form UI on the sign page)
    const pendingSessionId = randomUUID();
    const pendingDate = daysAgo(1, 10);
    await client.query(
      `INSERT INTO session_events (id, supervisee_id, org_id, kind, date, duration_hours, session_type, logged_by_id, signatures)
       VALUES ($1, $2, $3, 'supervision', $4, 1.0, 'individual', $5, '[]')`,
      [
        pendingSessionId,
        USERS.supervisee.id,
        orgId,
        pendingDate,
        USERS.supervisor.id,
      ]
    );
    console.log("Created pending session (yesterday) — ready for clinical form + signing.");

    await client.query("COMMIT");

    console.log("\n=== Done ===\n");
    console.log("Login credentials:");
    for (const [role, u] of Object.entries(USERS)) {
      console.log(`  ${role.padEnd(12)} ${u.email.padEnd(40)} ${u.password}`);
    }
    console.log(`\nSigned session (PDF test):   /sign/${signedSessionId}`);
    console.log(`Pending session (form test): /sign/${pendingSessionId}`);
    console.log(`Evidence package ID:         ${evidenceId}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error — transaction rolled back:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
