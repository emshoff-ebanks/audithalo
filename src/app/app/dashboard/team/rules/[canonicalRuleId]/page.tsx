import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Customize state rule — AuditHalo" };

/**
 * Cycle 3 placeholder. The override editor lives here once cycle 3 lands.
 * For now this just acknowledges the route + canonical rule id so the
 * dashboard's "Customize" buttons don't 404.
 */
export default async function CustomizeCanonicalRulePage({
  params,
}: {
  params: Promise<{ canonicalRuleId: string }>;
}) {
  const { canonicalRuleId } = await params;
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/dashboard/team/rules">
          <ArrowLeft />
          Back to rules
        </Link>
      </Button>
      <Badge variant="outline">Coming soon</Badge>
      <h1 className="font-display text-3xl font-semibold text-foreground">
        Override editor &mdash; {canonicalRuleId}
      </h1>
      <Card>
        <CardContent className="p-6 text-sm text-foreground/70 space-y-2">
          <p>
            The two-column override editor (canonical on the left, your
            override on the right) ships in Cycle 3.
          </p>
          <p>
            Until then, the canonical rule is in effect for everyone in
            your org assigned to it. No data is at risk.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
