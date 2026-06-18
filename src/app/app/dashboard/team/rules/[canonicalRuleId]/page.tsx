import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, AlertTriangle, ExternalLink } from "lucide-react";
import { auth } from "@/auth";
import { canManageOrg, getCurrentMembership } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getRule, parseRuleId } from "@/lib/rules/loader";
import {
  buildReauthorPrefill,
  isCompatibleReauthorSource,
} from "@/lib/rules/reauthor";
import { OverrideEditorForm } from "./override-editor-form";

export const metadata = { title: "Customize state rule — AuditHalo" };
export const dynamic = "force-dynamic";

export default async function CustomizeCanonicalRulePage({
  params,
  searchParams,
}: {
  params: Promise<{ canonicalRuleId: string }>;
  searchParams: Promise<{ reauthor_from?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) redirect("/dashboard");
  if (!canManageOrg(membership.role)) redirect("/dashboard/team");

  const { canonicalRuleId } = await params;
  const { reauthor_from: reauthorFromId } = await searchParams;
  const parts = parseRuleId(canonicalRuleId);
  if (!parts) notFound();

  let canonical;
  try {
    canonical = getRule(parts.jurisdiction, parts.licenseCode, parts.version);
  } catch {
    notFound();
  }

  const existing = await db.query.orgRuleOverrides.findFirst({
    where: and(
      eq(schema.orgRuleOverrides.orgId, membership.orgId),
      eq(schema.orgRuleOverrides.canonicalRuleId, canonicalRuleId),
      eq(schema.orgRuleOverrides.isActive, true)
    ),
  });

  // Cycle 6 re-author flow: if no override exists yet on this canonical
  // and the caller passed reauthor_from=<v1 override id>, copy that v1
  // row's patches into the initial form. Drops silently if the source
  // row doesn't exist, doesn't belong to this org, or isn't a sibling
  // (jurisdiction, license) override — fail-safe to empty prefill.
  let reauthorSource: typeof existing | undefined;
  if (!existing && reauthorFromId) {
    const candidate = await db.query.orgRuleOverrides.findFirst({
      where: and(
        eq(schema.orgRuleOverrides.id, reauthorFromId),
        eq(schema.orgRuleOverrides.orgId, membership.orgId)
      ),
    });
    if (
      candidate &&
      isCompatibleReauthorSource(canonical, {
        canonicalRuleId: candidate.canonicalRuleId,
        jurisdiction: candidate.jurisdiction,
        licenseCode: candidate.licenseCode,
        label: candidate.label,
        structuredPatch: candidate.structuredPatch,
        checksPatch: candidate.checksPatch as Parameters<
          typeof isCompatibleReauthorSource
        >[1]["checksPatch"],
      })
    ) {
      reauthorSource = candidate;
    }
  }

  let initial: {
    label: string;
    structuredPatch: import("@/lib/db/schema").RuleStructuredPatch;
    severityChanges: Record<string, "info" | "warning" | "blocker">;
    removeChecks: string[];
    expectedUpdatedAt: string | null;
  };
  if (existing) {
    initial = {
      label: existing.label,
      structuredPatch: existing.structuredPatch,
      severityChanges:
        (existing.checksPatch as {
          replace_severity?: Record<string, "info" | "warning" | "blocker">;
        })?.replace_severity ?? {},
      removeChecks:
        (existing.checksPatch as { remove?: string[] })?.remove ?? [],
      expectedUpdatedAt: existing.updatedAt.toISOString(),
    };
  } else if (reauthorSource) {
    const prefill = buildReauthorPrefill(canonical, {
      canonicalRuleId: reauthorSource.canonicalRuleId,
      jurisdiction: reauthorSource.jurisdiction,
      licenseCode: reauthorSource.licenseCode,
      label: reauthorSource.label,
      structuredPatch: reauthorSource.structuredPatch,
      checksPatch: reauthorSource.checksPatch as Parameters<
        typeof buildReauthorPrefill
      >[1]["checksPatch"],
    });
    initial = {
      label: prefill.label,
      structuredPatch: prefill.structuredPatch,
      severityChanges: prefill.severityChanges,
      removeChecks: prefill.removeChecks,
      expectedUpdatedAt: null,
    };
  } else {
    initial = {
      label: `${canonical.jurisdiction} ${canonical.license_code} v${canonical.version} — internal override`,
      structuredPatch: {},
      severityChanges: {},
      removeChecks: [],
      expectedUpdatedAt: null,
    };
  }

  const isReauthor = !existing && !!reauthorSource;
  const reauthorSourceLabel = reauthorSource
    ? `${reauthorSource.jurisdiction} ${reauthorSource.licenseCode} v${reauthorSource.version}`
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-12 space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/dashboard/team/rules">
          <ArrowLeft />
          Back to rules
        </Link>
      </Button>

      <div>
        <Badge variant="outline" className="mb-3">
          {existing
            ? "Edit override"
            : isReauthor
              ? "Re-author override"
              : "New override"}
        </Badge>
        <h1 className="font-display text-3xl font-semibold text-foreground">
          {canonical.jurisdiction} {canonical.license_code} v{canonical.version}
        </h1>
        <p className="mt-2 text-foreground/70">
          {canonical.license_name} &middot; {canonical.issuing_board}
        </p>
        <a
          href={canonical.citation.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs text-secondary hover:underline"
        >
          {canonical.citation.admincode}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {isReauthor && reauthorSourceLabel && (
        <div className="rounded-sm border border-secondary/40 bg-secondary/5 p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-secondary" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">
              Re-authoring your override from {reauthorSourceLabel}.
            </p>
            <p className="text-foreground/70">
              The form is pre-filled with your values from {reauthorSourceLabel}.
              Review them against the new canonical column on the left &mdash;
              the board may have changed numbers since you last saved. Saving
              creates a fresh active override on this version; the prior
              version&apos;s row stays in the dashboard&apos;s history.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-sm border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/5 p-4 flex gap-3">
        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-[color:var(--color-warning)]" />
        <div className="space-y-2 text-sm">
          <p className="font-medium text-foreground">
            This override applies to every supervisee in your org on{" "}
            {canonical.jurisdiction} {canonical.license_code} v{canonical.version}.
          </p>
          <p className="text-foreground/70">
            Severity is downgrade-only &mdash; you can soften a blocker to a
            warning but not the reverse. Removing a check stops AuditHalo from
            evaluating it for this rule. Compare against the canonical column
            on the left before saving.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: canonical, read-only */}
        <Card>
          <CardContent className="p-6 space-y-5">
            <div>
              <p className="label-overline mb-2">Canonical (board-verified)</p>
              <p className="text-sm text-foreground/70">{canonical.summary}</p>
            </div>

            <div>
              <p className="label-overline mb-2">Requirements</p>
              <dl className="text-sm grid grid-cols-2 gap-y-1.5">
                <StructuredCanonicalRow
                  label="Total practice hours"
                  value={canonical.structured.total_practice_hours_required}
                />
                <StructuredCanonicalRow
                  label="Total supervision hours"
                  value={canonical.structured.total_supervision_hours_required}
                />
                {canonical.structured.min_duration_months !== undefined && (
                  <StructuredCanonicalRow
                    label="Min duration (months)"
                    value={canonical.structured.min_duration_months}
                  />
                )}
                {canonical.structured.max_duration_months !== undefined && (
                  <StructuredCanonicalRow
                    label="Max duration (months)"
                    value={canonical.structured.max_duration_months}
                  />
                )}
                {canonical.structured.group_max_attendees !== undefined && (
                  <StructuredCanonicalRow
                    label="Group max attendees"
                    value={canonical.structured.group_max_attendees}
                  />
                )}
                {canonical.structured.min_individual_supervision_fraction !==
                  undefined && (
                  <StructuredCanonicalRow
                    label="Min individual supervision fraction"
                    value={
                      canonical.structured.min_individual_supervision_fraction
                    }
                  />
                )}
              </dl>
            </div>

            <div>
              <p className="label-overline mb-2">
                Checks ({canonical.checks.length})
              </p>
              <ul className="text-sm space-y-2.5">
                {canonical.checks.map((c) => (
                  <li
                    key={c.id}
                    className="border border-border rounded-sm p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-mono text-xs text-foreground/80">
                        {c.id}
                      </p>
                      <Badge
                        variant={
                          c.severity === "blocker"
                            ? "risk"
                            : c.severity === "warning"
                              ? "outline-warn"
                              : "outline"
                        }
                        className="text-[10px] uppercase"
                      >
                        {c.severity}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-foreground/70">
                      {c.description}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Right: editable override form */}
        <Card>
          <CardContent className="p-6">
            <p className="label-overline mb-4">Your override</p>
            <OverrideEditorForm
              canonicalRuleId={canonicalRuleId}
              canonical={{
                structured: canonical.structured,
                checks: canonical.checks.map((c) => ({
                  id: c.id,
                  severity: c.severity,
                  description: c.description,
                })),
              }}
              initial={initial}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StructuredCanonicalRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <>
      <dt className="text-foreground/60">{label}</dt>
      <dd className="text-right font-mono text-foreground">{value}</dd>
    </>
  );
}
