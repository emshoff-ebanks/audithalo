import { Shield, Lock, Database, FileCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export const metadata = {
  title: "Data Security — AuditHalo",
  description:
    "How AuditHalo protects your supervision records. Tamper-evident audit packages, encrypted storage, and an honest view of our security posture.",
};

const measures = [
  {
    icon: Lock,
    title: "Authentication",
    body: "Passwords are bcrypt-hashed. Sessions are stored in HttpOnly cookies scoped to app.audithalo.com — never sent to the marketing site or any third party.",
  },
  {
    icon: Database,
    title: "Data storage",
    body: "All data is hosted on Neon Postgres (US-East-1) and served via Vercel (US-East). All traffic uses TLS 1.3 in transit. Data at rest is encrypted by the underlying cloud providers.",
  },
  {
    icon: FileCheck,
    title: "Tamper-evident audit packages",
    body: "Every evidence package is SHA-256 hashed at the moment of sealing. The hash is stored with the package. If a record is altered after signing, the hash won't match — independently verifiable.",
  },
  {
    icon: Shield,
    title: "Immutable audit log",
    body: "Every signature, rule-version change, and evidence-package creation is logged immutably per organization with 7-year retention — matching most state board record requirements.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
        <Badge variant="outline" className="mb-4">
          Data security
        </Badge>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-foreground max-w-3xl">
          Your supervision records are protected. Here's how.
        </h1>
        <p className="mt-6 text-lg text-foreground/70 max-w-2xl">
          AuditHalo handles compliance documentation. The bar for how we protect
          that data is high — and we'll tell you exactly what's in place, not
          marketing-speak.
        </p>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <Badge variant="outline" className="mb-4">
            What's in place
          </Badge>
          <h2 className="font-display text-3xl font-semibold text-foreground max-w-2xl">
            Built to hold up in an audit — including a security one.
          </h2>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            {measures.map((item) => (
              <Card key={item.title}>
                <CardContent className="p-8">
                  <item.icon className="h-6 w-6 text-secondary" strokeWidth={1.75} />
                  <h3 className="mt-5 font-display text-xl font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-foreground/70 leading-relaxed">{item.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="font-display text-3xl font-semibold text-foreground">
            Questions about how we handle your data?
          </h2>
          <p className="mt-4 text-foreground/70">
            We'll answer anything. No sales pitch.
          </p>
          <Button asChild size="lg" className="mt-8" variant="outline">
            <Link href="/contact">
              Contact us <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
