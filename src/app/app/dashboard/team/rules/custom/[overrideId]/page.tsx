import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Edit custom rule — AuditHalo" };

/**
 * Cycle 4 placeholder. Edits an existing custom rule row.
 */
export default async function EditCustomRulePage({
  params,
}: {
  params: Promise<{ overrideId: string }>;
}) {
  const { overrideId } = await params;
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
        Edit custom rule
      </h1>
      <Card>
        <CardContent className="p-6 text-sm text-foreground/70 space-y-2">
          <p>
            The custom-rule editor lands in Cycle 4. Row id:{" "}
            <span className="font-mono text-xs">{overrideId}</span>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
