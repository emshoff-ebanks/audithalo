import { createHash } from "node:crypto";

/** Stable JSON.stringify — keys sorted recursively so the same input always hashes the same. */
export function canonicalize(value: unknown): unknown {
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

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Build and persist an evidence package for a fully-signed session_event.
 * Safe to call multiple times — if a package already exists for this session, do nothing.
 */
export async function generateEvidencePackage(sessionEventId: string): Promise<void> {
  const { eq } = await import("drizzle-orm");
  const { db, schema } = await import("@/lib/db");
  const { getRule } = await import("@/lib/rules");

  const existing = await db.query.evidencePackages.findFirst({
    where: eq(schema.evidencePackages.sessionEventId, sessionEventId),
  });
  if (existing) return;

  const event = await db.query.sessionEvents.findFirst({
    where: eq(schema.sessionEvents.id, sessionEventId),
  });
  if (!event || !event.signedAt) return;

  const assignment = await db.query.superviseeRuleAssignments.findFirst({
    where: eq(schema.superviseeRuleAssignments.superviseeId, event.superviseeId),
  });
  if (!assignment) return;

  // Resolve the rule from the registry
  const [, jur, lic, vRaw] =
    assignment.ruleId.match(/^(.+?)-(.+?)-v(\d+)$/) ?? [];
  if (!jur || !lic || !vRaw) return;
  let ruleSnapshot: Record<string, unknown>;
  try {
    const rule = getRule(jur.toUpperCase(), lic.toUpperCase(), parseInt(vRaw, 10));
    ruleSnapshot = {
      jurisdiction: rule.jurisdiction,
      licenseCode: rule.license_code,
      licenseName: rule.license_name,
      issuingBoard: rule.issuing_board,
      version: rule.version,
      citation: rule.citation,
      effectiveStart: rule.effective_start,
      verification: rule.verification,
    };
  } catch {
    return;
  }

  const supervisee = await db.query.users.findFirst({
    where: eq(schema.users.id, event.superviseeId),
  });
  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, event.orgId),
  });
  if (!supervisee || !org) return;

  const document = {
    schemaVersion: "v1",
    generatedAt: new Date().toISOString(),
    ruleId: assignment.ruleId,
    rule: ruleSnapshot,
    organization: { id: org.id, name: org.name },
    supervisee: {
      id: supervisee.id,
      name: supervisee.name,
      email: supervisee.email,
      state: supervisee.state ?? null,
      licenseType: supervisee.licenseType ?? null,
    },
    session: {
      id: event.id,
      date: event.date.toISOString(),
      durationHours: event.durationHours,
      kind: event.kind,
      sessionType: event.sessionType ?? null,
      supervisorCredentials: event.supervisorCredentials ?? null,
      groupAttendees: event.groupAttendees ?? null,
      signedAt: event.signedAt.toISOString(),
    },
    obligation: {
      startedAt: assignment.obligationStartedAt.toISOString(),
      supervisionContractFiledAt:
        assignment.supervisionContractFiledAt?.toISOString() ?? null,
    },
    signatures: event.signatures ?? [],
    aiNote: event.aiNote ?? null,
  };

  const canonical = canonicalJson(document);
  const hash = sha256Hex(canonical);

  await db.insert(schema.evidencePackages).values({
    sessionEventId: event.id,
    orgId: event.orgId,
    superviseeId: event.superviseeId,
    ruleId: assignment.ruleId,
    signatures: event.signatures ?? [],
    documentHash: hash,
    documentContent: document,
  });
}
