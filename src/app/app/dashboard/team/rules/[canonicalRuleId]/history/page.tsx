import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft, CircleDot, Circle, ExternalLink } from "lucide-react";
import { auth } from "@/auth";
import { canManageOrg, getCurrentMembership } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getRule, parseRuleId } from "@/lib/rules/loader";
import { summarizeOverrideDiff } from "@/lib/rules/diff";

export const metadata = { title: "Override history — AuditHalo" };
export const dynamic = "force-dynamic";

/**
 * Cycle 5 — full audit trail for a canonical rule's overrides in this org.
 * Shows every row (active + inactive) keyed by the canonical rule id, with
 * a diff summary and the audit_log_entries timeline (who saved/deactivated).
 */
export default async function OverrideHistoryPage({
  params,
}: {
  params: Promise<{ canonicalRuleId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) redirect("/dashboard");
  if (!canManageOrg(membership.role)) redirect("/dashboard/team");

  const { canonicalRuleId } = await params;
  const parts = parseRuleId(canonicalRuleId);
  if (!parts) notFound();

  let canonical;
  try {
    canonical = getRule(parts.jurisdiction, parts.licenseCode, parts.version);
  } catch {
    notFound();
  }

  // All rows for this (org, canonical) — active or not. Most recent first.
  const rows = await db
    .select()
    .from(schema.orgRuleOverrides)
    .where(
      and(
        eq(schema.orgRuleOverrides.orgId, membership.orgId),
        eq(schema.orgRuleOverrides.canonicalRuleId, canonicalRuleId)
      )
    )
    .orderBy(desc(schema.orgRuleOverrides.updatedAt));

  // Audit log trail for each row (and the canonical rule id itself, in case
  // the resource is referenced loosely). We surface upserted + deactivated.
  const rowIds = rows.map((r) => r.id);
  const auditTrail = rowIds.length
    ? await db
        .select()
        .from(schema.auditLogEntries)
        .where(
          and(
            eq(schema.auditLogEntries.orgId, membership.orgId),
            eq(schema.auditLogEntries.resourceType, "org_rule_override")
          )
        )
        .orderBy(desc(schema.auditLogEntries.createdAt))
    : [];
  const trailById = new Map<string, typeof auditTrail>();
  for (const row of rows) {
    trailById.set(
      row.id,
      auditTrail.filter((a) => a.resourceId === row.id)
    );
  }

  // Resolve actor names for the audit panel.
  const actorIds = Array.from(
    new Set(
      [
        ...auditTrail
          .map((a) => a.actorUserId)
          .filter((v): v is string => !!v),
        ...rows.flatMap((r) =>
          [r.createdBy, r.lastEditedBy].filter((v): v is string => !!v)
        ),
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
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-12 space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href={`/dashboard/team/rules/${canonicalRuleId}`}>
          <ArrowLeft />
          Back to override editor
        </Link>
      </Button>

      <div>
        <Badge variant="outline" className="mb-3">
          Override history
        </Badge>
        <h1 className="font-display text-3xl font-semibold text-foreground">
          {canonical.jurisdiction} {canonical.license_code} v{canonical.version}
        </h1>
        <p className="mt-2 text-foreground/70">
          Every override your org has saved on this canonical rule. Inactive
          rows are kept for audit and can&apos;t be edited or reactivated &mdash;
          create a new override via the editor instead.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-foreground/70">
              No overrides have ever been saved for this rule.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const diff = summarizeOverrideDiff(canonical, {
              structuredPatch: row.structuredPatch,
              checksPatch: row.checksPatch as Parameters<
                typeof summarizeOverrideDiff
              >[1]["checksPatch"],
            });
            const trail = trailById.get(row.id) ?? [];
            return (
              <li key={row.id}>
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {row.isActive ? (
                            <Badge variant="outline-warn" className="text-[10px]">
                              <CircleDot className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              <Circle className="h-3 w-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                          <p className="font-medium text-foreground">
                            {row.label}
                          </p>
                        </div>
                        <p className="text-xs text-foreground/60">
                          created {row.createdAt.toISOString().slice(0, 10)} by{" "}
                          {actorById.get(row.createdBy) ?? "unknown"}
                          {row.lastEditedBy && row.lastEditedBy !== row.createdBy ? (
                            <>
                              {" · "}
                              last edited{" "}
                              {row.updatedAt.toISOString().slice(0, 10)} by{" "}
                              {actorById.get(row.lastEditedBy) ?? "unknown"}
                            </>
                          ) : null}
                        </p>
                      </div>
                      {row.isActive && (
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/dashboard/team/rules/${canonicalRuleId}`}>
                            Open editor
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      )}
                    </div>

                    {diff.isNoOp ? (
                      <p className="text-xs text-foreground/60 italic">
                        No effective changes from canonical.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <p className="label-overline">Diff from canonical</p>
                        <DiffBlock diff={diff} />
                      </div>
                    )}

                    {trail.length > 0 && (
                      <div className="space-y-1">
                        <p className="label-overline">Audit trail</p>
                        <ul className="space-y-1 text-xs">
                          {trail.map((a) => (
                            <li
                              key={a.id}
                              className="flex flex-wrap items-baseline gap-2"
                            >
                              <span className="font-mono text-foreground/80">
                                {a.action}
                              </span>
                              <span className="text-foreground/60">
                                {a.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                              </span>
                              <span className="text-foreground/60">
                                by{" "}
                                {a.actorUserId
                                  ? actorById.get(a.actorUserId) ?? "unknown"
                                  : "system"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function DiffBlock({
  diff,
}: {
  diff: ReturnType<typeof summarizeOverrideDiff>;
}) {
  return (
    <div className="space-y-2">
      {diff.structured.length > 0 && (
        <ul className="space-y-1 text-xs">
          {diff.structured.map((d) => (
            <li
              key={d.field}
              className="flex flex-wrap items-baseline gap-2 border-l-2 pl-2 border-[color:var(--color-warning)]/40"
            >
              <span className="text-foreground/80">{d.field}</span>
              <span className="font-mono text-foreground/60">
                {d.canonicalValue ?? "—"} →{" "}
                <span className="text-foreground">{d.overrideValue}</span>
              </span>
              <Badge
                variant={d.direction === "tighter" ? "outline-warn" : "outline"}
                className="text-[9px] uppercase"
              >
                {d.direction}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {diff.checks.length > 0 && (
        <ul className="space-y-1 text-xs">
          {diff.checks.map((d) => (
            <li
              key={`${d.kind}-${d.checkId}`}
              className="flex flex-wrap items-baseline gap-2 border-l-2 pl-2 border-[color:var(--color-risk)]/40"
            >
              <span className="font-mono text-foreground/80">{d.checkId}</span>
              {d.kind === "severity_changed" ? (
                <span className="text-foreground/60">
                  severity {d.canonicalSeverity} →{" "}
                  <span className="text-foreground">{d.overrideSeverity}</span>
                </span>
              ) : (
                <Badge variant="risk" className="text-[9px] uppercase">
                  Removed
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
