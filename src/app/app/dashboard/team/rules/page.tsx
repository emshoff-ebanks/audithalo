import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, inArray, desc } from "drizzle-orm";
import { ArrowLeft, ArrowRight, AlertTriangle, Plus } from "lucide-react";
import { auth } from "@/auth";
import { canManageOrg, getCurrentMembership } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getRule } from "@/lib/rules/loader";
import { isCustomRuleId } from "@/lib/rules/overrides";
import { summarizeOverrideDiff } from "@/lib/rules/diff";
import { OverrideRowActions } from "./_override-row-actions";
import { History } from "lucide-react";

export const metadata = { title: "State rules — AuditHalo" };
export const dynamic = "force-dynamic";

/**
 * Rules-admin dashboard (Cycle 2 — view only).
 *
 * Three sections per docs/strategy/09-rules-admin.md §UI surface:
 *   1. Canonical rules in use by this org's active supervisees
 *   2. Active org overrides (rows in org_rule_overrides with
 *      canonical_rule_id NOT NULL)
 *   3. Custom org-authored rules (canonical_rule_id IS NULL)
 *
 * The "Customize" and "Create custom rule" buttons land on placeholder
 * pages until Cycle 3 + Cycle 4. The page itself is HR-Admin-only.
 */
export default async function RulesAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) redirect("/dashboard");
  if (!canManageOrg(membership.role)) redirect("/dashboard/team");

  // 1. Canonical rules currently in use by the org.
  //    Derived from the distinct assignment.ruleId set across all active
  //    supervisees. Excludes custom rule ids (those flow into section 3).
  const activeAssignments = await db
    .select({ ruleId: schema.superviseeRuleAssignments.ruleId })
    .from(schema.superviseeRuleAssignments)
    .where(eq(schema.superviseeRuleAssignments.orgId, membership.orgId));
  const canonicalRuleIdsInUse = Array.from(
    new Set(
      activeAssignments
        .map((r) => r.ruleId)
        .filter((id) => !isCustomRuleId(id))
    )
  );

  const canonicalRulesInUse = canonicalRuleIdsInUse
    .map((id) => {
      const [, jur, lic, vRaw] = id.match(/^(.+?)-(.+?)-v(\d+)$/) ?? [];
      if (!jur || !lic || !vRaw) return null;
      try {
        const rule = getRule(jur.toUpperCase(), lic.toUpperCase(), parseInt(vRaw, 10));
        return { id, rule };
      } catch {
        return null;
      }
    })
    .filter((r): r is { id: string; rule: NonNullable<ReturnType<typeof getRule>> } => r !== null)
    .sort((a, b) => a.rule.jurisdiction.localeCompare(b.rule.jurisdiction));

  // 2 + 3. Active override + custom rows.
  const allActiveOverrides = await db
    .select()
    .from(schema.orgRuleOverrides)
    .where(
      and(
        eq(schema.orgRuleOverrides.orgId, membership.orgId),
        eq(schema.orgRuleOverrides.isActive, true)
      )
    )
    .orderBy(desc(schema.orgRuleOverrides.updatedAt));

  const overrideRows = allActiveOverrides.filter((r) => r.canonicalRuleId !== null);
  const customRows = allActiveOverrides.filter((r) => r.canonicalRuleId === null);

  // For each override row, pull the last-edited-by user's display name.
  const editorIds = Array.from(
    new Set([
      ...allActiveOverrides.map((r) => r.lastEditedBy ?? r.createdBy),
    ])
  );
  const editors =
    editorIds.length > 0
      ? await db
          .select({
            id: schema.users.id,
            name: schema.users.name,
            email: schema.users.email,
          })
          .from(schema.users)
          .where(inArray(schema.users.id, editorIds))
      : [];
  const editorById = new Map(editors.map((e) => [e.id, e.name ?? e.email]));

  // Supervisee counts per custom rule for section 3.
  const superviseeCountByRuleId = new Map<string, number>();
  for (const a of activeAssignments) {
    if (!isCustomRuleId(a.ruleId)) continue;
    superviseeCountByRuleId.set(
      a.ruleId,
      (superviseeCountByRuleId.get(a.ruleId) ?? 0) + 1
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-12 space-y-8">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/dashboard/team">
          <ArrowLeft />
          Back to team
        </Link>
      </Button>

      <div>
        <Badge variant="outline" className="mb-3">
          State rules
        </Badge>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-foreground">
          Customize your state rules
        </h1>
        <p className="mt-3 text-foreground/70 max-w-2xl">
          Tighten a board rule for internal policy, or define a custom rule
          for a state we haven&apos;t shipped canonical guidance for yet.
          Canonical rules are board-verified and edited only by AuditHalo
          staff via versioned YAML.
        </p>
      </div>

      <div className="rounded-sm border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/5 p-4 flex gap-3">
        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-[color:var(--color-warning)]" />
        <div className="space-y-2 text-sm">
          <p className="font-medium text-foreground">
            Customizing a state rule changes how AuditHalo evaluates your
            supervisees&apos; progress &mdash; for your org only.
          </p>
          <p className="text-foreground/70">
            If your custom values disagree with the actual board requirement,
            AuditHalo will not catch you. Every canonical rule shown below has
            a citation URL you can click through to verify against the live
            board source.
          </p>
        </div>
      </div>

      {/* Section 1: Canonical rules in use */}
      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Canonical rules in use ({canonicalRulesInUse.length})
        </h2>
        {canonicalRulesInUse.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-foreground/70">
                No supervisees have a state rule assigned yet.{" "}
                <Link
                  href="/dashboard/roster"
                  className="text-secondary font-medium hover:underline"
                >
                  Open the roster
                </Link>{" "}
                to assign one.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {canonicalRulesInUse.map(({ id, rule }) => {
              const hasOverride = overrideRows.some(
                (o) => o.canonicalRuleId === id
              );
              return (
                <li key={id}>
                  <Card>
                    <CardContent className="p-4 flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">
                            {rule.jurisdiction} {rule.license_code} v{rule.version}
                          </p>
                          {hasOverride && (
                            <Badge variant="outline-warn" className="text-[10px]">
                              Override active
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-foreground/60">
                          {rule.license_name} &middot;{" "}
                          <a
                            href={rule.citation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:no-underline"
                          >
                            {rule.citation.admincode}
                          </a>
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/team/rules/${id}`}>
                          {hasOverride ? "Edit override" : "Customize"}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Section 2: Active overrides */}
      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Active overrides ({overrideRows.length})
        </h2>
        {overrideRows.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-foreground/70">
                No active overrides. Use &quot;Customize&quot; above to
                create one.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {overrideRows.map((row) => {
              // The override row points at a canonical rule id; if we can
              // resolve the canonical, render an inline diff slot for the
              // row's actions component.
              const parts = row.canonicalRuleId?.match(/^(.+?)-(.+?)-v(\d+)$/);
              let diffSlot: React.ReactNode = (
                <p className="text-foreground/60 italic">
                  Canonical rule not found.
                </p>
              );
              if (parts && row.canonicalRuleId) {
                try {
                  const canonical = getRule(
                    parts[1].toUpperCase(),
                    parts[2].toUpperCase(),
                    parseInt(parts[3], 10)
                  );
                  const diff = summarizeOverrideDiff(canonical, {
                    structuredPatch: row.structuredPatch,
                    checksPatch: row.checksPatch as Parameters<
                      typeof summarizeOverrideDiff
                    >[1]["checksPatch"],
                  });
                  diffSlot = diff.isNoOp ? (
                    <p className="text-foreground/60 italic">
                      No effective changes from canonical.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {diff.structured.map((d) => (
                        <p key={d.field} className="flex flex-wrap gap-2">
                          <span className="text-foreground/80">{d.field}</span>
                          <span className="font-mono text-foreground/60">
                            {d.canonicalValue ?? "—"} →{" "}
                            <span className="text-foreground">
                              {d.overrideValue}
                            </span>
                          </span>
                          <Badge
                            variant={
                              d.direction === "tighter"
                                ? "outline-warn"
                                : "outline"
                            }
                            className="text-[9px] uppercase"
                          >
                            {d.direction}
                          </Badge>
                        </p>
                      ))}
                      {diff.checks.map((d) => (
                        <p
                          key={`${d.kind}-${d.checkId}`}
                          className="flex flex-wrap gap-2"
                        >
                          <span className="font-mono text-foreground/80">
                            {d.checkId}
                          </span>
                          {d.kind === "severity_changed" ? (
                            <span className="text-foreground/60">
                              severity {d.canonicalSeverity} →{" "}
                              <span className="text-foreground">
                                {d.overrideSeverity}
                              </span>
                            </span>
                          ) : (
                            <Badge variant="risk" className="text-[9px] uppercase">
                              Removed
                            </Badge>
                          )}
                        </p>
                      ))}
                    </div>
                  );
                } catch {
                  // canonical rule disappeared (renamed?) — leave the not-found
                  // slot in place
                }
              }
              return (
                <li key={row.id}>
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="font-medium text-foreground">
                            {row.label}
                          </p>
                          <p className="text-xs text-foreground/60 font-mono">
                            on {row.canonicalRuleId} &middot; last edited by{" "}
                            {editorById.get(
                              row.lastEditedBy ?? row.createdBy
                            ) ?? "an HR Admin"}{" "}
                            on {row.updatedAt.toISOString().slice(0, 10)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <Button asChild variant="ghost" size="sm">
                            <Link
                              href={`/dashboard/team/rules/${row.canonicalRuleId}/history`}
                            >
                              <History className="h-3.5 w-3.5" />
                              History
                            </Link>
                          </Button>
                          <Button asChild variant="outline" size="sm">
                            <Link
                              href={`/dashboard/team/rules/${row.canonicalRuleId}`}
                            >
                              Open editor
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                      <OverrideRowActions
                        overrideId={row.id}
                        diffSlot={diffSlot}
                      />
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Section 3: Custom rules */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            Custom state rules ({customRows.length})
          </h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/team/rules/new">
              <Plus className="h-3.5 w-3.5" />
              Create custom rule
            </Link>
          </Button>
        </div>
        {customRows.length === 0 ? (
          <Card>
            <CardContent className="p-6 space-y-2">
              <p className="text-sm text-foreground/70">
                No custom rules yet. Build one for a state we haven&apos;t
                shipped canonical YAML for. You supply the board citation
                and AuditHalo runs the same evaluator against it.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {customRows.map((row) => {
              const customId =
                `org:${membership.orgId}:custom:${row.jurisdiction.toLowerCase()}-${row.licenseCode.toLowerCase()}-v${row.version}`;
              const count = superviseeCountByRuleId.get(customId) ?? 0;
              return (
                <li key={row.id}>
                  <Card>
                    <CardContent className="p-4 flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">{row.label}</p>
                          <Badge variant="outline" className="text-[10px]">
                            Org-created
                          </Badge>
                        </div>
                        <p className="text-xs text-foreground/60">
                          {row.jurisdiction} {row.licenseCode} v{row.version}
                          {" · "}
                          {count} {count === 1 ? "supervisee" : "supervisees"} assigned
                          {" · "}
                          created by{" "}
                          {editorById.get(row.createdBy) ?? "an HR Admin"}
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/team/rules/custom/${row.id}`}>
                          Open editor
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
