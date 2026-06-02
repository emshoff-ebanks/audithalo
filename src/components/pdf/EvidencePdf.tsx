import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 56,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#0A1428",
  },
  haloMark: {
    width: 22,
    height: 22,
    borderWidth: 2.5,
    borderColor: "#B8860B",
    borderRadius: 11,
    marginRight: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  wordmark: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    letterSpacing: -0.4,
  },
  overline: {
    fontSize: 8,
    letterSpacing: 1.6,
    color: "#5F6470",
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  h1: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    marginTop: 22,
    color: "#0A1428",
  },
  h2: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginTop: 20,
    marginBottom: 6,
    color: "#0F1F4C",
  },
  intro: {
    fontSize: 11,
    color: "#0A1428",
    lineHeight: 1.5,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#E3E0D4",
    marginVertical: 14,
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  labelCol: {
    width: 130,
    color: "#5F6470",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontFamily: "Helvetica-Bold",
  },
  valueCol: {
    flex: 1,
    fontSize: 10,
    color: "#0A1428",
  },
  sigBlock: {
    borderWidth: 0.5,
    borderColor: "#E3E0D4",
    padding: 10,
    marginBottom: 6,
  },
  sigName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  sigMeta: {
    fontSize: 8,
    color: "#5F6470",
  },
  footer: {
    marginTop: 28,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E3E0D4",
  },
  footerLabel: {
    fontSize: 8,
    letterSpacing: 1.4,
    color: "#5F6470",
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  hash: {
    fontFamily: "Courier-Bold",
    fontSize: 8,
    color: "#0A1428",
    lineHeight: 1.4,
  },
  fineprint: {
    fontSize: 8,
    color: "#5F6470",
    marginTop: 8,
    lineHeight: 1.4,
  },
});

type EvidenceDoc = {
  schemaVersion: string;
  generatedAt: string;
  ruleId: string;
  rule: {
    jurisdiction: string;
    licenseCode: string;
    licenseName: string;
    issuingBoard: string;
    version: number;
    citation: { admincode: string; statute?: string; url: string };
    effectiveStart: string;
  };
  organization: { id: string; name: string };
  supervisee: { id: string; name: string; email: string };
  session: {
    id: string;
    date: string;
    durationHours: number;
    kind: string;
    sessionType: string | null;
    supervisorCredentials: string[] | null;
    groupAttendees: number | null;
    signedAt: string;
  };
  obligation: {
    startedAt: string;
    supervisionContractFiledAt: string | null;
  };
  signatures: Array<{
    signerName: string;
    signerRole: string;
    signedAt: string;
    ipAddress: string;
  }>;
};

type Props = {
  document: EvidenceDoc;
  documentHash: string;
  packageId: string;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.labelCol}>{label}</Text>
      <Text style={styles.valueCol}>{value}</Text>
    </View>
  );
}

export function EvidencePdf({ document: d, documentHash, packageId }: Props) {
  const verifyUrl = `https://audithalo.com/verify/${packageId}?hash=${documentHash}`;
  return (
    <Document
      title={`Evidence Package — ${d.supervisee.name} — ${d.session.date.slice(0, 10)}`}
      author="AuditHalo"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.haloMark} />
          <Text style={styles.wordmark}>AuditHalo</Text>
        </View>
        <Text style={styles.overline}>Evidence package · {d.schemaVersion}</Text>
        <Text style={styles.h1}>Supervision session evidence</Text>
        <Text style={styles.intro}>
          This document is the audit artifact for a single supervision session,
          attesting that the rule below was in effect, that the session occurred,
          and that the required signers each confirmed intent at the timestamps
          recorded.
        </Text>

        <Text style={styles.h2}>Rule in effect</Text>
        <Row label="Jurisdiction" value={d.rule.jurisdiction} />
        <Row
          label="License"
          value={`${d.rule.licenseName} (${d.rule.licenseCode}) — v${d.rule.version}`}
        />
        <Row label="Issuing board" value={d.rule.issuingBoard} />
        <Row label="Citation" value={d.rule.citation.admincode} />
        {d.rule.citation.statute && (
          <Row label="Statute" value={d.rule.citation.statute} />
        )}
        <Row label="Source URL" value={d.rule.citation.url} />
        <Row
          label="Effective"
          value={`Since ${d.rule.effectiveStart.slice(0, 10)}`}
        />

        <View style={styles.divider} />

        <Text style={styles.h2}>Supervisee</Text>
        <Row label="Name" value={d.supervisee.name} />
        <Row label="Email" value={d.supervisee.email} />
        <Row label="ID" value={d.supervisee.id} />

        <Text style={styles.h2}>Organization</Text>
        <Row label="Name" value={d.organization.name} />
        <Row label="ID" value={d.organization.id} />

        <Text style={styles.h2}>Obligation context</Text>
        <Row
          label="Obligation start"
          value={d.obligation.startedAt.slice(0, 10)}
        />
        {d.obligation.supervisionContractFiledAt && (
          <Row
            label="Contract filed"
            value={d.obligation.supervisionContractFiledAt.slice(0, 10)}
          />
        )}

        <Text style={styles.h2}>Session</Text>
        <Row label="Date" value={d.session.date.slice(0, 10)} />
        <Row label="Duration" value={`${d.session.durationHours.toFixed(2)} hours`} />
        <Row label="Kind" value={d.session.kind} />
        {d.session.sessionType && (
          <Row label="Type" value={d.session.sessionType} />
        )}
        {d.session.supervisorCredentials && (
          <Row
            label="Supervisor credentials"
            value={d.session.supervisorCredentials.join(", ")}
          />
        )}
        {d.session.groupAttendees != null && (
          <Row
            label="Group attendees"
            value={String(d.session.groupAttendees)}
          />
        )}
        <Row label="Session ID" value={d.session.id} />
        <Row
          label="Sealed at"
          value={d.session.signedAt.replace("T", " ").slice(0, 19) + "Z"}
        />

        <Text style={styles.h2}>Signatures with intent</Text>
        {d.signatures.map((s, i) => (
          <View key={i} style={styles.sigBlock}>
            <Text style={styles.sigName}>{s.signerName}</Text>
            <Text style={styles.sigMeta}>
              Role: {s.signerRole} · Signed:{" "}
              {s.signedAt.replace("T", " ").slice(0, 19)}Z · IP: {s.ipAddress} ·
              Intent: confirmed
            </Text>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerLabel}>Canonical document hash (SHA-256)</Text>
          <Text style={styles.hash}>{documentHash}</Text>
          <Text style={[styles.footerLabel, { marginTop: 10 }]}>
            Verify online
          </Text>
          <Text style={styles.hash}>{verifyUrl}</Text>
          <Text style={styles.fineprint}>
            Anyone can confirm this document is genuine by visiting the URL above —
            no AuditHalo account required. The hash is computed over the canonical
            JSON of this evidence package (keys sorted recursively). Any tampering
            — to the original record or to this PDF — produces a different hash,
            making the record independently verifiable. Generated by AuditHalo on{" "}
            {d.generatedAt.replace("T", " ").slice(0, 19)}Z.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
