import Link from "next/link";
import { AlertTriangle, CreditCard } from "lucide-react";
import { computeBillingBanner } from "@/lib/billing/banner";
import type { schema } from "@/lib/db";

type Org = typeof schema.organizations.$inferSelect;

export function BillingBanner({ org }: { org: Org | null | undefined }) {
  if (!org) return null;
  const banner = computeBillingBanner(org);
  if (!banner) return null;

  const isPastDue =
    banner.kind === "past_due" || banner.kind === "past_due_expired";
  const Icon = isPastDue ? CreditCard : AlertTriangle;

  return (
    <div
      role="status"
      className={`flex flex-wrap items-start justify-between gap-3 p-4 rounded-sm border-l-[3px] ${
        isPastDue
          ? "border-l-[color:var(--color-risk)] bg-[color:var(--color-risk)]/5"
          : "border-l-[color:var(--color-warning)] bg-[color:var(--color-warning)]/5"
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={`h-5 w-5 mt-0.5 shrink-0 ${
            isPastDue
              ? "text-[color:var(--color-risk)]"
              : "text-[color:var(--color-warning)]"
          }`}
          strokeWidth={1.75}
        />
        <p className="text-sm text-foreground/90 leading-relaxed">
          {banner.message}
        </p>
      </div>
      <Link
        href={banner.ctaHref}
        className={`shrink-0 text-sm font-medium hover:underline ${
          isPastDue
            ? "text-[color:var(--color-risk)]"
            : "text-[color:var(--color-warning)]"
        }`}
      >
        {banner.ctaLabel} →
      </Link>
    </div>
  );
}
