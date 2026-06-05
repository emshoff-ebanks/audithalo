import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Circle, AlertTriangle, AlertOctagon } from "lucide-react";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { canSupervise, getCurrentMembership, isManagerRole } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { riskBadgeVariant, riskBadgeLabel } from "@/lib/rules";
import { getOrgRosterWithCompliance } from "@/lib/db/roster-queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InviteForm } from "./invite-form";
import { PendingInviteActions } from "./pending-invite-actions";
import { FilterBar, parseRosterFilter } from "./_filter-bar";

export const metadata = {
  title: "Roster — AuditHalo",
};

type SearchParams = Promise<{ filter?: string; q?: string }>;

export default async function RosterPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Roster + invitations are supervisor-only.
  if (!isManagerRole(session.user.role)) {
    redirect(`/dashboard/roster/${session.user.id}`);
  }

  const viewerCanSupervise = canSupervise(session.user.role);

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p>No organization found. Contact support.</p>
      </div>
    );
  }

  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, membership.orgId),
  });

  // Fetch all supervisees with compliance data (3 batch queries)
  const allRosterRows = await getOrgRosterWithCompliance(membership.orgId);

  // Fetch pending invitations separately
  const pendingInvites = await db.query.invitations.findMany({
    where: eq(schema.invitations.orgId, membership.orgId),
  });

  const params = await searchParams;
  const filter = parseRosterFilter(params.filter);
  const searchQuery = (params.q ?? "").trim();
  const searchLower = searchQuery.toLowerCase();
  const rosterRows = allRosterRows.filter((r) => {
    const matchesSearch =
      searchLower === "" ||
      r.name.toLowerCase().includes(searchLower) ||
      r.email.toLowerCase().includes(searchLower);
    if (!matchesSearch) return false;
    if (filter === "all") return true;
    if (filter === "at-risk") {
      return (
        r.evaluation?.riskLevel === "red" ||
        r.evaluation?.riskLevel === "yellow"
      );
    }
    if (filter === "pending-signatures") return r.pendingSignatureCount > 0;
    if (filter === "on-track") return r.evaluation?.riskLevel === "green";
    return true;
  });

  const atRiskCount = allRosterRows.filter(
    (r) => r.evaluation?.riskLevel === "red" || r.evaluation?.riskLevel === "yellow"
  ).length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/dashboard">
          <ArrowLeft />
          Back to dashboard
        </Link>
      </Button>

      <Badge variant="outline" className="mb-3">
        {org?.name ?? "Roster"}
      </Badge>
      <h1 className="font-display text-4xl font-semibold text-foreground">
        Your roster
      </h1>
      <p className="mt-3 text-foreground/70 max-w-2xl">
        Every supervisee you invite gets a free AuditHalo account. They join your roster the
        moment they accept the invitation, and you'll see their hour progress here.
      </p>

      <FilterBar
        activeFilter={filter}
        filteredCount={rosterRows.length}
        totalCount={allRosterRows.length}
        searchQuery={searchQuery}
      />

      {atRiskCount > 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span className="font-semibold">
            {atRiskCount} supervisee{atRiskCount === 1 ? "" : "s"} at risk
          </span>
          <span className="text-destructive/70">
            — review their compliance status below.
          </span>
        </div>
      )}

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-accent">
                <tr className="text-left">
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Credential</th>
                  <th className="px-5 py-3 font-semibold">Practice hrs</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Pending sigs</th>
                </tr>
              </thead>
              <tbody>
                {rosterRows.map((row) => {
                  const pct = row.evaluation?.progress.practiceProgressPct ?? 0;
                  const practiced = row.evaluation?.totals.practiceHours ?? 0;

                  const rowClasses = (() => {
                    if (row.evaluation?.riskLevel === "red") {
                      return "border-l-[3px] border-l-[color:var(--color-risk-600)] bg-[color:var(--color-risk-50)]/30";
                    }
                    if (row.evaluation?.riskLevel === "yellow") {
                      return "border-l-[3px] border-l-[color:var(--color-warn-500)] bg-[color:var(--color-warn-50)]/30";
                    }
                    return "";
                  })();

                  return (
                    <tr key={row.userId} className={`border-t border-border hover:bg-accent/40 ${rowClasses}`}>
                      <td className="px-5 py-3 font-medium">
                        <Link
                          href={`/dashboard/roster/${row.userId}`}
                          className="hover:underline"
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-foreground/70">
                        {row.state && row.licenseType
                          ? `${row.state} · ${row.licenseType}`
                          : row.state ?? row.licenseType ?? (
                              <span className="italic text-foreground/40">—</span>
                            )}
                      </td>
                      <td className="px-5 py-3">
                        {row.evaluation !== null ? (
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[color:var(--color-gold)] transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs text-foreground/60">
                              {practiced}h
                            </span>
                          </div>
                        ) : (
                          <span className="text-foreground/40 italic text-xs">no rule</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {row.evaluation ? (
                          <Badge variant={riskBadgeVariant(row.evaluation.riskLevel)}>
                            {row.evaluation.riskLevel === "green" && <Circle className="h-2 w-2 fill-current" />}
                            {row.evaluation.riskLevel === "yellow" && <AlertTriangle className="h-3 w-3" />}
                            {row.evaluation.riskLevel === "red" && <AlertOctagon className="h-3 w-3" />}
                            {riskBadgeLabel(row.evaluation.riskLevel)}
                          </Badge>
                        ) : (
                          <span className="text-foreground/40 italic text-xs">No rule</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {row.pendingSignatureCount > 0 ? (
                          <Badge variant="warning">
                            {row.pendingSignatureCount}
                          </Badge>
                        ) : (
                          <span className="text-foreground/40">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {rosterRows.length === 0 &&
                  pendingInvites.filter((i) => !i.acceptedAt).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-foreground/50 text-sm">
                        No supervisees yet. Invite one using the form →
                      </td>
                    </tr>
                  )}
                {pendingInvites
                  .filter((i) => !i.acceptedAt)
                  .map((i) => (
                    <tr key={i.id} className="border-t border-border bg-[color:var(--color-evidence-bg)]/40">
                      <td className="px-5 py-3 font-medium">
                        {i.name ?? <span className="text-foreground/50 italic">unnamed</span>}
                      </td>
                      <td className="px-5 py-3 text-foreground/70 break-all">{i.email}</td>
                      <td className="px-5 py-3">
                        <span className="text-foreground/40 italic text-xs">—</span>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant="warning">Pending invite</Badge>
                      </td>
                      <td className="px-5 py-3">
                        {viewerCanSupervise ? (
                          <PendingInviteActions invitationId={i.id} email={i.email} />
                        ) : (
                          <span className="text-foreground/40">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="label-overline mb-3">Invite a supervisee</p>
            <InviteForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
