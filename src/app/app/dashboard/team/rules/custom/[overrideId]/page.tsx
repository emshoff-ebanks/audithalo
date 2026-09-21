import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft, AlertTriangle, ExternalLink } from "lucide-react";
import { auth } from "@/auth";
import { canManageOrg, getCurrentMembership } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { buildCustomRule } from "@/lib/rules/overrides";
import { CustomRuleActions } from "./_custom-rule-actions";

export const metadata = { title: "Custom rule — AuditHalo" };
export const dynamic = "force-dynamic";

/**
 * Cycle 5 — view a custom org-authored rule. Read-only summary of the
 * structured + checks block, plus a deactivate affordance. Editing a
 * custom rule is out of scope (the wizard creates v1; re-author flows
 * land in Cycle 6).
 */
export default async function CustomRuleDetailPage({
  params,
}: {
  params: Promise<{ overrideId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) redirect("/dashboard");
  if (!canManageOrg(membership.role)) redirect("/dashboard/team");

  const { overrideId } = await params;
  const row = await db.query.orgRuleOverrides.findFirst({
    where: and(
      eq(schema.orgRuleOverrides.id, overrideId),
      eq(schema.orgRuleOverrides.orgId, membership.orgId)
    ),
  });
  if (!row || row.canonicalRuleId !== null) notFound();

  // Build the in-memory Rule to surface structured + checks the same way
  // the override editor surfaces canonical rules.
  let rule;
  try {
    rule = buildCustomRule(membership.orgId, {
      canonicalRuleId: null,
      jurisdiction: row.jurisdiction,
      licenseCode: row.licenseCode,
      version: row.version,
      label: row.label,
      structuredPatch: row.structuredPatch,
      checksPatch: row.checksPatch,
      customMetadata: row.customMetadata,
    });
  } catch {
    notFound();
  }

  // Count active assignments using this custom rule id.
  const syntheticId =
    `org:${membership.orgId}:custom:${row.jurisdiction.toLowerCase()}-${row.licenseCode.toLowerCase()}-v${row.version}`;
  const assignmentCount = await db
    .select({ id: schema.superviseeRuleAssignments.id })
    .from(schema.superviseeRuleAssignments)
    .where(
      and(
        eq(schema.superviseeRuleAssignments.orgId, membership.orgId),
        eq(schema.superviseeRuleAssignments.ruleId, syntheticId)
      )
    );

  // Audit-log trail for this row.
  const trail = await db
    .select()
    .from(schema.auditLogEntries)
    .where(
      and(
        eq(schema.auditLogEntries.orgId, membership.orgId),
        eq(schema.auditLogEntries.resourceType, "org_rule_override"),
        eq(schema.auditLogEntries.resourceId, row.id)
      )
    )
    .orderBy(desc(schema.auditLogEntries.createdAt));

  const actorIds = Array.from(
    new Set(
      [
        ...trail.map((t) => t.actorUserId).filter((v): v is string => !!v),
        row.createdBy,
        ...(row.lastEditedBy ? [row.lastEditedBy] : []),
      ]
    )
  );
  const actors = actorIds.length
    ? await db.query.users.findMany({
        where: (u, { inArray }) => inArray(u.id, actorIds),
        columns: { id: true, name: true, email: true },
      })
    : [];
  const actorById = new Map(
    actors.map((a) => [a.id, a.name ?? a.email ?? "unknown"])
  );

  return (
    <div className="mx-auto max-w-4xl flex flex-col gap-6">
      <div>
        <Link
          href="/dashboard/team/rules"
          className="inline-flex items-center gap-1.5 text-sm text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to rules
        </Link>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="status-pill status-pending">Custom rule</span>
          {row.isActive ? (
            <span className="status-pill status-warn">Active</span>
          ) : (
            <span className="status-pill status-risk">Inactive</span>
          )}
        </div>
        <h1 className="shell-page-title">{row.label}</h1>
        <p className="shell-page-sub">
          {rule.license_name} &middot; {rule.issuing_board}
        </p>
        <p className="mt-1 text-xs text-[color:var(--text-muted)]">
          <span className="font-mono">{rule.jurisdiction} {rule.license_code} v{rule.version}</span>
          {" · "}
          {assignmentCount.length}{" "}
          {assignmentCount.length === 1 ? "supervisee" : "supervisees"} assigned
          {" · "}created by {actorById.get(row.createdBy) ?? "unknown"} on{" "}
          {row.createdAt.toISOString().slice(0, 10)}
        </p>
        <a
          href={rule.citation.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-mono text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:underline"
        >
          {rule.citation.admincode}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="panel panel-tight border-l-[3px] border-l-[color:var(--warn-500)] flex gap-3">
        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-[color:var(--warn-500)]" />
        <div className="space-y-1 text-sm">
          <p className="font-medium text-[color:var(--text-primary)]">
            This is an org-created custom rule, not board-verified.
          </p>
          <p className="text-[color:var(--text-secondary)]">
            If your values disagree with the actual board requirement,
            AuditHalo will not catch you. Email{" "}
            <a href="mailto:info@audithalo.com" className="underline hover:no-underline">
              info@audithalo.com
            </a>{" "}
            to fast-track a canonical YAML for this state.
          </p>
        </div>
      </div>

      <div className="panel space-y-5">
          <div>
            <p className="label-overline mb-2">Summary</p>
            <p className="text-sm text-[color:var(--text-secondary)]">{rule.summary}</p>
          </div>

          <div>
            <p className="label-overline mb-2">Requirements</p>
            <dl className="text-sm grid grid-cols-2 gap-y-1.5">
              <StructuredRow
                label="Total practice hours"
                value={rule.structured.total_practice_hours_required}
              />
              <StructuredRow
                label="Total supervision hours"
                value={rule.structured.total_supervision_hours_required}
              />
              {rule.structured.min_duration_months !== undefined && (
                <StructuredRow
                  label="Min duration (months)"
                  value={rule.structured.min_duration_months}
                />
              )}
              {rule.structured.max_duration_months !== undefined && (
                <StructuredRow
                  label="Max duration (months)"
                  value={rule.structured.max_duration_months}
                />
              )}
              {rule.structured.group_max_attendees !== undefined && (
                <StructuredRow
                  label="Group max attendees"
                  value={rule.structured.group_max_attendees}
                />
              )}
              {rule.structured.min_individual_supervision_fraction !==
                undefined && (
                <StructuredRow
                  label="Min individual supervision fraction"
                  value={rule.structured.min_individual_supervision_fraction}
                />
              )}
            </dl>
          </div>

          <div>
            <p className="label-overline mb-2">
              Checks ({rule.checks.length})
            </p>
            <ul className="text-sm space-y-2">
              {rule.checks.map((c) => (
                <li key={c.id} className="border border-[color:var(--border)] rounded-[8px] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-mono text-xs text-[color:var(--text-secondary)]">
                      {c.id}
                    </p>
                    <span
                      className={`status-pill ${
                        c.severity === "blocker"
                          ? "status-risk"
                          : c.severity === "warning"
                            ? "status-warn"
                            : "status-pending"
                      }`}
                    >
                      {c.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                    {c.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
      </div>

      {trail.length > 0 && (
        <div className="panel space-y-2">
          <p className="label-overline">Audit trail</p>
          <ul className="space-y-1 text-xs">
            {trail.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-[color:var(--text-secondary)]">{a.action}</span>
                <span className="text-[color:var(--text-muted)]">
                  {a.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </span>
                <span className="text-[color:var(--text-muted)]">
                  by{" "}
                  {a.actorUserId ? actorById.get(a.actorUserId) ?? "unknown" : "system"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {row.isActive && (
        <div className="panel space-y-2">
          <p className="label-overline">Deactivate</p>
          <p className="text-sm text-[color:var(--text-secondary)]">
            Marks the rule inactive and removes it from the assignment
            picker. The row stays in the audit trail. Refuses if any
            supervisee is still assigned this rule &mdash; reassign them
            first.
          </p>
          <CustomRuleActions
            overrideId={row.id}
            assignmentCount={assignmentCount.length}
          />
        </div>
      )}
    </div>
  );
}

function StructuredRow({ label, value }: { label: string; value: number }) {
  return (
    <>
      <dt className="text-[color:var(--text-muted)]">{label}</dt>
      <dd className="text-right font-mono text-[color:var(--text-primary)]">{value}</dd>
    </>
  );
}
