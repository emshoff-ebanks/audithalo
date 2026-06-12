import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "New custom rule — AuditHalo" };

/**
 * Cycle 4 placeholder. The five-step custom-state builder lands here.
 */
export default function NewCustomRulePage() {
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
        Build a custom state rule
      </h1>
      <Card>
        <CardContent className="p-6 text-sm text-foreground/70 space-y-2">
          <p>
            The five-step builder &mdash; jurisdiction, license, structured
            hours, check templates, citation &mdash; ships in Cycle 4.
          </p>
          <p>
            If you need to onboard a state we don&apos;t cover yet today,
            email{" "}
            <a
              href="mailto:info@audithalo.com"
              className="underline hover:no-underline"
            >
              info@audithalo.com
            </a>{" "}
            with the admincode and a board source URL. We&apos;ll fast-track
            a canonical YAML.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
