import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { ClinicalFormData } from "@/lib/clinical-form/types";
import {
  CORE_SKILLS,
  COMPETENCIES,
  SUPERVISION_TYPE_LABELS,
  FREQUENCY_PLAN_LABELS,
} from "@/lib/clinical-form/constants";

const s = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#08111F",
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 16,
    color: "#071A3D",
  },
  headerTable: {
    flexDirection: "row",
    borderWidth: 0.5,
    borderColor: "#08111F",
    marginBottom: 12,
  },
  headerCell: {
    flex: 1,
    padding: 6,
    borderRightWidth: 0.5,
    borderRightColor: "#08111F",
  },
  headerCellLast: {
    flex: 1,
    padding: 6,
  },
  cellLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#5F6470",
    marginBottom: 2,
  },
  cellValue: {
    fontSize: 9,
    color: "#08111F",
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textDecoration: "underline",
    marginTop: 14,
    marginBottom: 6,
    color: "#071A3D",
  },
  sectionSubtitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    marginTop: 8,
    marginBottom: 4,
    color: "#08111F",
  },
  text: {
    fontSize: 9,
    lineHeight: 1.5,
    marginBottom: 4,
  },
  smallText: {
    fontSize: 8,
    color: "#5F6470",
    lineHeight: 1.4,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 3,
  },
  checkbox: {
    width: 10,
    height: 10,
    borderWidth: 0.5,
    borderColor: "#08111F",
    marginRight: 6,
    marginTop: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  checked: {
    width: 10,
    height: 10,
    borderWidth: 0.5,
    borderColor: "#08111F",
    backgroundColor: "#071A3D",
    marginRight: 6,
    marginTop: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  checkmark: {
    fontSize: 7,
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
  },
  checkLabel: {
    flex: 1,
    fontSize: 8,
    lineHeight: 1.4,
  },
  compGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 4,
  },
  compItem: {
    width: "25%",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
    paddingRight: 4,
  },
  compCheckbox: {
    width: 8,
    height: 8,
    borderWidth: 0.5,
    borderColor: "#08111F",
    marginRight: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  compChecked: {
    width: 8,
    height: 8,
    borderWidth: 0.5,
    borderColor: "#08111F",
    backgroundColor: "#071A3D",
    marginRight: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  compLabel: {
    fontSize: 7,
    flex: 1,
  },
  compCheckmark: {
    fontSize: 5,
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
  },
  stepRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  stepLabel: {
    width: 40,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#5F6470",
  },
  stepValue: {
    flex: 1,
    fontSize: 9,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E3E0D4",
    paddingBottom: 2,
  },
  stepDate: {
    width: 90,
    fontSize: 9,
    fontFamily: "Courier",
    textAlign: "right",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E3E0D4",
    paddingBottom: 2,
    marginLeft: 8,
  },
  textBlock: {
    fontSize: 9,
    lineHeight: 1.5,
    minHeight: 36,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E3E0D4",
    paddingBottom: 4,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#E3E0D4",
    marginVertical: 10,
  },
  sigBlock: {
    marginTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: "#E3E0D4",
    paddingTop: 8,
  },
  sigRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  sigLabel: {
    width: 130,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#5F6470",
  },
  sigValue: {
    flex: 1,
    fontSize: 9,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E3E0D4",
    paddingBottom: 2,
  },
  footer: {
    marginTop: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E3E0D4",
  },
  footerLabel: {
    fontSize: 7,
    letterSpacing: 1.2,
    color: "#5F6470",
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  footerBrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 12,
  },
  brandText: {
    fontSize: 8,
    color: "#5F6470",
  },
  pageNumber: {
    fontSize: 8,
    color: "#5F6470",
    fontFamily: "Helvetica-Bold",
  },
  hash: {
    fontFamily: "Courier-Bold",
    fontSize: 7,
    color: "#08111F",
    lineHeight: 1.3,
  },
  fineprint: {
    fontSize: 7,
    color: "#5F6470",
    marginTop: 6,
    lineHeight: 1.3,
  },
  boilerplate: {
    fontSize: 7,
    color: "#5F6470",
    lineHeight: 1.4,
    marginTop: 6,
    marginBottom: 6,
  },
  disclaimer: {
    fontSize: 7,
    fontFamily: "Helvetica-Oblique",
    color: "#5F6470",
    lineHeight: 1.4,
    marginTop: 6,
    marginBottom: 6,
  },
  inlineRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 4,
  },
  inlineItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
    supervisionType: string | null;
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
  aiNote?: Record<string, unknown> | null;
  clinicalFormData?: ClinicalFormData | null;
  pdfTemplateKey?: string;
};

type Props = {
  document: EvidenceDoc;
  documentHash: string;
  packageId: string;
};

function Checkbox({ checked, label }: { checked: boolean; label: string }) {
  return (
    <View style={s.checkRow}>
      <View style={checked ? s.checked : s.checkbox}>
        {checked && <Text style={s.checkmark}>X</Text>}
      </View>
      <Text style={s.checkLabel}>{label}</Text>
    </View>
  );
}

function formatTime12h(isoDate: string): string {
  const d = new Date(isoDate);
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

export function RiClinicalSupervisionPdf({
  document: d,
  documentHash,
  packageId,
}: Props) {
  const cf = d.clinicalFormData ?? {};
  const coreChecked = new Set(cf.coreSkillsChecked ?? []);
  const compChecked = new Set(cf.competenciesChecked ?? []);
  const supervisorSig = d.signatures.find((s) => s.signerRole === "supervisor");
  const superviseeSig = d.signatures.find((s) => s.signerRole === "supervisee");

  const startTime = formatTime12h(d.session.date);
  const endDate = new Date(
    new Date(d.session.date).getTime() + d.session.durationHours * 3600000
  );
  const endTime = formatTime12h(endDate.toISOString());
  const sessionDate = d.session.date.slice(0, 10);
  const supType = d.session.supervisionType
    ? SUPERVISION_TYPE_LABELS[d.session.supervisionType] ?? d.session.supervisionType
    : "—";
  const isGroup =
    d.session.sessionType === "group" || d.session.sessionType === "triadic";

  const verifyUrl = `https://audithalo.com/verify/${packageId}?hash=${documentHash}`;

  return (
    <Document
      title={`Clinical Supervision Form — ${d.supervisee.name} — ${sessionDate}`}
      author="AuditHalo / Recovery Innovations"
    >
      {/* Page 1 — Initial Plan (if applicable) or start of Ongoing */}
      {cf.isInitialPlan && (
        <Page size="LETTER" style={s.page}>
          <Text style={s.title}>Clinical Supervision Form</Text>

          {/* Employee identification */}
          <View style={s.headerTable}>
            <View style={s.headerCell}>
              <Text style={s.cellLabel}>Employee</Text>
              <Text style={s.cellValue}>{d.supervisee.name}</Text>
            </View>
            <View style={s.headerCellLast}>
              <Text style={s.cellLabel}>Job Position</Text>
              <Text style={s.cellValue}>{cf.superviseeJobTitle ?? ""}</Text>
            </View>
          </View>
          <View style={s.headerTable}>
            <View style={s.headerCell}>
              <Text style={s.cellLabel}>Credentials</Text>
              <Text style={s.cellValue}>{cf.superviseeCredentials ?? ""}</Text>
            </View>
            <View style={s.headerCellLast}>
              <Text style={s.cellLabel}>Date</Text>
              <Text style={s.cellValue}>{sessionDate}</Text>
            </View>
          </View>

          <Text style={s.sectionTitle}>Initial Supervision Plan</Text>

          <View style={s.inlineRow}>
            <Text style={s.text}>
              Date: {sessionDate} Start Time: {startTime} End Time: {endTime} Length:{" "}
              {formatDuration(d.session.durationHours)}
            </Text>
          </View>

          <Text style={[s.text, { marginTop: 6 }]}>
            Agreed Plan of Supervision:{" "}
            {d.session.sessionType === "individual"
              ? "Individual"
              : d.session.sessionType === "group" || d.session.sessionType === "triadic"
                ? "Team/Group"
                : "—"}
          </Text>

          <Text style={s.text}>
            Frequency Plan of Supervision:{" "}
            {cf.frequencyPlan
              ? FREQUENCY_PLAN_LABELS[cf.frequencyPlan] ?? cf.frequencyPlan
              : "—"}
          </Text>

          <Text style={s.text}>
            Clinical Supervision &amp; Oversight Policy Reviewed:{" "}
            {cf.policyReviewed ? "Yes" : "No"}
          </Text>

          <Text style={s.text}>Type of Supervision: {supType}</Text>

          <Text style={s.boilerplate}>
            Purpose, Goals and Objectives of Supervision is to fulfil requirements
            for training supervision and to promote development of supervisee&apos;s
            professional identity and competence as agreed upon. The content of
            supervision will focus on the acquisition of knowledge,
            conceptualization, and skills within the defined scope of practice. The
            context will ensure understanding of ethics, codes, rules, regulations,
            standards, guidelines including but not limited to confidentiality,
            privacy and applicable legislation as outlined within Recovery
            Innovations Policies and Procedures.
          </Text>

          <Text style={s.disclaimer}>
            *Disclaimer: Recovery Innovations does not provide clinical supervision
            that counts toward state-approved hours required to obtain independent or
            full licensure. This supervision is not intended to fulfill the
            requirements for state licensure but is provided as a professional
            resource to support and improve guest care and staff development.
          </Text>

          <Text style={s.text}>
            Supervision Plan/Contract Agreed Upon:{" "}
            {cf.contractAgreedUpon ? "Yes" : "No"}
          </Text>

          <View style={s.footerBrand}>
            <Text style={s.brandText}>Recovery Innovations</Text>
            <Text style={s.pageNumber}>Clinical Supervision Form — Page 1</Text>
          </View>
        </Page>
      )}

      {/* Page 2 — Ongoing Supervision */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.title}>Clinical Supervision Form</Text>

        {/* Session logistics */}
        <View style={s.headerTable}>
          <View style={s.headerCell}>
            <Text style={s.cellLabel}>Supervision Date</Text>
            <Text style={s.cellValue}>{sessionDate}</Text>
          </View>
          <View style={s.headerCell}>
            <Text style={s.cellLabel}>Start Time</Text>
            <Text style={s.cellValue}>{startTime}</Text>
          </View>
          <View style={s.headerCell}>
            <Text style={s.cellLabel}>End Time</Text>
            <Text style={s.cellValue}>{endTime}</Text>
          </View>
          <View style={s.headerCellLast}>
            <Text style={s.cellLabel}>Length</Text>
            <Text style={s.cellValue}>
              {formatDuration(d.session.durationHours)}
            </Text>
          </View>
        </View>

        <Text style={s.text}>
          Type of Coaching: {isGroup ? "Team/Group" : "Individual"}
        </Text>
        <Text style={s.text}>Type of Supervision: {supType}</Text>

        {/* Follow-up */}
        <Text style={s.sectionTitle}>
          Follow up from previous supervision session(s):
        </Text>
        <Text style={s.textBlock}>{cf.followUpFromPrevious ?? ""}</Text>

        {/* Section I */}
        <Text style={s.sectionTitle}>
          I. Select one or more key areas/skills/goals discussed:
        </Text>
        <Text style={s.smallText}>* Required core skills</Text>

        {CORE_SKILLS.filter((sk) => sk.key !== "other").map((sk) => (
          <Checkbox
            key={sk.key}
            checked={coreChecked.has(sk.key)}
            label={sk.label}
          />
        ))}
        <Checkbox
          checked={coreChecked.has("other")}
          label={`Other: ${cf.otherCoreSkill ?? ""}`}
        />

        {/* Competency grid */}
        <View style={[s.compGrid, { marginTop: 8 }]}>
          {COMPETENCIES.map((c) => (
            <View key={c.key} style={s.compItem}>
              <View style={compChecked.has(c.key) ? s.compChecked : s.compCheckbox}>
                {compChecked.has(c.key) && <Text style={s.compCheckmark}>X</Text>}
              </View>
              <Text style={s.compLabel}>
                {c.label}
                {c.required ? "*" : ""}
              </Text>
            </View>
          ))}
        </View>

        {/* Section II or III */}
        {isGroup ? (
          <>
            <Text style={s.sectionTitle}>
              III. Group Supervision: Key areas/skills discussed
            </Text>
            <Text style={s.textBlock}>
              {cf.groupDiscussionTopics ?? ""}
            </Text>
          </>
        ) : (
          <>
            <Text style={s.sectionTitle}>
              II. Individual Supervision: Action steps to reach identified goals
            </Text>
            {(cf.actionSteps ?? [{ step: "", targetDate: "" }, { step: "", targetDate: "" }])
              .slice(0, 2)
              .map((step, i) => (
                <View key={i} style={s.stepRow}>
                  <Text style={s.stepLabel}>Step {i + 1}:</Text>
                  <Text style={s.stepValue}>{step.step}</Text>
                  <Text style={s.stepDate}>
                    {step.targetDate || "Target Date"}
                  </Text>
                </View>
              ))}
          </>
        )}

        <View style={s.footerBrand}>
          <Text style={s.brandText}>Recovery Innovations</Text>
          <Text style={s.pageNumber}>
            Clinical Supervision Form — Page {cf.isInitialPlan ? "2" : "1"}
          </Text>
        </View>
      </Page>

      {/* Page 3 — Sections IV, V, VI + Signatures */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.title}>Clinical Supervision Form</Text>

        {/* Section IV */}
        <Text style={s.sectionTitle}>IV.</Text>
        <Text style={s.text}>
          Do you need any training, continuing education/CEUs or support to
          accomplish this goal? If so what?
        </Text>
        <Text style={s.textBlock}>{cf.trainingNeeds ?? ""}</Text>

        <Text style={s.text}>
          How will your team and the people we work with benefit from achieving
          this goal?
        </Text>
        <Text style={s.textBlock}>{cf.teamBenefit ?? ""}</Text>

        {/* Section V(a) */}
        <Text style={s.sectionTitle}>
          V. (a) Case Review/Chart Reviews Findings
        </Text>
        <Text style={s.smallText}>
          Documentation, assessment, diagnosis, final disposition and risk
          assessment. Identify opportunity areas and/or strengths?
        </Text>
        {isGroup && (
          <Text style={s.smallText}>
            *Group/Team Supervision — Skip this section
          </Text>
        )}
        <Text style={s.textBlock}>
          {isGroup ? "N/A — Group/Team Supervision" : (cf.caseReviewFindings ?? "")}
        </Text>

        {/* Section V(b) */}
        <Text style={s.sectionTitle}>
          V.(b) Case Review/Chart Reviews Findings: Medication review
        </Text>
        <Text style={s.smallText}>
          Verification of medication orders, checking for potential drug
          interactions, and ensuring that the medication administration is
          consistent with treatment plans.
        </Text>
        <Text style={s.textBlock}>{cf.medicationReview ?? ""}</Text>

        {/* Section VI */}
        <Text style={s.sectionTitle}>
          VI. Additional Context of Supervision to Note
        </Text>
        <Text style={s.smallText}>
          Feedback, strength-based affirmations, additional guidance provided on
          emergency procedures such as incident reporting, restraints, IVA, or
          other interventions. *Required for Peer Support Specialist.
        </Text>
        <Text style={s.textBlock}>{cf.additionalContext ?? ""}</Text>

        <View style={s.divider} />

        {/* Supervisee signature block */}
        <View style={s.sigBlock}>
          <Text style={s.sectionSubtitle}>Supervisee:</Text>
          <View style={s.sigRow}>
            <Text style={s.sigLabel}>Name and Credentials</Text>
            <Text style={s.sigValue}>
              {d.supervisee.name}
              {cf.superviseeCredentials ? `, ${cf.superviseeCredentials}` : ""}
            </Text>
          </View>
          <View style={s.sigRow}>
            <Text style={s.sigLabel}>Job Title</Text>
            <Text style={s.sigValue}>{cf.superviseeJobTitle ?? ""}</Text>
          </View>
          <View style={s.sigRow}>
            <Text style={s.sigLabel}>Signature</Text>
            <Text style={s.sigValue}>
              {superviseeSig
                ? `${superviseeSig.signerName} (e-signed via AuditHalo)`
                : ""}
            </Text>
          </View>
          <View style={s.sigRow}>
            <Text style={s.sigLabel}>Date</Text>
            <Text style={s.sigValue}>
              {superviseeSig
                ? superviseeSig.signedAt.replace("T", " ").slice(0, 19) + "Z"
                : ""}
            </Text>
          </View>
        </View>

        {/* Supervisor signature block */}
        <View style={s.sigBlock}>
          <Text style={s.sectionSubtitle}>
            Supervision completed by (clinical supervisor or designee):
          </Text>
          <View style={s.sigRow}>
            <Text style={s.sigLabel}>Name and Credentials</Text>
            <Text style={s.sigValue}>
              {supervisorSig?.signerName ?? ""}
              {d.session.supervisorCredentials
                ? `, ${d.session.supervisorCredentials.join(", ")}`
                : ""}
            </Text>
          </View>
          <View style={s.sigRow}>
            <Text style={s.sigLabel}>Signature</Text>
            <Text style={s.sigValue}>
              {supervisorSig
                ? `${supervisorSig.signerName} (e-signed via AuditHalo)`
                : ""}
            </Text>
          </View>
          <View style={s.sigRow}>
            <Text style={s.sigLabel}>Date</Text>
            <Text style={s.sigValue}>
              {supervisorSig
                ? supervisorSig.signedAt.replace("T", " ").slice(0, 19) + "Z"
                : ""}
            </Text>
          </View>
        </View>

        {/* AuditHalo audit trail footer */}
        <View style={s.footer}>
          <Text style={s.footerLabel}>
            AuditHalo Evidence Seal (SHA-256)
          </Text>
          <Text style={s.hash}>{documentHash}</Text>
          <Text style={[s.footerLabel, { marginTop: 6 }]}>Verify online</Text>
          <Text style={s.hash}>{verifyUrl}</Text>
          <Text style={s.fineprint}>
            This document was digitally generated and sealed by AuditHalo on{" "}
            {d.generatedAt.replace("T", " ").slice(0, 19)}Z. The hash above is
            computed over the canonical JSON of this evidence package. Any
            tampering produces a different hash, making the record independently
            verifiable at the URL above — no AuditHalo account required.
          </Text>
        </View>

        <View style={s.footerBrand}>
          <Text style={s.brandText}>Recovery Innovations</Text>
          <Text style={s.pageNumber}>
            Clinical Supervision Form — Page {cf.isInitialPlan ? "3" : "2"}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
