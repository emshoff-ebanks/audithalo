import { StyleSheet, Font } from "@react-pdf/renderer";

// Shared style sheet for lead-magnet PDFs. Keeps typography + spacing
// consistent across the two NC docs (audit checklist + log template) and
// any future state-specific magnets.

// Use the default Helvetica family — bundled with react-pdf, no font
// download or Font.register call needed. Keeping the toolchain dep-free
// for PDF generation means the dynamic route can render fast (~150ms
// typical) without cold-start font loading.

export const colors = {
  ink: "#08111F", // foreground
  muted: "#5f6470", // foreground/60
  rule: "#d4d4d8", // border
  brandNavy: "#071A3D",
  brandGold: "#B98D2A",
  success: "#147A4A",
  risk: "#9F2F2F",
  card: "#FAFAF7",
};

export const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.5,
    color: colors.ink,
  },

  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    paddingBottom: 12,
    marginBottom: 20,
  },
  wordmark: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    color: colors.brandNavy,
    letterSpacing: 0.4,
  },
  headerMeta: {
    fontSize: 8,
    color: colors.muted,
    textAlign: "right",
  },

  // Document title + kicker
  kicker: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: colors.brandGold,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: colors.ink,
    marginBottom: 6,
    lineHeight: 1.15,
  },
  intro: {
    fontSize: 10,
    color: colors.ink,
    marginBottom: 20,
    lineHeight: 1.5,
  },

  // Section headers
  sectionH2: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: colors.brandNavy,
    marginTop: 18,
    marginBottom: 8,
  },
  sectionH3: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.ink,
    marginTop: 12,
    marginBottom: 4,
  },

  // Checklist
  checklistRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  checkbox: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: colors.ink,
    marginRight: 8,
    marginTop: 1,
  },
  checklistText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.4,
  },

  // Bullet (no checkbox)
  bulletRow: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 2,
  },
  bullet: {
    width: 8,
    fontSize: 10,
    color: colors.muted,
  },

  // Citation chip
  citation: {
    fontSize: 8,
    fontFamily: "Helvetica-Oblique",
    color: colors.muted,
    marginTop: 2,
  },

  // Callout box
  callout: {
    backgroundColor: colors.card,
    borderLeftWidth: 3,
    borderLeftColor: colors.brandGold,
    padding: 10,
    marginVertical: 10,
  },
  calloutTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: colors.brandNavy,
    marginBottom: 3,
    letterSpacing: 0.4,
  },
  calloutBody: {
    fontSize: 9.5,
    color: colors.ink,
    lineHeight: 1.5,
  },

  // Table — used by the log template
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: colors.brandNavy,
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: colors.brandNavy,
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: colors.rule,
    paddingVertical: 8,
    minHeight: 22,
  },
  tableCell: {
    fontSize: 9,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 28,
    left: 56,
    right: 56,
    fontSize: 8,
    color: colors.muted,
    textAlign: "center",
    borderTopWidth: 0.5,
    borderTopColor: colors.rule,
    paddingTop: 8,
  },
});

// Suppress unused-export lint warning — re-exporting Font for callers
// that want to register custom faces later.
export { Font };
