import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Terms of Service — AuditHalo",
  description: "Terms governing use of the AuditHalo clinical supervision compliance platform.",
};

export default function TermsPage() {
  const updated = "June 1, 2026";

  return (
    <>
      <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
        <Badge variant="outline" className="mb-4">
          Legal
        </Badge>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-foreground max-w-3xl">
          Terms of Service
        </h1>
        <p className="mt-4 text-sm text-foreground/60 font-mono">
          Last updated: {updated}
        </p>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="space-y-10 text-foreground/80 leading-relaxed">

            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">1. Acceptance</h2>
              <p>
                By creating an account or using the AuditHalo platform ("Service"), you agree to these Terms. If you're using the Service on behalf of an organization, you represent that you have authority to bind that organization. If you don't agree, don't use the Service.
              </p>
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">2. What AuditHalo is</h2>
              <p className="mb-3">
                AuditHalo is a software platform that helps clinical supervisors and their supervisees track supervision hours against encoded state licensing board rules, capture e-signatures, and generate audit-ready evidence packages. Specifically, AuditHalo:
              </p>
              <ul className="space-y-2 list-disc list-inside text-foreground/70">
                <li>Encodes state supervision rules from publicly available administrative code and board guidance</li>
                <li>Evaluates logged hours against those rules</li>
                <li>Facilitates e-signature capture for supervision session records</li>
                <li>Generates SHA-256-hashed evidence packages that users may present to state licensing boards</li>
                <li>Processes supervision transcripts through AI to generate structured session notes</li>
              </ul>
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">3. Not legal or licensing advice</h2>
              <p className="mb-3">
                <strong className="text-foreground">AuditHalo is a software tool, not a law firm and not a licensing board.</strong> The state rules encoded in the platform are derived from publicly available sources and re-verified on a published schedule, but:
              </p>
              <ul className="space-y-2 list-disc list-inside text-foreground/70">
                <li>State licensing rules change. We verify rules quarterly, but a rule may change between verifications.</li>
                <li>Your specific facts may involve edge cases not captured by our encoding.</li>
                <li>AuditHalo's evaluation of your hours is not a determination by any licensing board that your supervision is compliant.</li>
                <li>You are responsible for verifying requirements with your state licensing board before submitting a licensure application.</li>
              </ul>
              <p className="mt-3">
                We mark rules with their verification date and citation link to the source code so you can check.
              </p>
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">4. PHI prohibition and user warrant</h2>
              <p className="mb-3">
                <strong className="text-foreground">Free, Solo Supervisor, and Practice accounts may not upload Protected Health Information (PHI) to the platform.</strong> PHI includes any information that could identify a specific client or patient, as defined by the HIPAA Privacy Rule's 18 safe-harbor identifiers.
              </p>
              <p className="mb-3">
                Before submitting any transcript for AI processing, you confirm that the transcript has been reviewed and contains no PHI. By submitting, you warrant to AuditHalo that:
              </p>
              <ul className="space-y-2 list-disc list-inside text-foreground/70">
                <li>The submitted content does not contain PHI as defined by HIPAA</li>
                <li>You have authority to submit the content for processing</li>
                <li>You have complied with any applicable confidentiality obligations</li>
              </ul>
              <p className="mt-3">
                Violation of this warrant is grounds for immediate account termination. Enterprise customers with signed BAAs may be permitted to submit PHI-containing content under their contract terms.
              </p>
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">5. Accounts and organizations</h2>
              <ul className="space-y-2 list-disc list-inside text-foreground/70">
                <li>You are responsible for maintaining the security of your account credentials.</li>
                <li>Supervisors who create an organization are responsible for the accuracy of the roster, rule assignments, and supervision records entered on behalf of their supervisees.</li>
                <li>Each user must have their own account. Sharing accounts is not permitted.</li>
                <li>You must provide accurate information when creating your account. Providing false credentials (e.g., false license status) to obtain access you're not entitled to is grounds for termination.</li>
              </ul>
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">6. E-signatures and evidence packages</h2>
              <p className="mb-3">
                By signing a session record in AuditHalo, you confirm that:
              </p>
              <ul className="space-y-2 list-disc list-inside text-foreground/70">
                <li>You are the person identified as the signer</li>
                <li>You intend to sign the record as your legal signature</li>
                <li>The information in the record is accurate to the best of your knowledge</li>
              </ul>
              <p className="mt-3">
                Once sealed, an evidence package is immutable. Neither AuditHalo nor any user can modify a sealed package. A new version may be issued by mutual consent of all required signers, and both versions are retained.
              </p>
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">7. Payment and billing</h2>
              <ul className="space-y-2 list-disc list-inside text-foreground/70">
                <li>Paid plans are billed through Stripe. By subscribing, you agree to Stripe's terms in addition to ours.</li>
                <li>The 14-day free trial requires no payment information. At the end of the trial, you must subscribe or lose access to paid features.</li>
                <li>Subscriptions auto-renew. Cancel anytime through the billing portal — cancellation takes effect at the end of the current billing period.</li>
                <li>Supervisee accounts are free and remain free regardless of the supervisor's plan status.</li>
                <li>We prorate seat additions and removals to the hour.</li>
                <li>We reserve the right to change pricing with 30 days' notice. Existing subscribers will not see price changes until their next renewal after the notice period.</li>
              </ul>
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">8. Acceptable use</h2>
              <p className="mb-3">You may not:</p>
              <ul className="space-y-2 list-disc list-inside text-foreground/70">
                <li>Submit false supervision records or fabricate hours</li>
                <li>Forge or misrepresent signatures</li>
                <li>Use the Service to facilitate fraud against a state licensing board</li>
                <li>Attempt to reverse-engineer, scrape, or abuse the platform's APIs</li>
                <li>Upload malware, exploits, or content that violates any applicable law</li>
                <li>Resell or sublicense access to the platform</li>
              </ul>
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">9. Intellectual property</h2>
              <p>
                The AuditHalo platform, brand, and encoded state rules are our property. Your supervision records are yours. We claim no ownership over data you enter. You grant us a limited license to process and store your data as necessary to provide the Service.
              </p>
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">10. Limitation of liability</h2>
              <p className="mb-3">
                To the fullest extent permitted by law:
              </p>
              <ul className="space-y-2 list-disc list-inside text-foreground/70">
                <li>AuditHalo is provided "as is." We make no warranty that the Service will be error-free, uninterrupted, or that any state rule encoding is fully accurate at all times.</li>
                <li>We are not liable for any licensing board decision, denial of licensure, or regulatory action that results from relying on AuditHalo's rule evaluation.</li>
                <li>In no event will AuditHalo's aggregate liability exceed the amounts you paid us in the 12 months preceding the claim.</li>
                <li>We are not liable for indirect, incidental, special, consequential, or punitive damages.</li>
              </ul>
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">11. Termination</h2>
              <p>
                You may delete your account at any time. We may suspend or terminate accounts that violate these Terms, particularly the PHI prohibition, acceptable use policy, or e-signature accuracy requirements. On termination, evidence packages previously issued remain in the system for the applicable retention period to protect supervisees' records.
              </p>
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">12. Governing law and disputes</h2>
              <p>
                These Terms are governed by the laws of the State of North Carolina, without regard to conflict-of-law principles. Any disputes will be resolved by binding arbitration in North Carolina under AAA rules, except that either party may seek injunctive relief in court for IP or confidentiality violations.
              </p>
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">13. Changes to these Terms</h2>
              <p>
                We may update these Terms. For material changes, we'll notify you by email at least 14 days in advance. Continued use after the effective date constitutes acceptance.
              </p>
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">14. Contact</h2>
              <p>
                Questions about these Terms:{" "}
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
