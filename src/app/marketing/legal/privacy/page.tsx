import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Privacy Policy — AuditHalo",
  description: "How AuditHalo collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  const updated = "June 1, 2026";

  return (
    <>
      <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
        <Badge variant="outline" className="mb-4">
          Legal
        </Badge>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-foreground max-w-3xl">
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-foreground/60 font-mono">
          Last updated: {updated}
        </p>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-6 py-16 prose prose-neutral max-w-none">
          <div className="space-y-10 text-foreground/80 leading-relaxed">

            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">1. Who we are</h2>
              <p>
                AuditHalo ("AuditHalo," "we," "us," "our") is a software platform for clinical supervision compliance tracking. We are operated by Medipyxis. For questions about this policy, contact us at{" "}
                <a href="mailto:hello@audithalo.com" className="text-secondary hover:underline">
                  hello@audithalo.com
                </a>.
              </p>
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">2. What we collect</h2>
              <p className="mb-3">We collect the following categories of information:</p>
              <ul className="space-y-2 list-disc list-inside text-foreground/70">
                <li><strong className="text-foreground">Account information</strong> — name, email address, password (bcrypt-hashed, never stored in plaintext), role (supervisee, supervisor, HR admin, executive), and state/license type.</li>
                <li><strong className="text-foreground">Organization data</strong> — practice name, billing address, and subscription status (managed through Stripe).</li>
                <li><strong className="text-foreground">Supervision records</strong> — session dates, durations, modality, session types, hour totals, and e-signature metadata (signer name, role, timestamp, IP address, intent confirmation).</li>
                <li><strong className="text-foreground">Evidence packages</strong> — the sealed, SHA-256-hashed JSON records generated at the time of signing. These are immutable once created.</li>
                <li><strong className="text-foreground">AI-processed transcript content</strong> — if you use our AI session notes feature, you submit a transcript for processing. We do not store your raw transcript beyond the processing request. The generated structured note is stored as part of the session record.</li>
                <li><strong className="text-foreground">Usage and log data</strong> — server logs, IP addresses, browser type, and pages visited, used for security monitoring and debugging.</li>
              </ul>
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">3. Protected Health Information (PHI)</h2>
              <p className="mb-3">
                <strong className="text-foreground">AuditHalo does not accept PHI on the platform</strong> for accounts on the Free or Solo Supervisor tiers. Before any transcript is submitted for AI processing, our PHI pre-scan flags obvious identifiers (names, dates, phone numbers, addresses, and other HIPAA safe-harbor identifiers). Users must confirm that submitted content contains no PHI and warrant to this in our Terms of Service.
              </p>
              <p>
                Enterprise-tier customers may request BAA-eligible infrastructure (AWS + Azure OpenAI with signed Business Associate Agreements) that supports PHI-containing transcripts. Contact us at{" "}
                <a href="mailto:hello@audithalo.com?subject=Enterprise%20BAA" className="text-secondary hover:underline">
                  hello@audithalo.com
                </a>{" "}
                to discuss.
              </p>
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">4. How we use your data</h2>
              <ul className="space-y-2 list-disc list-inside text-foreground/70">
                <li>Providing and operating the AuditHalo platform and its compliance-tracking features</li>
                <li>Evaluating supervision hours against encoded state rules</li>
                <li>Generating, sealing, and storing evidence packages</li>
                <li>Sending transactional emails (invitation emails, signature requests, billing receipts)</li>
                <li>Processing payments through Stripe</li>
                <li>Monitoring for security incidents and debugging errors</li>
                <li>Improving the platform based on aggregate usage patterns</li>
              </ul>
              <p className="mt-3">We do not sell your data. We do not use your data to train AI models.</p>
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">5. Third parties we share data with</h2>
              <ul className="space-y-2 list-disc list-inside text-foreground/70">
                <li><strong className="text-foreground">Neon (database)</strong> — stores all application data on Postgres hosted in US-East-1. Data is encrypted at rest.</li>
                <li><strong className="text-foreground">Vercel (hosting)</strong> — runs the application in US-East. Receives request logs.</li>
                <li><strong className="text-foreground">Stripe (billing)</strong> — processes payment information. AuditHalo does not store card numbers. Stripe's privacy policy applies to payment data.</li>
                <li><strong className="text-foreground">Resend (email)</strong> — delivers transactional emails on our behalf.</li>
                <li><strong className="text-foreground">OpenAI (AI processing)</strong> — processes transcripts submitted for AI session notes. OpenAI's standard API terms apply; content submitted via API is not used for model training and is not retained.</li>
                <li><strong className="text-foreground">Sentry (error monitoring)</strong> — receives anonymized error data and stack traces. PHI scrubbing is in place.</li>
              </ul>
              <p className="mt-3">
                We do not share your data with state licensing boards or any government entity except as required by law.
              </p>
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">6. Data retention</h2>
              <ul className="space-y-2 list-disc list-inside text-foreground/70">
                <li>Account and organization data: retained while your account is active and for 90 days after deletion.</li>
                <li>Supervision records and evidence packages: retained for 7 years from creation date (matching most state licensing board record-retention requirements). You may request earlier deletion; evidence packages that have been shared with supervisees cannot be unilaterally deleted.</li>
                <li>Raw transcript content: not retained after AI processing completes.</li>
                <li>Audit log entries: retained for 7 years.</li>
              </ul>
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">7. Your rights</h2>
              <p className="mb-3">Depending on your location, you may have rights to:</p>
              <ul className="space-y-2 list-disc list-inside text-foreground/70">
                <li>Access a copy of the data we hold about you</li>
                <li>Correct inaccurate data</li>
                <li>Delete your account and associated data (subject to retention requirements above)</li>
                <li>Export your supervision records</li>
              </ul>
              <p className="mt-3">
                To exercise any of these rights, email{" "}
                <a href="mailto:hello@audithalo.com?subject=Privacy%20request" className="text-secondary hover:underline">
                  hello@audithalo.com
                </a>.
              </p>
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">8. Security</h2>
              <p>
                Passwords are bcrypt-hashed. Sessions are stored in HttpOnly cookies scoped to app.audithalo.com. All traffic uses TLS 1.3. Data at rest is encrypted by our cloud providers. We monitor for unauthorized access and will notify affected users in the event of a breach as required by applicable law. For a detailed security posture, see our{" "}
                <a href="/security" className="text-secondary hover:underline">
                  Security page
                </a>.
              </p>
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">9. Children</h2>
              <p>
                AuditHalo is a professional compliance platform. We do not knowingly collect data from anyone under 18. If you believe a minor has provided us data, contact us and we will delete it promptly.
              </p>
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">10. Changes to this policy</h2>
              <p>
                We'll update the "Last updated" date at the top when this policy changes. For material changes that affect how we handle existing data, we'll notify you by email at least 14 days before the change takes effect.
              </p>
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">11. Contact</h2>
              <p>
                Questions, concerns, requests:{" "}
                <a href="mailto:hello@audithalo.com" className="text-secondary hover:underline">
                  hello@audithalo.com
                </a>
              </p>
            </div>

          </div>
        </div>
      </section>
    </>
  );
}
