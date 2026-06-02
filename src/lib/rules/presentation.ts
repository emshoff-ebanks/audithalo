import type { RiskLevel, RuleSeverity } from "./types";

const SEVERITY_STYLES: Record<
  RuleSeverity,
  { badgeVariant: "risk" | "warning" | "default"; tone: "risk" | "warning" | "muted" }
> = {
  blocker: { badgeVariant: "risk", tone: "risk" },
  warning: { badgeVariant: "warning", tone: "warning" },
  info: { badgeVariant: "default", tone: "muted" },
};

const TONE_CLASSES: Record<"risk" | "warning" | "muted" | "success", {
  border: string;
  bg: string;
  text: string;
}> = {
  risk: {
    border: "border-[color:var(--color-risk)]/20",
    bg: "bg-[color:var(--color-risk)]/5",
    text: "text-[color:var(--color-risk)]",
  },
  warning: {
    border: "border-[color:var(--color-warning)]/20",
    bg: "bg-[color:var(--color-warning)]/5",
    text: "text-[color:var(--color-warning)]",
  },
  muted: {
    border: "border-border",
    bg: "bg-muted/40",
    text: "text-foreground/40",
  },
  success: {
    border: "border-[color:var(--color-success)]/20",
    bg: "bg-[color:var(--color-success)]/5",
    text: "text-[color:var(--color-success)]",
  },
};

export function severityStyles(severity: RuleSeverity) {
  return SEVERITY_STYLES[severity];
}

export function toneClasses(tone: "risk" | "warning" | "muted" | "success") {
  return TONE_CLASSES[tone];
}

export function riskBadgeVariant(
  level: RiskLevel | undefined
): "ok" | "outline-warn" | "critical" | "outline" {
  if (level === "green") return "ok";
  if (level === "yellow") return "outline-warn";
  if (level === "red") return "critical";
  return "outline";
}

export function riskBadgeLabel(level: RiskLevel | undefined): string {
  if (level === "green") return "On track";
  if (level === "yellow") return "Needs attention";
  if (level === "red") return "At risk";
  return "No rule";
}
