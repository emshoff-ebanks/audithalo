import {
  Document,
  Page,
  Text,
  View,
} from "@react-pdf/renderer";
import { styles } from "./styles";

/**
 * NC Supervision Audit Checklist — printable PDF, two pages.
 *
 * Content sourced from rules/nc-lcmhca/v1.yaml (21 NCAC 53 + NCBLCMHC
 * verification notes) and the campaign playbook objection answers.
 *
 * Page 1: the 12 fields a NC LCMHCA audit reviews — formatted as a
 * tick-box checklist a supervisor can actually use to self-audit a
 * supervisee's record.
 * Page 2: the three failure modes that fail the most audits, what a
 * board-defensible log looks like, and the contact-the-supervisor flag
 * that closes the loop.
 */

const FIELD_CHECKLIST = [
  {
    label: "Supervision contract on file with NCBLCMHC",
    note: "Hours logged before the contract date don't count toward the 3,000-hour total.",
  },
  {
    label: "Supervisor credential current at the moment of every session",
    note: "LCMHCS required. The board checks the snapshot — not whether the credential is current today.",
  },
  {
    label: "Total practice hours met or progressing toward 3,000",
    note: "21 NCAC 53 §0.0501.",
  },
  {
    label: "Total supervision hours met or progressing toward 100",
    note: "Same statute. Counted separately from practice hours.",
  },
  {
    label: "At least 75% of supervision hours are individual",
    note: "Group, triadic, and program-level supervision combined cap at 25%.",
  },
  {
    label: "Individual supervision cadence ≤ 14 days during all practice weeks",
    note: "The single biggest cause of failed audits. A 6-week gap during a busy month invalidates the practice hours logged in that gap.",
  },
  {
    label: "Each 40 practice-hour block has at least 1 hour of individual supervision",
    note: "Or at least 2 hours of group supervision. The ratio is enforced per-block, not aggregate.",
  },
  {
    label: "Group sessions never exceed 12 attendees",
    note: "Sessions with 13+ attendees do not count as supervision at all.",
  },
  {
    label: "Session types logged at the time of the session",
    note: "Individual / triadic / group / direct-observation. Reclassifying after the fact reads as reconstruction.",
  },
  {
    label: "Both supervisor and supervisee signed every supervision session",
    note: "Intent-confirmed signatures. A signature without confirmation of intent (\"I have reviewed and approve\") is questioned in audit.",
  },
  {
    label: "Record is contemporaneous and immutable",
    note: "Spreadsheets fail this. Any document that can be silently edited after-the-fact is treated as suspect.",
  },
  {
    label: "Hour totals reconcile against your NCBLCMHC progress report",
    note: "If your internal totals disagree with what the board sees, the board's number wins — and the audit opens.",
  },
];

const FAILURE_MODES = [
  {
    title: "1. The credential snapshot",
    body: "The supervisor was credentialed when the supervision was provided — but you can't prove it because nobody recorded their credential number at the time. AuditHalo snapshots the credential onto every session automatically at signing.",
  },
  {
    title: "2. The cadence gap",
    body: "Six-week stretch with no individual supervision during an otherwise normal clinical month. The practice hours logged during that stretch don't count. AuditHalo flags this 60 days before the deadline so you can schedule make-up sessions.",
  },
  {
    title: "3. The immutability question",
    body: "Your supervision log lives in Google Sheets. The auditor doesn't trust that you haven't backfilled it. AuditHalo's evidence packages are SHA-256 hashed at the moment of signing — auditors can independently verify it hasn't been altered.",
  },
];

const DEFENSIBLE_LOG_FIELDS = [
  "Session date",
  "Session type (individual / triadic / group / direct-observation)",
  "Duration in hours",
  "Supervisor name + LCMHCS number (snapshotted at signing)",
  "Supervisee name + LCMHCA number",
  "One-line topic or competency addressed",
  "Both signatures with intent confirmation",
  "Tamper-evident seal (SHA-256 hash of the canonical document)",
];

export function NCAuditChecklistDocument() {
  return (
    <Document>
      {/* Page 1 — the 12-item checklist */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          <Text style={styles.wordmark}>AuditHalo</Text>
          <View>
            <Text style={styles.headerMeta}>NC LCMHCA supervision audit checklist</Text>
            <Text style={styles.headerMeta}>Drafted from 21 NCAC 53 · verified against NCBLCMHC guidance</Text>
          </View>
        </View>

        <Text style={styles.kicker}>FREE DOWNLOAD · PAGE 1 OF 2</Text>
        <Text style={styles.title}>
          NC supervision audit checklist
        </Text>
        <Text style={styles.intro}>
          The twelve fields a North Carolina LCMHCA supervision audit reviews,
          formatted so you can run it against a supervisee&apos;s record in an
          afternoon. The three items most likely to fail an audit are on page 2,
          with the fixes.
        </Text>

        <Text style={styles.sectionH2}>The twelve fields</Text>
        {FIELD_CHECKLIST.map((item, i) => (
          <View key={i} style={styles.checklistRow}>
            <View style={styles.checkbox} />
            <View style={styles.checklistText}>
              <Text>{item.label}</Text>
              {item.note && <Text style={styles.citation}>{item.note}</Text>}
            </View>
          </View>
        ))}

        <View style={styles.callout}>
          <Text style={styles.calloutTitle}>HEADS UP</Text>
          <Text style={styles.calloutBody}>
            North Carolina is one of the strictest states on cadence (14-day
            maximum) and credential snapshots. If you supervise across states,
            verify the cadence rule for each — California and Texas use
            different intervals.
          </Text>
        </View>

        <Text style={styles.footer}>
          AuditHalo · audithalo.com · The supervision-compliance system for
          mental health supervisors in NC, CA, TX, FL, NY.
        </Text>
      </Page>

      {/* Page 2 — failure modes + what a defensible log looks like */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          <Text style={styles.wordmark}>AuditHalo</Text>
          <Text style={styles.headerMeta}>Page 2 of 2</Text>
        </View>

        <Text style={styles.sectionH2}>The three items that fail most audits</Text>
        {FAILURE_MODES.map((mode, i) => (
          <View key={i} style={{ marginBottom: 14 }}>
            <Text style={styles.sectionH3}>{mode.title}</Text>
            <Text>{mode.body}</Text>
          </View>
        ))}

        <Text style={styles.sectionH2}>What a board-defensible log looks like</Text>
        <Text style={{ marginBottom: 6 }}>
          Every supervision session in the record should carry these fields,
          captured at the moment of the session — not reconstructed later.
        </Text>
        {DEFENSIBLE_LOG_FIELDS.map((field, i) => (
          <View key={i} style={styles.bulletRow}>
            <Text style={styles.bullet}>•</Text>
            <Text>{field}</Text>
          </View>
        ))}

        <View style={styles.callout}>
          <Text style={styles.calloutTitle}>WHEN TO CALL YOUR SUPERVISOR</Text>
          <Text style={styles.calloutBody}>
            If you discover a missing credential snapshot, a cadence gap, or a
            log that can&apos;t prove immutability — talk to your supervisor
            and document the conversation in writing. A contemporaneous
            acknowledgment of a gap is meaningfully better than a quiet
            reconstruction.
          </Text>
        </View>

        <Text style={styles.sectionH2}>How AuditHalo handles each one</Text>
        <View style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text>
            Credential snapshot at signing — your LCMHCS number is recorded on
            every supervision session automatically.
          </Text>
        </View>
        <View style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text>
            Cadence monitoring — at-risk flags fire 60 days before any deadline,
            with the exact gap measured against the 14-day rule.
          </Text>
        </View>
        <View style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text>
            Tamper-evident seal — every signed session produces a SHA-256
            hashed evidence package an auditor can verify independently.
          </Text>
        </View>

        <Text style={styles.footer}>
          AuditHalo · audithalo.com · Drafted from 21 NCAC 53 and NCBLCMHC
          guidance. Reviewed by licensed clinical supervisors. Not legal advice.
        </Text>
      </Page>
    </Document>
  );
}
