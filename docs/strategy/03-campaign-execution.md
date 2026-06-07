# Campaign execution — web-dev plan

_Drafted 2026-06-06. Companion to the marketing playbook ("AuditHalo — Full Marketing Campaign Playbook") and the beta-readiness gap report (`02-beta-readiness.md`). This doc captures only the items that ship through the codebase. Outreach, content authoring, and listing setup live elsewhere._

The campaign launches into three engines (design-partner beta, SEO/content moat, community + lifecycle email). This doc plans the **minimum web-dev surface that has to exist before the campaign goes live**, then defers everything else until beta feedback reveals where users actually drop off.

---

## Locked decisions (don't re-litigate)

Carried forward from the marketing playbook + this planning conversation:

- **Tagline:** *Audit-ready supervision. Every hour, every state, every signature.* Renders as a kicker above the home H1 and as a recurring footer line. The home H1 itself stays as the current SEO-locked copy ("State-board compliance software for mental health supervisors.").
- **Campaign headline:** *When the board asks, the answer's already in a folder.* Lands as the hero subhead on `/for-supervisors`.
- **Wedge sentence:** *Every EHR helps you do the work. AuditHalo proves you did the work.* Renders as a comparison band between the home hero and the value pillars.
- **Four value pillars** (audit-defensible by default; rules engine kept current; one dashboard for the whole roster; free for supervisees) become the spine of the home, features, and `/for-supervisors` pages.
- **Founding Supervisor offer:** 12 months free of the Practice feature set + 50% lifetime lock + Founding Supervisor badge + founder direct line, for the first 15-25 licensed supervisors.
- **Founding page URL:** `/founding`.
- **Stripe code shape:** one shared coupon `founding_supervisor_lifetime` (100% off forever) + one promo code per reviewer with `max_redemptions=1`.
- **Founding badge scope:** start minimum (small visual badge + `users.is_founding_supervisor` column). Grow if it earns the room.
- **Lead-magnet content authorship:** Claude drafts the audit checklist + log template from the NC LCMHCA YAML and the campaign doc. Damon reviews before publish.
- **Email management:** transactional + lifecycle templates live in code (`src/lib/email/templates/*.tsx`, React Email). Resend delivers. No dashboard templates.
- **Analytics:** PostHog. SDK already wired. `NEXT_PUBLIC_POSTHOG_KEY` and `POSTHOG_API_KEY` set on Vercel production.

---

## Cycle 1 — "The site says what your outreach says + you can measure traffic"

Ships **before any outreach goes out.** Foundational, low-risk, no dependencies on Cycle 2.

### What lands

1. **A1-A5 copy lockdown**
   - Tagline as a small kicker above the home H1, plus a recurring footer line sitewide
   - Campaign headline (*"When the board asks…"*) as the hero subhead on `/for-supervisors`
   - Wedge sentence (*"Every EHR helps you do the work…"*) as a comparison band on the home, between the hero and the value pillars
   - Restructure the home + `/features` + `/for-supervisors` pages around the four value pillars as the spine
   - Replace the first four FAQs on `/for-supervisors` with the objection-handling FAQs from the marketing playbook (tracker / EHR co-sign / HIPAA / state not listed); keep "How long does setup take?"
   - Voice-rule banned-word list added to `docs/brand/brand-voice.md` (crush, journey, holistic, seamless, AI-powered, unlock, frictionless)

2. **PostHog named events** — server-side capture from server actions + Stripe webhook + daily cron
   - `lead_magnet_download` (Cycle 2 surfaces this)
   - `supervisee_signup_free` — on `acceptInviteAction` success (new user branch)
   - `supervisor_trial_start` — on Stripe webhook `checkout.session.completed`
   - `supervisee_added` — on `inviteSuperviseeAction` (new invitation row created)
   - `state_rule_selected` — on rule-assignment action
   - `session_logged` — on `logSessionAction` success
   - `signature_completed` — when a session reaches the "fully signed" state
   - `evidence_package_sealed` (north-star activation event)
   - `trial_converted` — on subscription transitions from `trialing` to `active`
   - `review_submitted` — manual event for now (we'll hand-fire it once we hook into a Capterra/G2 webhook)

### Why grouped

Both are foundational and zero-risk to the in-app experience. The site needs to say what your cold-email and Reddit posts say, OR every prospect who clicks through hits a credibility gap. PostHog needs to fire from the FIRST campaign touch — every day of missing data is a day we can't answer "is this working?" in week 4.

### Why first

No dependencies on Cycle 2. Cheap. ~1 day end-to-end. Ships before Damon writes a single cold email.

### Estimated effort

- Copy: ~2 hours (mostly editing existing pages)
- Pillar restructure: ~3 hours (genuine information-architecture work)
- PostHog instrumentation: ~3 hours (10 events across ~6 server-side trigger points)

### Validation checklist

- [ ] Home renders the tagline kicker without disrupting SEO (H1 unchanged)
- [ ] Wedge sentence reads as a deliberate band, not a tacked-on tagline
- [ ] Value pillars consistent across home + `/features` + `/for-supervisors`
- [ ] FAQ swap on `/for-supervisors` reads cleanly, 5 items total
- [ ] PostHog dashboard shows events arriving from a test session post-deploy
- [ ] Tests + build green; no regressions in 237 vitest suite

---

## Cycle 2 — "The sales surface for the campaign"

Ships **before Damon sends the first cold email** to a prospective Founding Supervisor.

### What lands

1. **B1 — Founding Supervisor landing** (`/founding`)
   - New marketing route with the offer, terms, the 4 value pillars compressed, and an apply form
   - Apply form: name, email, state, license credential, current roster size (1-3 / 4-10 / 11-25), free-text "what's hard about supervision-compliance today?"
   - Submit → server action emails Damon the application + writes the lead to a Resend audience
   - Auto-responder thanks the applicant and sets expectation (24-48hr personal reply from Damon)

2. **G5 — Founding Supervisor badge in-app**
   - Migration: `users.is_founding_supervisor boolean default false`
   - Small visual badge near the user's name in the dashboard header
   - Admin-only action (gated by `isAdminEmail`) to flip the flag for a user — used after Damon manually approves a Founding application
   - Founding-supervisor-only-feature pattern wired so future "early access" features can branch on the flag

3. **G6 — Stripe lifetime promo code mechanics**
   - One shared Stripe coupon `founding_supervisor_lifetime` (100% off forever) created manually in Stripe dashboard
   - One promo code per approved Founding Supervisor, max_redemptions=1, named after the recipient
   - URL parameter `?promo=<CODE>` on the billing page pre-fills the Stripe Checkout promo input
   - Documentation: small `docs/marketing/founding-supervisor-codes.md` (gitignored) for tracking code → recipient → review state

4. **C1 + C2 — gated audit checklist + log template**
   - Two PDF assets in `public/lead-magnets/`:
     - `nc-supervision-audit-checklist.pdf` (per-state planned for later cycles; ship NC v1 first)
     - `nc-supervision-log-template.pdf`
   - Email-capture modal on the existing `/counseling-supervision-audit-checklist` and `/supervision-log-template` pages
   - Submit → writes to a Resend audience (separate from contact + Founding audiences) + sends a personal email with the PDF link
   - `lead_magnet_download` PostHog event fires on successful capture

### Why grouped

This is the bundle that actually powers your outreach motion. Your cold email says *"Founders lock 50% off for life afterward"* — that promise has no landing page until B1 ships. Your community posts say *"I put together a free audit checklist"* — that goes nowhere without the gated PDFs. The badge + Stripe code mechanics are how the Founding offer fulfills in-app once a prospect converts.

### Why second

Depends on Cycle 1 (the locked value-pillar copy informs the Founding page). Cycle 2 requires more design decisions than Cycle 1 (apply-form copy, badge styling, modal UX, PDF layout). Splitting them lets Damon eyeball Cycle 1 on the live site before Cycle 2 commits to a direction.

### Estimated effort

- B1 landing + form: ~4 hours
- G5 badge migration + UI + admin action: ~2 hours
- G6 promo URL param + docs: ~1 hour
- C1+C2 PDFs (Claude drafts content) + email-capture flow: ~5 hours (most of it is content authoring; the form plumbing is small)

### Decisions still open

- **C1 layout** — PDFs can be authored as React Email components rendered to PDF (consistent typography with the brand) OR as static Figma exports. React Email keeps everything in code; Figma is faster to iterate visually. **Default: React Email** unless Damon wants a heavier visual treatment.
- **B1 auto-responder** — same as the contact form's auto-responder or a separate Founding-specific template? **Default: Founding-specific** — it sets the cohort tone from the first touch.

### Validation checklist

- [ ] Founding apply form submits + email lands in Damon's inbox + lead appears in Resend audience
- [ ] Badge renders for users with the flag, hidden for others
- [ ] `?promo=` URL parameter actually pre-fills Stripe Checkout
- [ ] Lead-magnet capture → email arrives within 60s with a working PDF link
- [ ] `lead_magnet_download` event reaches PostHog with the magnet slug as a property

---

## Cycle 3 — "Trust signals" (parallel; ships when listings live)

Pure dependency on Damon's external work. Once Capterra / G2 / GetApp listings are live + logos delivered:

- Footer trust strip on `audithalo.com` — small logos linking out to each listing
- One-line "Independently reviewed on Capterra · G2 · GetApp" on `/security`
- **Not** in the home hero — listings dilute the value-prop message in above-the-fold real estate

Effort: ~30 minutes once logos + URLs are in hand.

---

## What's NOT in this plan (and why)

These items from the marketing playbook are explicitly deferred until the beta has at least 5 supervisors AND the funnel data reveals real friction:

- **Cluster SEO pages** (25 pages: per-state hours requirements / supervisor qualifications / log template / etc.). Premature without knowing which state pillar converts.
- **Comparison/BOFU pages** (vs spreadsheets, vs Time2Track, vs MyClinicalSupervisor). Need talking points from beta supervisor feedback first.
- **Full email lifecycle beyond welcome + trial-end** (trial nurture day 2/5/9, activation nudge day 7, free-supervisee→supervisor loop, formal review request automation). Welcome + trial-end + Founding auto-responder are enough until the funnel tells us where users actually stall.
- **Expiring permit nudges** (NY/FL). Event-driven and copy-ready, but no NY/FL beta user yet. Build when a real customer needs it.
- **State Law Updates newsletter UI** (`RESEND_AUDIENCE_ID` is wired in `actions/contact.ts`). Build when there's a flagged rule change to broadcast.
- **Cohort upgrades to the Founding badge** (dedicated dashboard page, roadmap voting, founder direct-line UI). Grow the badge as the cohort earns it.

These all stay parked in `02-beta-readiness.md` and the marketing playbook as "post-feedback work."

---

## Operational notes

### Tracker items

Each atomic Cycle-1 and Cycle-2 task gets a tracker item via the Nimbalyst session tracker. The trackers are the operational backlog Damon can pick off later; this doc is the strategy artifact.

### Roll-out cadence

Cycle 1 ships as one commit. Cycle 2 ships as two-to-three commits (apply form + badge migration as one; Stripe promo + lead magnet flow as another; PDF content as a third).

### What unblocks the campaign launch

Cycle 1 + Cycle 2 = the minimum web-dev surface for the campaign. Once both ship, Damon can write his first cold email without any "let me get back to you when the page exists" rough edges.

Cycle 3 ships when the directory listings exist and unblocks the SEO-link-building / credibility half of the SEO strategy from the marketing playbook.
