import Link from "next/link";
import { FileSignature, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Dashboard-level explainer that tells supervisors WHAT an evidence package is
 * the first time they see one referenced. Rendered above the summary cards
 * only when the org has at least one signed session, so it doesn't add noise
 * during onboarding.
 */
export function EvidenceExplainer() {
  return (
    <Card>
      <CardContent className="p-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3 min-w-0">
          <FileSignature className="h-6 w-6 shrink-0 text-[color:var(--color-gold)] mt-0.5" />
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold text-foreground">
              Evidence packages
            </h3>
            <p className="mt-1 text-sm text-foreground/70 leading-relaxed">
              When your supervisee finishes their hours, AuditHalo generates a
              sealed PDF — every signed session, every credential check, hashed
              and timestamped. Hand it to the board exactly as-is. They never
              call you back asking &quot;do you have proof of…&quot;.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="sm:shrink-0">
          <Link
            href="https://audithalo.com/evidence-packages"
            target="_blank"
            rel="noreferrer"
          >
            Learn more <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
