import { Badge } from "@/components/ui/badge";
import { ContactForm, NewsletterForm } from "@/components/marketing/contact-form";
import { Bell } from "lucide-react";

export const metadata = {
  title: "Contact AuditHalo — Clinical Supervision Software Support",
  description:
    "Get in touch with the AuditHalo team. Questions about your state's supervision requirements, supervisor accounts, or enterprise plans — we answer same day.",
};

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
          No ticket queue. No bot. Someone from the team reads every message and
          responds — usually same day.
        </p>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
            {/* Contact form */}
            <div className="lg:col-span-2">
              <h2 className="font-display text-2xl font-semibold text-foreground mb-8">
                Send us a message
              </h2>
              <ContactForm />
            </div>

            {/* Sidebar */}
            <div className="space-y-8">
              <div>
                <h3 className="font-display text-base font-semibold text-foreground mb-3">
                  Common topics
                </h3>
                <ul className="space-y-2 text-sm text-foreground/70">
                  <li>Setting up your supervisor account</li>
                  <li>Questions about your state&apos;s requirements</li>
                  <li>Enterprise or group practice plans</li>
                  <li>Requesting a new state be added</li>
                  <li>Partnership or press inquiries</li>
                </ul>
              </div>

              <div className="border-t border-border pt-8">
                <h3 className="font-display text-base font-semibold text-foreground mb-1">
                  Email directly
                </h3>
                <a
                  href="mailto:info@audithalo.com"
                  className="text-secondary text-sm hover:underline"
                >
                  info@audithalo.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="h-5 w-5 text-secondary" strokeWidth={1.75} />
              <Badge variant="outline">State law updates</Badge>
            </div>
            <h2 className="font-display text-2xl font-semibold text-foreground">
              Be the first to know when your state&apos;s supervision requirements change.
            </h2>
            <p className="mt-3 text-foreground/70 text-sm leading-relaxed mb-6">
              State boards update supervision rules — and the changes often come
              quietly. We monitor every state we cover and notify subscribers
              when hour requirements, cadence rules, or supervisor qualifications
              change. No spam. Unsubscribe anytime.
            </p>
            <NewsletterForm />
          </div>
        </div>
      </section>
    </>
  );
}
