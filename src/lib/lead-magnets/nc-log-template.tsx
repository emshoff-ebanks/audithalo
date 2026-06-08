import {
  Document,
  Page,
  Text,
  View,
} from "@react-pdf/renderer";
import { colors, styles } from "./styles";

/**
 * NC Supervision Log Template — printable PDF, one page.
 *
 * Per the NIM-8 tracker: header section with supervisee + supervisor +
 * citation reference, then a ruled table with the columns a NC board
 * audits, with 12 rows for repeat use. Disclaimer footer names what's
 * missing without the digital seal.
 */

const COLUMN_WIDTHS = {
  date: "11%",
  type: "11%",
  duration: "9%",
  supervisorLicense: "14%",
  topic: "30%",
  signed: "8%",
  notes: "17%",
};

const NUM_BLANK_ROWS = 12;

export function NCLogTemplateDocument() {
  return (
    <Document>
      <Page
        size="LETTER"
        orientation="landscape"
        style={{ ...styles.page, paddingHorizontal: 32, paddingTop: 32 }}
      >
        <View style={styles.headerRow}>
          <Text style={styles.wordmark}>AuditHalo</Text>
          <View>
            <Text style={styles.headerMeta}>NC LCMHCA supervision log template</Text>
            <Text style={styles.headerMeta}>21 NCAC 53 · supervised clinical mental health counseling hours</Text>
          </View>
        </View>

        <Text style={styles.kicker}>FREE DOWNLOAD · PRINT &amp; FILL</Text>
        <Text style={styles.title}>NC supervision log</Text>

        {/* Identifying block — supervisee + supervisor lines */}
        <View
          style={{
            flexDirection: "row",
            marginBottom: 16,
            marginTop: 4,
          }}
        >
          <View style={{ flex: 1, paddingRight: 14 }}>
            <Text style={styles.sectionH3}>Supervisee</Text>
            <View style={{ marginBottom: 6 }}>
              <Text style={styles.citation}>Name</Text>
              <View
                style={{
                  borderBottomWidth: 0.5,
                  borderBottomColor: colors.ink,
                  height: 14,
                }}
              />
            </View>
            <View style={{ marginBottom: 6 }}>
              <Text style={styles.citation}>LCMHCA number</Text>
              <View
                style={{
                  borderBottomWidth: 0.5,
                  borderBottomColor: colors.ink,
                  height: 14,
                }}
              />
            </View>
          </View>
          <View style={{ flex: 1, paddingLeft: 14 }}>
            <Text style={styles.sectionH3}>Supervisor</Text>
            <View style={{ marginBottom: 6 }}>
              <Text style={styles.citation}>Name + credential (LCMHCS)</Text>
              <View
                style={{
                  borderBottomWidth: 0.5,
                  borderBottomColor: colors.ink,
                  height: 14,
                }}
              />
            </View>
            <View style={{ marginBottom: 6 }}>
              <Text style={styles.citation}>LCMHCS number</Text>
              <View
                style={{
                  borderBottomWidth: 0.5,
                  borderBottomColor: colors.ink,
                  height: 14,
                }}
              />
            </View>
          </View>
        </View>

        {/* Session table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { width: COLUMN_WIDTHS.date }]}>
            DATE
          </Text>
          <Text style={[styles.tableHeaderCell, { width: COLUMN_WIDTHS.type }]}>
            TYPE
          </Text>
          <Text
            style={[styles.tableHeaderCell, { width: COLUMN_WIDTHS.duration }]}
          >
            HRS
          </Text>
          <Text
            style={[
              styles.tableHeaderCell,
              { width: COLUMN_WIDTHS.supervisorLicense },
            ]}
          >
            SUPERVISOR LCMHCS#
          </Text>
          <Text style={[styles.tableHeaderCell, { width: COLUMN_WIDTHS.topic }]}>
            TOPIC / COMPETENCY
          </Text>
          <Text style={[styles.tableHeaderCell, { width: COLUMN_WIDTHS.signed }]}>
            SIGNED
          </Text>
          <Text style={[styles.tableHeaderCell, { width: COLUMN_WIDTHS.notes }]}>
            NOTES
          </Text>
        </View>

        {Array.from({ length: NUM_BLANK_ROWS }).map((_, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.tableCell, { width: COLUMN_WIDTHS.date }]} />
            <Text style={[styles.tableCell, { width: COLUMN_WIDTHS.type }]} />
            <Text style={[styles.tableCell, { width: COLUMN_WIDTHS.duration }]} />
            <Text
              style={[
                styles.tableCell,
                { width: COLUMN_WIDTHS.supervisorLicense },
              ]}
            />
            <Text style={[styles.tableCell, { width: COLUMN_WIDTHS.topic }]} />
            <Text style={[styles.tableCell, { width: COLUMN_WIDTHS.signed }]} />
            <Text style={[styles.tableCell, { width: COLUMN_WIDTHS.notes }]} />
          </View>
        ))}

        {/* Column key */}
        <View style={{ marginTop: 14 }}>
          <Text style={styles.citation}>
            TYPE: I = individual · T = triadic · G = group · D = direct
            observation
          </Text>
          <Text style={styles.citation}>
            SIGNED: ✓ both sides have countersigned at the time of the session
          </Text>
        </View>

        {/* Disclaimer */}
        <View style={[styles.callout, { marginTop: 14 }]}>
          <Text style={styles.calloutTitle}>WHAT THIS PAPER LOG IS MISSING</Text>
          <Text style={styles.calloutBody}>
            A handwritten log is a starting point — it satisfies the field
            requirements but can&apos;t prove immutability to an auditor.
            AuditHalo seals every session into a SHA-256-hashed evidence
            package the board can verify independently. The supervisor
            credential snapshot is captured at the time of signing, not
            reconstructed at audit time. Start at audithalo.com.
          </Text>
        </View>

        <Text style={styles.footer}>
          AuditHalo · audithalo.com · Template based on 21 NCAC 53. Not
          legal advice — verify against current NCBLCMHC guidance before
          relying on it for an actual board audit.
        </Text>
      </Page>
    </Document>
  );
}
