import Link from "next/link";
import { db, schema } from "@/lib/db";
import { loadAllRules } from "@/lib/rules";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Rule drift — Admin" };
export const dynamic = "force-dynamic";

function relTime(date: Date | null): string {
  if (!date) return "never";
  const ms = Date.now() - date.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

export default async function RuleDriftPage() {
  const snapshots = await db.select().from(schema.ruleSourceSnapshots);
  const byRuleId = new Map(snapshots.map((s) => [s.ruleId, s]));
  const rules = [...loadAllRules().values()].sort((a, b) =>
    `${a.jurisdiction}-${a.license_code}-v${a.version}`.localeCompare(
      `${b.jurisdiction}-${b.license_code}-v${b.version}`
    )
  );

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-foreground">
        Rule source drift
      </h1>
      <p className="mt-3 text-foreground/70 max-w-3xl">
        Weekly cron fetches each rule&apos;s citation URL, hashes the body,
        and flags any change. Status <strong>changed</strong> means the page
        moved or its content differs from what we last verified — read the
        page, decide if the rule needs a new version YAML, then update
        verification.last_verified_at + source_hash to clear the flag.
      </p>

      <Card className="mt-8">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-accent text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Rule</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Last checked</th>
                <th className="px-4 py-3 font-semibold">Last changed</th>
                <th className="px-4 py-3 font-semibold">Source</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => {
                const ruleId =
                  `${r.jurisdiction}-${r.license_code}-v${r.version}`.toLowerCase();
                const snap = byRuleId.get(ruleId);
                const status = snap?.status ?? "unseen";
                const badgeVariant =
                  status === "changed"
                    ? "warning"
                    : status === "error"
                      ? "risk"
                      : status === "ok"
                        ? "success"
                        : "outline";
                return (
                  <tr key={ruleId} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {r.jurisdiction} {r.license_code} v{r.version}
                      </p>
                      <p className="text-xs text-foreground/60 font-mono">
                        {ruleId}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={badgeVariant}>{status}</Badge>
                      {snap?.errorMessage && (
                        <p className="mt-1 text-xs text-[color:var(--color-risk)]">
                          {snap.errorMessage}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground/70">
                      {relTime(snap?.lastCheckedAt ?? null)}
                    </td>
                    <td className="px-4 py-3 text-foreground/70">
                      {relTime(snap?.lastChangedAt ?? null)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={r.citation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-secondary hover:underline text-xs"
                      >
                        Open ↗
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
