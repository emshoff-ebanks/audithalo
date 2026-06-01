import { ShieldCheck, FileSignature, Sparkles, BarChart3 } from "lucide-react";

const features = [
  {
    icon: ShieldCheck,
    title: "Multi-state rules engine",
    body: "Encode supervision requirements per state and license type. Ships with NC LCMHCA out of the box.",
  },
  {
    icon: Sparkles,
    title: "AI-written session notes",
    body: "Drop in a Teams transcript. Get a structured supervision note with PHI scrubbed.",
  },
  {
    icon: FileSignature,
    title: "Tamper-evident e-signatures",
    body: "Supervisor and supervisee sign with intent. Evidence packages are hashed and immutable.",
  },
  {
    icon: BarChart3,
    title: "Role-based dashboards",
    body: "Supervisees see progress. Supervisors manage rosters. HR sees compliance heatmaps. Executives see risk.",
  },
];

export default function MarketingHome() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 py-24 lg:py-32">
        <p className="label-overline mb-6">Clinical supervision compliance</p>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground max-w-3xl leading-[1.05]">
          The audit-ready command center for licensed counselors and their supervisors.
        </h1>
        <p className="mt-6 text-lg text-foreground/70 max-w-2xl leading-relaxed">
          Track supervision hours against state board rules, generate AI session notes
          from Teams transcripts, capture intent-confirmed e-signatures, and publish
          tamper-evident evidence packages — without a single spreadsheet.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <a
            href="https://app.audithalo.com/register"
            className="inline-flex items-center justify-center h-11 px-6 rounded-sm bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors"
          >
            Start free trial
          </a>
          <a
            href="#features"
            className="inline-flex items-center justify-center h-11 px-6 rounded-sm border border-border text-foreground font-medium hover:bg-muted/40 transition-colors"
          >
            See how it works
          </a>
        </div>
      </section>

      <section id="features" className="border-t border-border bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <p className="label-overline mb-4">What you get</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground max-w-2xl">
            Built for the four roles that touch every supervision hour.
          </h2>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-px bg-border">
            {features.map((f) => (
              <div key={f.title} className="bg-white p-8">
                <f.icon className="h-6 w-6 text-secondary" strokeWidth={1.75} />
                <h3 className="mt-5 font-display text-xl font-semibold text-foreground">
                  {f.title}
                </h3>
                <p className="mt-2 text-foreground/70 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-1">
              <p className="label-overline mb-4">North Carolina LCMHCA</p>
              <h2 className="font-display text-3xl font-semibold text-foreground">
                Compliance, encoded.
              </h2>
            </div>
            <div className="lg:col-span-2">
              <div className="border border-border bg-white p-8 rounded-sm">
                <p className="text-sm font-mono text-foreground/60 mb-3">
                  State rule (ratio shape)
                </p>
                <p className="text-foreground text-lg leading-relaxed">
                  1 hour of individual <em>or</em> 2 hours of group supervision per{" "}
                  <span className="font-semibold">40 practice hours</span>. At least{" "}
                  <span className="font-semibold">75%</span> must be individual.
                  Group sessions max 12 attendees.
                </p>
                <p className="mt-6 text-sm text-foreground/60">
                  Required signers: supervisor + supervisee. Required artifacts:
                  attendance, session metadata. Optional: transcript.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
