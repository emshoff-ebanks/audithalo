import Link from "next/link";
import { Check, Fingerprint, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SealMedallion } from "@/components/marketing/seal-medallion";
import { VerifySearch } from "@/components/marketing/verify-search";

export const metadata = {
  title: "Verify an evidence package — AuditHalo",
  description:
    "Independently verify an AuditHalo supervision evidence package. No login, no account — paste the package ID or verify URL and confirm the record is genuine and unaltered.",
};

const steps = [
  {
    icon: Fingerprint,
    title: "Paste the ID or link",
    body: "From the sealed PDF or the email you received — the whole verify URL works, hash and all.",
  },
  {
    icon: Check,
    title: "We recompute the hash",
    body: "AuditHalo re-derives the SHA-256 of the canonical record and checks it against the hash sealed at signing.",
  },
  {
    icon: ShieldCheck,
    title: "See the authoritative record",
    body: "If the seal is intact you get the signed supervision record itself — the source of truth for any audit.",
  },
];

export default function VerifyLandingPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 lg:py-24">
      <div className="flex items-start gap-5">
        <div className="hidden sm:block">
          <SealMedallion size={64} />
        </div>
        <div>
          <Badge variant="outline" className="mb-4">
            Public verification
          </Badge>
          <h1 className="font-display text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight text-[color:var(--ink-900)]">
            Verify an evidence package.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-[color:var(--ink-600)]">
            No login, no account. Paste an AuditHalo evidence package ID — or the
            verify URL printed on a sealed PDF — and confirm the supervision
            record is genuine and hasn&apos;t been altered since it was sealed.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <VerifySearch autoFocus />
      </div>

      <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <div
            key={s.title}
            className="rounded-[14px] border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] p-5"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[color:var(--paper-100)] text-[color:var(--ink-900)]">
              <s.icon className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="mt-3 font-mono text-xs text-[color:var(--ink-500)]">
              0{i + 1}
            </div>
            <h2 className="mt-1 font-display text-lg font-semibold text-[color:var(--ink-900)]">
              {s.title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--ink-600)]">
              {s.body}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-8 text-sm text-[color:var(--ink-600)]">
        Want the details of how sealing and verification work?{" "}
        <Link
          href="/docs/evidence/verifying-a-package"
          className="text-[color:var(--ink-900)] underline decoration-[color:var(--halo-yellow)] decoration-2 underline-offset-2"
        >
          Read the verification guide
        </Link>
        .
      </p>
    </div>
  );
}
