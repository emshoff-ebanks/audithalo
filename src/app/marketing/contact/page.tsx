import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Contact — AuditHalo",
  description:
    "Reach out about enterprise plans, BAA conversations, security questions, or state rule requests.",
};

const topics = [
  {
    label: "General",
    email: "hello@audithalo.com",
    description: "Product questions, onboarding, anything else.",
  },
  {
    label: "Enterprise & BAA",
    email: "hello@audithalo.com",
    subject: "Enterprise plan",
    description:
      "Multi-location practices, 20+ supervisees, signed BAA, SOC 2 access.",
  },
  {
    label: "Security",
    email: "hello@audithalo.com",
    subject: "Security question",
    description:
      "Security posture, data handling, compliance review — we'll answer anything.",
  },
  {
    label: "State rule request",
    email: "hello@audithalo.com",
    subject: "State rule request",
    description:
      "Your state isn't supported yet. Tell us — we'll prioritize the encoding.",
  },
];

export default function ContactPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
        <Badge variant="outline" className="mb-4">
          Contact
        </Badge>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-foreground max-w-3xl">
          We answer email. Really.
        </h1>
        <p className="mt-6 text-lg text-foreground/70 max-w-2xl">
          No ticket queue, no bot, no 72-hour SLA. Pick the right address below
          and someone from the team will respond — usually same day.
        </p>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-3xl px-6 py-16 lg:py-20 space-y-8">
          {topics.map((t) => {
            const href = t.subject
              ? `mailto:${t.email}?subject=${encodeURIComponent(t.subject)}`
              : `mailto:${t.email}`;
            return (
              <div
                key={t.label}
                className="flex flex-col sm:flex-row sm:items-start gap-4 border-b border-border pb-8 last:border-none last:pb-0"
              >
                <div className="sm:w-36 shrink-0">
                  <p className="label-overline">{t.label}</p>
                </div>
                <div>
                  <p className="text-foreground/70 text-sm leading-relaxed mb-3">
                    {t.description}
                  </p>
                  <a
                    href={href}
                    className="text-secondary font-medium text-sm hover:underline"
                  >
                    {t.email}
                    {t.subject ? ` — ${t.subject}` : ""} →
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
