import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { ClinicalFormData } from "@/lib/clinical-form/types";
import {
  CORE_SKILLS,
  COMPETENCIES,
  SUPERVISION_TYPE_LABELS,
  FREQUENCY_PLAN_LABELS,
} from "@/lib/clinical-form/constants";
import path from "node:path";

const RI_PURPLE = "#5B2A5E";
const RI_GOLD = "#B5924C";
const RI_LIGHT_PURPLE = "#7B4A7E";

const logoPath = path.join(process.cwd(), "public/logos/recovery-innovations.png");

const s = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 80,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
  },
  // Title banner matching RI's purple gradient header
  titleBanner: {
    backgroundColor: RI_PURPLE,
    padding: 12,
    marginBottom: 14,
    borderRadius: 2,
  },
  titleText: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: 1,
  },
  // Two-column header table (Employee/Job Position, Credentials/Date)
  headerRow: {
    flexDirection: "row",
    borderWidth: 0.75,
    borderColor: "#333333",
  },
  headerCell: {
    flex: 1,
    padding: 5,
    borderRightWidth: 0.75,
    borderRightColor: "#333333",
  },
  headerCellLast: {
    flex: 1,
    padding: 5,
  },
  cellLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#555555",
    marginBottom: 1,
  },
  cellValue: {
    fontSize: 9,
    color: "#1a1a1a",
  },
  // Section headers with underline (matching RI's purple underlined sections)
  sectionHead: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: RI_PURPLE,
    textDecoration: "underline",
    marginTop: 12,
    marginBottom: 5,
  },
  subsectionHead: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: RI_PURPLE,
    marginTop: 8,
    marginBottom: 4,
  },
  label: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#555555",
  },
  text: {
    fontSize: 9,
    lineHeight: 1.5,
    marginBottom: 3,
  },
  italic: {
    fontSize: 8,
    fontFamily: "Helvetica-Oblique",
    color: "#666666",
    lineHeight: 1.4,
    marginBottom: 4,
  },
  bold: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.5,
  },
  // Checkbox styles
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 2.5,
  },
  checkboxEmpty: {
    width: 9,
    height: 9,
    borderWidth: 0.75,
    borderColor: "#333333",
    marginRight: 5,
    marginTop: 1,
  },
  checkboxFilled: {
    width: 9,
    height: 9,
    borderWidth: 0.75,
    borderColor: RI_PURPLE,
    backgroundColor: RI_PURPLE,
    marginRight: 5,
    marginTop: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  checkmark: {
    fontSize: 6,
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
  },
  checkLabel: {
    flex: 1,
    fontSize: 8,
    lineHeight: 1.35,
  },
  // Competency grid (4 columns matching RI form)
  compGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  compItem: {
    width: "25%",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2.5,
    paddingRight: 3,
  },
  compCheck: {
    width: 7,
    height: 7,
    borderWidth: 0.5,
    borderColor: "#333333",
    marginRight: 3,
  },
  compCheckFilled: {
    width: 7,
    height: 7,
    borderWidth: 0.5,
    borderColor: RI_PURPLE,
    backgroundColor: RI_PURPLE,
    marginRight: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  compCheckmark: {
    fontSize: 4.5,
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
  },
  compLabel: {
    fontSize: 6.5,
    flex: 1,
  },
  // Action steps
  stepRow: {
    flexDirection: "row",
    marginBottom: 4,
    alignItems: "center",
  },
  stepLabel: {
    width: 38,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#555555",
  },
  stepLine: {
    flex: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: "#999999",
    fontSize: 9,
    paddingBottom: 2,
    minHeight: 14,
  },
  stepDate: {
    width: 85,
    marginLeft: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#999999",
    fontSize: 8,
    fontFamily: "Helvetica-Oblique",
    textAlign: "right",
    paddingBottom: 2,
    minHeight: 14,
  },
  // Free text areas (underlined blank space)
  textArea: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#999999",
    minHeight: 32,
    fontSize: 9,
    lineHeight: 1.5,
    paddingBottom: 3,
    marginBottom: 4,
  },
  // Inline row for checkboxes on same line
  inlineCheck: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  inlineItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  miniCheck: {
    width: 8,
    height: 8,
    borderWidth: 0.5,
    borderColor: "#333333",
  },
  miniCheckFilled: {
    width: 8,
    height: 8,
    borderWidth: 0.5,
    borderColor: RI_PURPLE,
    backgroundColor: RI_PURPLE,
    justifyContent: "center",
    alignItems: "center",
  },
  miniCheckmark: {
    fontSize: 5,
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
  },
  miniLabel: {
    fontSize: 8,
  },
  // Signature blocks
  sigBlock: {
    marginTop: 10,
    paddingTop: 6,
  },
  sigRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  sigLabel: {
    width: 140,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#555555",
  },
  sigLine: {
    flex: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: "#333333",
    fontSize: 9,
    paddingBottom: 2,
    minHeight: 16,
  },
  // Footer matching RI's form footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#cccccc",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  footerLogo: {
    width: 50,
    height: 35,
  },
  footerMeta: {
    fontSize: 6.5,
    color: "#666666",
    lineHeight: 1.4,
  },
  footerMetaBold: {
    fontSize: 6.5,
    color: RI_PURPLE,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.4,
  },
  footerRight: {
    textAlign: "right",
  },
  footerTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },
  footerPage: {
    fontSize: 8,
    color: "#666666",
    marginTop: 2,
  },
  // Divider
  divider: {
    height: 0.75,
    backgroundColor: "#cccccc",
    marginVertical: 8,
  },
  // AuditHalo seal
  sealBlock: {
    marginTop: 12,
    padding: 8,
    borderWidth: 0.5,
    borderColor: "#E3E0D4",
    borderRadius: 2,
    backgroundColor: "#F9F8F5",
  },
  sealLabel: {
    fontSize: 7,
    letterSpacing: 1,
    color: "#5F6470",
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  sealHash: {
    fontFamily: "Courier-Bold",
    fontSize: 7,
    color: "#08111F",
    lineHeight: 1.3,
  },
  sealFine: {
    fontSize: 6.5,
    color: "#5F6470",
    marginTop: 4,
    lineHeight: 1.3,
  },
  // Boilerplate
  boilerplate: {
    fontSize: 7.5,
    color: "#444444",
    lineHeight: 1.4,
    marginTop: 4,
    marginBottom: 4,
  },
  disclaimer: {
    fontSize: 7,
    fontFamily: "Helvetica-Oblique",
    color: "#666666",
    lineHeight: 1.4,
    marginTop: 4,
    marginBottom: 6,
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

function InlineCheckbox({ checked, label }: { checked: boolean; label: string }) {
  return (
    <View style={s.inlineItem}>
      <View style={checked ? s.miniCheckFilled : s.miniCheck}>
        {checked && <Text style={s.miniCheckmark}>X</Text>}
      </View>
      <Text style={s.miniLabel}>{label}</Text>
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

function RiFooter({ pageNum, totalPages }: { pageNum: number; totalPages: number }) {
  return (
    <View style={s.footer} fixed>
      <View style={s.footerLeft}>
        <Image src={logoPath} style={s.footerLogo} />
        <View>
          <Text style={s.footerMetaBold}>Original to Human Resources</Text>
          <Text style={s.footerMetaBold}>Photo Copy to Employee</Text>
          <Text style={s.footerMetaBold}>Photo Copy to Manager</Text>
        </View>
        <View>
          <Text style={s.footerMeta}>Created On: 06/25/2010</Text>
          <Text style={s.footerMeta}>Updated 11/11/2024</Text>
        </View>
      </View>
      <View style={s.footerRight}>
        <Text style={s.footerTitle}>Clinical Supervision</Text>
        <Text style={s.footerTitle}>Form</Text>
        <Text style={s.footerPage}>Page {pageNum} of {totalPages}</Text>
      </View>
    </View>
  );
}

export function RiClinicalSupervisionPdf({
  document: d,
  documentHash,
  packageId,
}: Props) {
  const cf = d.clinicalFormData ?? {};
  const coreChecked = new Set(cf.coreSkillsChecked ?? []);
  const compChecked = new Set(cf.competenciesChecked ?? []);
  const supervisorSig = d.signatures.find((sig) => sig.signerRole === "supervisor");
  const superviseeSig = d.signatures.find((sig) => sig.signerRole === "supervisee");

  const startTime = formatTime12h(d.session.date);
  const endDate = new Date(
    new Date(d.session.date).getTime() + d.session.durationHours * 3600000
  );
  const endTime = formatTime12h(endDate.toISOString());
  const sessionDate = d.session.date.slice(0, 10);
  const supType = d.session.supervisionType
    ? SUPERVISION_TYPE_LABELS[d.session.supervisionType] ?? d.session.supervisionType
    : "";
  const isGroup =
    d.session.sessionType === "group" || d.session.sessionType === "triadic";
  const totalPages = cf.isInitialPlan ? 4 : 3;

  const verifyUrl = `https://audithalo.com/verify/${packageId}?hash=${documentHash}`;

  return (
    <Document
      title={`Clinical Supervision Form - ${d.supervisee.name} - ${sessionDate}`}
      author="Recovery Innovations / AuditHalo"
    >
      {/* PAGE 1: Initial Supervision Plan (conditional) */}
      {cf.isInitialPlan && (
        <Page size="LETTER" style={s.page}>
          <View style={s.titleBanner}>
            <Text style={s.titleText}>Clinical Supervision Form</Text>
          </View>

          <View style={s.headerRow}>
            <View style={s.headerCell}>
              <Text style={s.cellLabel}>Employee</Text>
              <Text style={s.cellValue}>{d.supervisee.name}</Text>
            </View>
            <View style={s.headerCellLast}>
              <Text style={s.cellLabel}>Job Position</Text>
              <Text style={s.cellValue}>{cf.superviseeJobTitle ?? ""}</Text>
            </View>
          </View>
          <View style={[s.headerRow, { borderTopWidth: 0 }]}>
            <View style={s.headerCell}>
              <Text style={s.cellLabel}>Credentials</Text>
              <Text style={s.cellValue}>{cf.superviseeCredentials ?? ""}</Text>
            </View>
            <View style={s.headerCellLast}>
              <Text style={s.cellLabel}>Date</Text>
              <Text style={s.cellValue}>{sessionDate}</Text>
            </View>
          </View>

          <Text style={[s.sectionHead, { marginTop: 14 }]}>
            Initial Supervision Plan:{"  "}
            <Text style={s.bold}>{cf.isInitialPlan ? "Yes" : "No"}</Text>
          </Text>

          <Text style={s.text}>
            Date: {sessionDate}{"    "}Start Time: {startTime}{"    "}End Time: {endTime}{"    "}Length: {formatDuration(d.session.durationHours)}
          </Text>

          <Text style={s.italic}>
            *Skip this section if not initial Supervision session (within 30 days of hire date prior to guest care OR first supervision session with a new supervisor)
          </Text>

          <Text style={[s.text, { marginTop: 6 }]}>
            <Text style={s.bold}>Agreed Plan of Supervision:{"  "}</Text>
          </Text>
          <View style={s.inlineCheck}>
            <InlineCheckbox checked={d.session.sessionType === "individual"} label="Individual" />
            <InlineCheckbox checked={isGroup} label="Team/Group" />
            <InlineCheckbox checked={false} label="Combination of both" />
          </View>

          <Text style={s.text}>
            <Text style={s.bold}>Frequency Plan of Supervision:{"  "}</Text>
          </Text>
          <View style={s.inlineCheck}>
            {Object.entries(FREQUENCY_PLAN_LABELS).map(([k, v]) => (
              <InlineCheckbox key={k} checked={cf.frequencyPlan === k} label={v} />
            ))}
          </View>

          <Text style={s.text}>
            <Text style={s.bold}>Clinical Supervision &amp; Oversight Policy Reviewed:{"  "}</Text>
          </Text>
          <View style={s.inlineCheck}>
            <InlineCheckbox checked={cf.policyReviewed === true} label="Yes" />
            <InlineCheckbox checked={cf.policyReviewed === false} label="No" />
          </View>

          <Text style={s.text}>
            <Text style={s.bold}>Type of Supervision:{"  "}</Text>
          </Text>
          <View style={s.inlineCheck}>
            <InlineCheckbox checked={supType === "Peer"} label="Peer" />
            <InlineCheckbox checked={supType === "Nursing"} label="Nursing" />
            <InlineCheckbox checked={supType === "Clinician"} label="Clinician" />
            <InlineCheckbox checked={supType === "Administrative"} label="Administrative" />
            <InlineCheckbox checked={supType === "Advance Practice Provider"} label="Advance Practice Provider" />
            <InlineCheckbox checked={supType === "Other"} label={`Other: ${cf.supervisionTypeOther ?? ""}`} />
          </View>

          <Text style={s.boilerplate}>
            Purpose, Goals and Objectives of Supervision is to fulfil requirements for training supervision and to promote development of supervisee&apos;s professional identity and competence as agreed upon. The content of supervision will focus on the acquisition of knowledge, conceptualization, and skills within the defined scope of practice. The context will ensure understanding of ethics, codes, rules, regulations, standards, guidelines including but not limited to confidentiality, privacy and applicable legislation as outlined within Recovery Innovations Policies and Procedures.
          </Text>
          <Text style={s.boilerplate}>
            Recovery Innovations will ensure that clinical supervision will provide all staff including licensed clinical staff, non-licensed clinical staff, trainees, peer support specialists, providers and nursing staff support to help maintain and develop their individual competencies with a focus on quality and safety of care.
          </Text>

          <Text style={s.disclaimer}>
            *Disclaimer: Recovery Innovations does not provide clinical supervision that counts toward state-approved hours required to obtain independent or full licensure. For clarity, Recovery Innovations defines &quot;Clinical Supervision&quot; as: Clinical Oversight of guest care to ensure high-quality services and adherence to best practices; A mode of professional development focused on enhancing the knowledge, skills, and competencies of team members.
          </Text>

          <Text style={s.text}>
            <Text style={s.bold}>Supervision Plan/Contract Agreed Upon:{"  "}</Text>
          </Text>
          <View style={s.inlineCheck}>
            <InlineCheckbox checked={cf.contractAgreedUpon === true} label="Yes" />
            <InlineCheckbox checked={cf.contractAgreedUpon !== true} label="No" />
          </View>

          <RiFooter pageNum={1} totalPages={totalPages} />
        </Page>
      )}

      {/* PAGE 2: Ongoing Supervision */}
      <Page size="LETTER" style={s.page}>
        <View style={s.titleBanner}>
          <Text style={s.titleText}>Clinical Supervision Form</Text>
        </View>

        <Text style={[s.sectionHead, { marginTop: 2, textDecoration: "underline" }]}>
          On-going Supervision
        </Text>

        <Text style={s.text}>
          Date: {sessionDate}{"    "}Start Time: {startTime}{"    "}End Time: {endTime}{"    "}Length: {formatDuration(d.session.durationHours)}
        </Text>

        <Text style={s.text}>
          <Text style={s.bold}>Type of Coaching:{"  "}</Text>
        </Text>
        <View style={s.inlineCheck}>
          <InlineCheckbox checked={!isGroup} label="Individual" />
          <InlineCheckbox checked={isGroup} label="Team/Group" />
        </View>

        <Text style={s.text}>
          <Text style={s.bold}>Type of Supervision:{"  "}</Text>
        </Text>
        <View style={s.inlineCheck}>
          <InlineCheckbox checked={supType === "Peer"} label="Peer" />
          <InlineCheckbox checked={supType === "Nursing"} label="Nursing" />
          <InlineCheckbox checked={supType === "Clinician"} label="Clinician" />
          <InlineCheckbox checked={supType === "Administrative"} label="Administrative" />
          <InlineCheckbox checked={supType === "Advance Practice Provider"} label="Advance Practice Provider" />
          <InlineCheckbox checked={supType === "Other"} label={`Other: ${cf.supervisionTypeOther ?? ""}`} />
        </View>

        <Text style={[s.sectionHead, { marginTop: 8 }]}>
          Follow up from previous supervision session(s):
        </Text>
        <Text style={s.textArea}>{cf.followUpFromPrevious ?? ""}</Text>

        <Text style={s.sectionHead}>
          I. Select one or more key areas/skills/goals discussed:
        </Text>
        <Text style={s.italic}>* Required core skills</Text>

        {CORE_SKILLS.filter((sk) => sk.key !== "other").map((sk) => (
          <View key={sk.key} style={s.checkRow}>
            <View style={coreChecked.has(sk.key) ? s.checkboxFilled : s.checkboxEmpty}>
              {coreChecked.has(sk.key) && <Text style={s.checkmark}>X</Text>}
            </View>
            <Text style={s.checkLabel}>{sk.label}</Text>
          </View>
        ))}
        <View style={s.checkRow}>
          <View style={coreChecked.has("other") ? s.checkboxFilled : s.checkboxEmpty}>
            {coreChecked.has("other") && <Text style={s.checkmark}>X</Text>}
          </View>
          <Text style={s.checkLabel}>Other: {cf.otherCoreSkill ?? ""}</Text>
        </View>

        <View style={[s.compGrid, { marginTop: 6 }]}>
          {COMPETENCIES.map((c) => (
            <View key={c.key} style={s.compItem}>
              <View style={compChecked.has(c.key) ? s.compCheckFilled : s.compCheck}>
                {compChecked.has(c.key) && <Text style={s.compCheckmark}>X</Text>}
              </View>
              <Text style={s.compLabel}>
                {c.label}{c.required ? "*" : ""}
              </Text>
            </View>
          ))}
        </View>

        {/* Section II or III */}
        {isGroup ? (
          <>
            <Text style={[s.sectionHead, { color: RI_PURPLE }]}>
              III. Group Supervision: What key areas/skills were discussed in today&apos;s supervision?
            </Text>
            <Text style={s.textArea}>{cf.groupDiscussionTopics ?? ""}</Text>
          </>
        ) : (
          <>
            <Text style={[s.sectionHead, { color: RI_PURPLE }]}>
              II. Individual Supervision: What action steps do you plan on taking to reach identified goal(s)?
            </Text>
            {[0, 1].map((i) => {
              const step = (cf.actionSteps ?? [])[i] ?? { step: "", targetDate: "" };
              return (
                <View key={i} style={s.stepRow}>
                  <Text style={s.stepLabel}>Step {i + 1}:</Text>
                  <Text style={s.stepLine}>{step.step}</Text>
                  <Text style={s.stepDate}>{step.targetDate ? `Target Date: ${step.targetDate}` : "Target Date"}</Text>
                </View>
              );
            })}
          </>
        )}

        <RiFooter pageNum={cf.isInitialPlan ? 2 : 1} totalPages={totalPages} />
      </Page>

      {/* PAGE 3: Sections IV, V, VI + Signatures */}
      <Page size="LETTER" style={s.page}>
        <View style={s.titleBanner}>
          <Text style={s.titleText}>Clinical Supervision Form</Text>
        </View>

        <Text style={s.sectionHead}>IV.</Text>
        <Text style={s.text}>
          Do you need any training, continuing education/CEUs (document CEU hours) or support to accomplish this goal? If so what?
        </Text>
        <Text style={s.textArea}>{cf.trainingNeeds ?? ""}</Text>

        <Text style={s.text}>
          How will your team and the people we work with benefit from achieving this goal?
        </Text>
        <Text style={s.textArea}>{cf.teamBenefit ?? ""}</Text>

        <Text style={[s.sectionHead, { color: RI_PURPLE }]}>
          V. (a) Case Review/Chart Reviews Findings (documentation, assessment, diagnosis, final disposition and risk assessment):
        </Text>
        <Text style={s.italic}>
          Identify opportunity areas and/or strengths?
          {isGroup ? " *Group/Team Supervision Skip this section" : ""}
        </Text>
        <Text style={s.textArea}>
          {isGroup ? "N/A - Group/Team Supervision" : (cf.caseReviewFindings ?? "")}
        </Text>

        <Text style={[s.sectionHead, { color: RI_PURPLE }]}>
          V.(b) Case Review/Chart Reviews Findings: Verification of medication orders, checking for potential drug interactions, and ensuring that the medication administration is consistent with treatment plans:
        </Text>
        <Text style={s.italic}>
          *If supervisee does not administer/dispense medication(s) and is not applicable please enter &quot;N/A&quot;
        </Text>
        <Text style={s.textArea}>{cf.medicationReview ?? ""}</Text>

        <Text style={[s.sectionHead, { color: RI_PURPLE }]}>
          VI. Additional Context of Supervision to Note: Feedback, Strength-based affirmations, additional guidance provided on emergency procedures such as incident reporting, restraints, IVA, or other interventions.
        </Text>
        <Text style={s.italic}>
          *Required for Peer Support Specialist; also utilize this space to document additional context of supervision if needed
        </Text>
        <Text style={s.textArea}>{cf.additionalContext ?? ""}</Text>

        <View style={s.divider} />

        {/* Supervisee signature */}
        <View style={s.sigBlock}>
          <Text style={s.subsectionHead}>Supervisee:</Text>
          <View style={s.sigRow}>
            <Text style={s.sigLabel}>Name and Credentials:</Text>
            <Text style={s.sigLine}>
              {d.supervisee.name}{cf.superviseeCredentials ? `, ${cf.superviseeCredentials}` : ""}
            </Text>
            <Text style={[s.sigLabel, { width: 70, marginLeft: 10 }]}>Job Title</Text>
            <Text style={[s.sigLine, { maxWidth: 120 }]}>{cf.superviseeJobTitle ?? ""}</Text>
          </View>
          <View style={s.sigRow}>
            <Text style={s.sigLabel}>Employee&apos;s Signature</Text>
            <Text style={s.sigLine}>
              {superviseeSig ? `${superviseeSig.signerName} (e-signed via AuditHalo)` : ""}
            </Text>
            <Text style={[s.sigLabel, { width: 40, marginLeft: 10 }]}>Date</Text>
            <Text style={[s.sigLine, { maxWidth: 120 }]}>
              {superviseeSig ? superviseeSig.signedAt.slice(0, 10) : ""}
            </Text>
          </View>
        </View>

        {/* Supervisor signature */}
        <View style={s.sigBlock}>
          <Text style={s.subsectionHead}>
            Supervision completed by (clinical supervisor or designee):
          </Text>
          <View style={s.sigRow}>
            <Text style={s.sigLabel}>Name and Credentials:</Text>
            <Text style={s.sigLine}>
              {supervisorSig?.signerName ?? ""}{d.session.supervisorCredentials ? `, ${d.session.supervisorCredentials.join(", ")}` : ""}
            </Text>
            <Text style={[s.sigLabel, { width: 70, marginLeft: 10 }]}>Job Title</Text>
            <Text style={[s.sigLine, { maxWidth: 120 }]}>{""}</Text>
          </View>
          <View style={s.sigRow}>
            <Text style={s.sigLabel}>Signature</Text>
            <Text style={s.sigLine}>
              {supervisorSig ? `${supervisorSig.signerName} (e-signed via AuditHalo)` : ""}
            </Text>
            <Text style={[s.sigLabel, { width: 40, marginLeft: 10 }]}>Date</Text>
            <Text style={[s.sigLine, { maxWidth: 120 }]}>
              {supervisorSig ? supervisorSig.signedAt.slice(0, 10) : ""}
            </Text>
          </View>
        </View>

        {/* AuditHalo evidence seal */}
        <View style={s.sealBlock}>
          <Text style={s.sealLabel}>AuditHalo Evidence Seal (SHA-256)</Text>
          <Text style={s.sealHash}>{documentHash}</Text>
          <Text style={[s.sealLabel, { marginTop: 4 }]}>Verify</Text>
          <Text style={s.sealHash}>{verifyUrl}</Text>
          <Text style={s.sealFine}>
            Digitally sealed by AuditHalo on {d.generatedAt.replace("T", " ").slice(0, 19)}Z. The hash is computed over the canonical JSON of this evidence package. Any tampering produces a different hash. Verify at the URL above — no AuditHalo account required.
          </Text>
        </View>

        <RiFooter pageNum={cf.isInitialPlan ? 3 : 2} totalPages={totalPages} />
      </Page>
    </Document>
  );
}
