/**
 * Seed 3 test accounts for Damon to manually exercise the app:
 *   - HR Admin (org owner, Enterprise tier)
 *   - Supervisor
 *   - Supervisee (assigned to the Supervisor + NC LCMHCA rule)
 *
 * Idempotent — re-running deletes the prior Damon-Test org and rebuilds
 * with fresh credentials.
 *
 * Run: npx tsx scripts/seed-damon-test-accounts.ts
 *
 * Output: prints credentials to stdout. Save them — passwords are not
 * recoverable from the DB.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";

// Inline copies of the canonical-JSON + SHA-256 helpers from
// src/lib/evidence.ts so this script doesn't have to import the @ alias.
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
function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}
function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

const ORG_NAME = "Damon Test Org";
const EMAIL_DOMAIN = "audithalo.test";
const RULE_ID = "nc-lcmhca-v1";

type RoleSpec = {
  role: "hr_admin" | "supervisor" | "supervisee";
  emailLocal: string;
  fullName: string;
};

const ROLES: RoleSpec[] = [
  { role: "hr_admin",   emailLocal: "damon-test-hr",         fullName: "Damon Test HR Admin"   },
  { role: "supervisor", emailLocal: "damon-test-supervisor", fullName: "Damon Test Supervisor" },
  { role: "supervisee", emailLocal: "damon-test-supervisee", fullName: "Damon Test Supervisee" },
];

function genPassword(): string {
  return randomBytes(12).toString("base64url").slice(0, 16);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  console.log(`target: ${new URL(url).hostname}\n`);

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Clean slate — remove any prior Damon-Test org + users.
    const prior = await client.query(
      `SELECT id FROM organizations WHERE name = $1`,
      [ORG_NAME]
    );
    if (prior.rowCount && prior.rowCount > 0) {
      console.log(`[seed] removing prior ${ORG_NAME} (${prior.rowCount} found)`);
      await client.query(`DELETE FROM organizations WHERE name = $1`, [ORG_NAME]);
      await client.query(
        `DELETE FROM users WHERE email LIKE 'damon-test-%@${EMAIL_DOMAIN}'`
      );
    }

    // Create the 3 users.
    const userIds: Record<string, string> = {};
    const credentials: { role: string; email: string; password: string }[] = [];

    for (const r of ROLES) {
      const email = `${r.emailLocal}@${EMAIL_DOMAIN}`;
      const password = genPassword();
      const passwordHash = await bcrypt.hash(password, 10);

      const ins = await client.query(
        `INSERT INTO users (email, password_hash, name, role, email_verified_at)
         VALUES ($1, $2, $3, $4::user_role, NOW())
         RETURNING id`,
        [email, passwordHash, r.fullName, r.role]
      );
      userIds[r.role] = ins.rows[0].id;
      credentials.push({ role: r.role, email, password });
      console.log(`[seed] user created: ${r.role.padEnd(11)} ${email}`);
    }

    // Create org with the HR Admin as owner, Enterprise tier so HR Admin
    // actually has the unlocked controls.
    const orgIns = await client.query(
      `INSERT INTO organizations
         (name, created_by_id, subscription_tier, subscription_status)
       VALUES ($1, $2, 'enterprise', 'active')
       RETURNING id`,
      [ORG_NAME, userIds.hr_admin]
    );
    const orgId = orgIns.rows[0].id;
    console.log(`[seed] org created: ${ORG_NAME} (${orgId})`);

    // Default org_settings row.
    await client.query(
      `INSERT INTO org_settings (org_id) VALUES ($1)
       ON CONFLICT (org_id) DO NOTHING`,
      [orgId]
    );

    // Memberships — one per role.
    for (const r of ROLES) {
      await client.query(
        `INSERT INTO org_memberships (org_id, user_id, role)
         VALUES ($1, $2, $3::user_role)`,
        [orgId, userIds[r.role], r.role]
      );
    }
    console.log(`[seed] 3 memberships created`);

    // supervisor_assignments — Supervisor primary on Supervisee.
    await client.query(
      `INSERT INTO supervisor_assignments
         (org_id, supervisor_id, supervisee_id, is_primary)
       VALUES ($1, $2, $3, true)`,
      [orgId, userIds.supervisor, userIds.supervisee]
    );
    console.log(`[seed] supervisor_assignment created (supervisor → supervisee)`);

    // Rule assignment for the supervisee so the dashboard isn't empty.
    // NC LCMHCA, obligation started 30 days ago.
    await client.query(
      `INSERT INTO supervisee_rule_assignments
         (supervisee_id, org_id, rule_id, obligation_started_at)
       VALUES ($1, $2, $3, NOW() - INTERVAL '30 days')`,
      [userIds.supervisee, orgId, RULE_ID]
    );
    console.log(`[seed] supervisee assigned to ${RULE_ID}`);

    // ─── Dummy session data ─────────────────────────────────────────────
    // Goal: realistic compliance picture for a supervisee 30 days into NC
    // LCMHCA. Mix of states so the supervisor can see every kind of row:
    //   - 8 practice sessions (no signatures needed)
    //   - 1 sealed supervision (both signed) — evidence package generated
    //   - 1 sealed supervision with AI note — evidence package generated
    //   - 1 half-signed supervision (supervisor signed, awaiting supervisee)
    //   - 1 fresh unsigned supervision (just logged)

    const supervisorName = "Damon Test Supervisor";
    const superviseeName = "Damon Test Supervisee";

    const practiceSessions = [
      { daysAgo: 28, hours: 6 },
      { daysAgo: 25, hours: 5 },
      { daysAgo: 22, hours: 7 },
      { daysAgo: 18, hours: 4 },
      { daysAgo: 14, hours: 6 },
      { daysAgo: 10, hours: 8 },
      { daysAgo: 7,  hours: 5 },
      { daysAgo: 3,  hours: 6 },
    ];

    for (const ps of practiceSessions) {
      await client.query(
        `INSERT INTO session_events
           (supervisee_id, org_id, kind, date, duration_hours,
            direct_contact_hours, practice_state, logged_by_id)
         VALUES ($1, $2, 'practice', $3, $4, $4, 'NC', $5)`,
        [
          userIds.supervisee,
          orgId,
          daysAgo(ps.daysAgo),
          ps.hours,
          userIds.supervisee,
        ]
      );
    }
    console.log(`[seed] ${practiceSessions.length} practice sessions logged`);

    // Helper to build a SessionSignature jsonb shape.
    function signature(opts: {
      userId: string;
      name: string;
      role: "supervisor" | "supervisee";
      signedAt: Date;
    }) {
      return {
        signerId: opts.userId,
        signerName: opts.name,
        signerRole: opts.role,
        signedAt: opts.signedAt.toISOString(),
        ipAddress: "127.0.0.1",
        intentConfirmed: true,
      };
    }

    // Helper to insert a sealed supervision session + evidence package.
    async function sealedSupervision(opts: {
      daysAgo: number;
      withAiNote: boolean;
    }) {
      const sessionDate = daysAgo(opts.daysAgo);
      const supSignedAt = new Date(sessionDate.getTime() + 60 * 60 * 1000);
      const sveSignedAt = new Date(sessionDate.getTime() + 2 * 60 * 60 * 1000);

      const sigs = [
        signature({
          userId: userIds.supervisor,
          name: supervisorName,
          role: "supervisor",
          signedAt: supSignedAt,
        }),
        signature({
          userId: userIds.supervisee,
          name: superviseeName,
          role: "supervisee",
          signedAt: sveSignedAt,
        }),
      ];

      const aiNote = opts.withAiNote
        ? {
            topics: [
              "Boundary setting with high-acuity clients",
              "Countertransference during termination",
              "Documentation practices for risk assessment",
            ],
            competencies: [
              "Diagnostic reasoning",
              "Self-of-the-therapist awareness",
              "Treatment planning collaboration",
            ],
            supervisorFeedback:
              "Supervisee demonstrated strong clinical judgment in managing the termination case. Recommend continued reflection on transference dynamics and reviewing the ACA code for boundary-setting frameworks.",
            nextSteps: [
              "Read chapter 7 of Yalom's existential therapy",
              "Bring a session recording to next supervision",
              "Draft termination plan for the longest-running client",
            ],
            generatedAt: supSignedAt.toISOString(),
            generatedByUserId: userIds.supervisor,
            model: "gpt-4o-2024-08-06",
            transcriptHash: sha256Hex(`dummy-transcript-${opts.daysAgo}`),
            transcriptWordCount: 4200,
            source: "manual",
          }
        : null;

      const sessInsert = await client.query(
        `INSERT INTO session_events
           (supervisee_id, org_id, kind, date, duration_hours,
            session_type, supervisor_credentials, logged_by_id,
            signatures, signed_at, ai_note)
         VALUES ($1, $2, 'supervision', $3, 1.0, 'individual',
                 $4::jsonb, $5, $6::jsonb, $7, $8::jsonb)
         RETURNING id`,
        [
          userIds.supervisee,
          orgId,
          sessionDate,
          JSON.stringify(["LCMHCS"]),
          userIds.supervisor,
          JSON.stringify(sigs),
          sveSignedAt,
          aiNote ? JSON.stringify(aiNote) : null,
        ]
      );
      const sessionEventId = sessInsert.rows[0].id;

      // Mint the evidence package. Document content is a minimal but valid
      // shape — the canonical hash is what state boards verify against.
      const document = {
        sessionEventId,
        sessionDate: sessionDate.toISOString().slice(0, 10),
        durationHours: 1.0,
        sessionType: "individual",
        rule: {
          jurisdiction: "NC",
          licenseCode: "LCMHCA",
          version: 1,
          citation: "21 NCAC 53",
        },
        supervisee: {
          id: userIds.supervisee,
          name: superviseeName,
        },
        supervisor: {
          id: userIds.supervisor,
          name: supervisorName,
          credentials: ["LCMHCS"],
        },
        signatures: sigs,
        ...(aiNote ? { aiNote } : {}),
      };
      const docHash = sha256Hex(canonicalJson(document));

      await client.query(
        `INSERT INTO evidence_packages
           (session_event_id, org_id, supervisee_id, rule_id,
            signatures, document_hash, document_content)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb)`,
        [
          sessionEventId,
          orgId,
          userIds.supervisee,
          RULE_ID,
          JSON.stringify(sigs),
          docHash,
          JSON.stringify(document),
        ]
      );
      return sessionEventId;
    }

    const sealed1 = await sealedSupervision({ daysAgo: 22, withAiNote: false });
    const sealed2 = await sealedSupervision({ daysAgo: 10, withAiNote: true });
    console.log(`[seed] 2 sealed supervisions + evidence packages`);
    console.log(`       (one with AI note: ${sealed2})`);
    console.log(`       (one without:      ${sealed1})`);

    // Half-signed supervision — supervisor signed, awaiting supervisee.
    const halfSignedDate = daysAgo(3);
    const halfSig = [
      signature({
        userId: userIds.supervisor,
        name: supervisorName,
        role: "supervisor",
        signedAt: new Date(halfSignedDate.getTime() + 60 * 60 * 1000),
      }),
    ];
    await client.query(
      `INSERT INTO session_events
         (supervisee_id, org_id, kind, date, duration_hours,
          session_type, supervisor_credentials, logged_by_id, signatures)
       VALUES ($1, $2, 'supervision', $3, 1.0, 'individual',
               $4::jsonb, $5, $6::jsonb)`,
      [
        userIds.supervisee,
        orgId,
        halfSignedDate,
        JSON.stringify(["LCMHCS"]),
        userIds.supervisor,
        JSON.stringify(halfSig),
      ]
    );
    console.log(`[seed] 1 half-signed supervision (awaiting supervisee)`);

    // Fresh unsigned supervision — just logged yesterday.
    await client.query(
      `INSERT INTO session_events
         (supervisee_id, org_id, kind, date, duration_hours,
          session_type, supervisor_credentials, logged_by_id)
       VALUES ($1, $2, 'supervision', $3, 1.0, 'individual',
               $4::jsonb, $5)`,
      [
        userIds.supervisee,
        orgId,
        daysAgo(1),
        JSON.stringify(["LCMHCS"]),
        userIds.supervisor,
      ]
    );
    console.log(`[seed] 1 unsigned supervision (just logged)`);

    await client.query("COMMIT");

    // Print credentials block — Damon needs these.
    console.log("\n──────────────────────────────────────────────────────────");
    console.log("CREDENTIALS — share with Damon. Passwords cannot be recovered.");
    console.log("──────────────────────────────────────────────────────────");
    console.log(`Org name:   ${ORG_NAME}`);
    console.log(`Org ID:     ${orgId}`);
    console.log(`Login at:   https://app.audithalo.com/login`);
    console.log("");
    for (const c of credentials) {
      console.log(`Role:     ${c.role}`);
      console.log(`  Email:    ${c.email}`);
      console.log(`  Password: ${c.password}`);
      console.log("");
    }
    console.log("──────────────────────────────────────────────────────────\n");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
