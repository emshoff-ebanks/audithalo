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
        <div className="mx-auto max-w-3xl px-6 py-16 lg:py-20 space-y-10 text-foreground/80 leading-relaxed">

          <div>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">1. Who we are</h2>
            <p>
              AuditHalo is a clinical supervision compliance platform operated by Medipyxis. For any privacy questions, contact us at{" "}
              <a href="mailto:info@audithalo.com" className="text-secondary hover:underline">info@audithalo.com</a>.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">2. What we collect</h2>
            <ul className="space-y-2 list-disc list-inside text-foreground/70">
              <li><strong className="text-foreground">Account information</strong> — name, email address, password (bcrypt-hashed, never stored in plaintext), role, state, and license type.</li>
              <li><strong className="text-foreground">Organization data</strong> — practice name, billing contact, and subscription status.</li>
              <li><strong className="text-foreground">Supervision records</strong> — session dates, durations, session types, hour totals, and e-signature metadata (signer name, role, timestamp, IP address, intent confirmation).</li>
              <li><strong className="text-foreground">Evidence packages</strong> — the sealed, SHA-256-hashed JSON records generated at signing. These are immutable once created.</li>
              <li><strong className="text-foreground">Supervision session content</strong> — if you use the AI session notes feature, you submit a supervision transcript for processing. We do not store the raw transcript after processing completes. The generated structured note is stored as part of the session record.</li>
              <li><strong className="text-foreground">Usage and log data</strong> — server logs, IP addresses, and pages visited, used for security monitoring and debugging.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">3. What we do not collect</h2>
            <p>
              AuditHalo is a supervision compliance tool, not a clinical records system.{" "}
              <strong className="text-foreground">Supervision notes document the supervisory relationship — counselor development, competencies, and professional growth — not client information.</strong>{" "}
              We do not collect or store patient or client records of any kind.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">4. How we use your data</h2>
            <ul className="space-y-2 list-disc list-inside text-foreground/70">
              <li>Providing and operating the AuditHalo platform</li>
              <li>Evaluating supervision hours against encoded state board rules</li>
              <li>Generating, sealing, and storing evidence packages</li>
              <li>Sending transactional emails (invitations, signature requests, billing receipts)</li>
              <li>Processing payments through Stripe</li>
              <li>Security monitoring and error debugging</li>
              <li>Improving the platform based on aggregate usage patterns (never individual records)</li>
            </ul>
            <p className="mt-3">We do not sell your data. We do not use your data to train AI models.</p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">5. Third parties we share data with</h2>
            <ul className="space-y-2 list-disc list-inside text-foreground/70">
              <li><strong className="text-foreground">Neon</strong> — Postgres database, US-East-1, encrypted at rest</li>
              <li><strong className="text-foreground">Vercel</strong> — application hosting, US-East, receives request logs</li>
              <li><strong className="text-foreground">Stripe</strong> — payment processing; AuditHalo does not store card numbers</li>
              <li><strong className="text-foreground">Resend</strong> — transactional email delivery</li>
              <li><strong className="text-foreground">OpenAI</strong> — processes supervision transcripts for AI session notes via the standard API; content is not retained and not used for model training</li>
              <li><strong className="text-foreground">Sentry</strong> — anonymized error monitoring</li>
            </ul>
            <p className="mt-3">We do not share your data with licensing boards or any government entity except as required by law.</p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">6. Data retention</h2>
            <ul className="space-y-2 list-disc list-inside text-foreground/70">
              <li>Account and organization data: retained while your account is active and for 90 days after deletion</li>
              <li>Supervision records and evidence packages: retained for 7 years from creation (matching most state board record-retention requirements)</li>
              <li>Raw transcript content: deleted after AI processing completes — not stored</li>
              <li>Audit log entries: 7-year retention</li>
            </ul>
          </div>

          <div>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">7. Your rights</h2>
            <p className="mb-3">You may request to:</p>
            <ul className="space-y-2 list-disc list-inside text-foreground/70">
              <li>Access a copy of the data we hold about you</li>
              <li>Correct inaccurate data</li>
              <li>Delete your account and associated data (subject to retention requirements above)</li>
              <li>Export your supervision records</li>
            </ul>
            <p className="mt-3">
              To make any of these requests, email{" "}
              <a href="mailto:info@audithalo.com?subject=Privacy%20request" className="text-secondary hover:underline">info@audithalo.com</a>.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">8. Security</h2>
            <p>
              Passwords are bcrypt-hashed. Sessions are stored in HttpOnly cookies scoped to app.audithalo.com. All traffic uses TLS 1.3. Data at rest is encrypted by our cloud providers. We monitor for unauthorized access and will notify affected users in the event of a breach as required by law.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">9. Children</h2>
            <p>AuditHalo is a professional platform for licensed clinicians. We do not knowingly collect data from anyone under 18.</p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">10. Changes to this policy</h2>
            <p>
              We update the &ldquo;Last updated&rdquo; date when this policy changes. For material changes, we&apos;ll notify you by email at least 14 days before the change takes effect.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">11. Contact</h2>
            <p>
              <a href="mailto:info@audithalo.com" className="text-secondary hover:underline">info@audithalo.com</a>
            </p>
          </div>

        </div>
      </section>
    </>
  );
}
