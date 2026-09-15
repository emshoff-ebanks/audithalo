import { Badge } from "@/components/ui/badge";
import { ContactForm, NewsletterForm } from "@/components/marketing/contact-form";
import { Bell, Mail } from "lucide-react";

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
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-[color:var(--ink-900)] max-w-3xl leading-[1.05] tracking-tight">
          We answer email. Really.
        </h1>
        <p className="mt-6 text-lg text-[color:var(--ink-600)] max-w-2xl leading-relaxed">
          No ticket queue. No bot. Someone from the team reads every message and
          responds — usually same day.
        </p>
      </section>

      <section className="border-t border-[color:var(--ink-200)] bg-[color:var(--paper-100)]">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10 items-start">
            {/* Contact form panel */}
            <div className="lg:col-span-2 rounded-[14px] border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] p-6 sm:p-8">
              <h2 className="font-display text-2xl font-semibold text-[color:var(--ink-900)] mb-6">
                Send us a message
              </h2>
              <ContactForm />
            </div>

            {/* Sidebar */}
            <div className="rounded-[14px] border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] p-6 sm:p-8">
              <p className="label-overline mb-3">Common topics</p>
              <ul className="space-y-2.5 text-sm text-[color:var(--ink-600)]">
                <li>Setting up your supervisor account</li>
                <li>Questions about your state&apos;s requirements</li>
                <li>Enterprise or group practice plans</li>
                <li>Requesting a new state be added</li>
                <li>Partnership or press inquiries</li>
              </ul>

              <div className="mt-8 border-t border-[color:var(--ink-100)] pt-6">
                <p className="label-overline mb-3">Email directly</p>
                <a
                  href="mailto:info@audithalo.com"
                  className="inline-flex items-center gap-2 font-mono text-sm text-[color:var(--ink-700)] hover:text-[color:var(--ink-900)]"
                >
                  <Mail className="h-4 w-4" strokeWidth={2} />
                  info@audithalo.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="border-t border-[color:var(--ink-200)]">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <div className="rounded-[14px] border border-[color:var(--ink-200)] bg-[color:var(--paper-100)] p-8 sm:p-10 max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="h-5 w-5 text-[color:var(--ink-900)]" strokeWidth={2} />
              <Badge variant="outline">State law updates</Badge>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[color:var(--ink-900)]">
              Be the first to know when your state&apos;s supervision requirements change.
            </h2>
            <p className="mt-3 text-[color:var(--ink-600)] text-sm leading-relaxed mb-6">
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
