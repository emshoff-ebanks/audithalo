# AuditHalo — Launch Plan (Strategy v0.1)

**Status**: Draft for Damon to react to. Decisions still open are flagged inline and listed in §12.
**Last updated**: 2026-06-01

## TL;DR

1. **The opportunity is real and structurally under-served.** ABA has 4–5 mature supervision-tracking tools; mental-health counseling (LCMHCA / LPC-A / LCSW-A / AMFT) has roughly one aging product (MyClinicalSupervisor) and a handful of EHR side-modules that handle co-signatures but not state-board audit packages.
2. **Go to market supervisor-first, price per supervisee.** Supervisor holds board-level personal liability + budget authority; viral coefficient is 3–6× supervisor-first vs 0.2–0.5× supervisee-first. The supervisee account is free and polished (long-loop network play — today's free supervisee is tomorrow's paying supervisor).
3. **Moat = the rules engine + maintenance discipline.** No commercial product sells structured, up-to-date, multi-state supervision rules. Building this dataset and keeping it current *is* the durable differentiation.
4. **Launch with 5 states, not 1.** NC + CA + TX + FL + NY covers ~60–70% of the US associate population and lets the marketing site rank for the high-volume state-specific long-tail queries.
5. **Defer HIPAA infra until the first practice customer demands it.** Launch with user-redacted transcripts (a real UX, not just a disclaimer); migrate to BAA-eligible infrastructure (AWS / Azure OpenAI) when revenue funds it.

---

## 1. The opportunity

- **TAM**: ~100,000–200,000 pre-licensed associates in the US across LPC, LCSW, LMFT, and psychology pre-licensure families (order-of-magnitude — verify against BLS OES 21-1014, ASWB Census, NBCC, AAMFT before quoting publicly).
- **Why nothing dominant exists**: the niche is too small for an EHR major to prioritize, the rules are too fragmented for a generalist compliance tool, and the dollars-per-customer are too low for enterprise compliance vendors. Goldilocks-zone for a focused vertical SaaS.
- **Wedge over EHRs**: SimplePractice, TherapyNotes, ICANotes, TheraNest all support a "supervisor" role with co-signature on notes. None produces a **state-board-specific audit-ready evidence package**. That's the gap.
- **Moat**: a curated, versioned, citation-grounded multi-state rules dataset that is genuinely current. As far as research could establish, no one ships this today.

## 2. Target audience & GTM

### Buyer archetypes (in priority order)

| Archetype | Volume | Budget | Decision cycle | What they want |
|---|---|---|---|---|
| **Group practice (5–50 clinicians)** | ~30–40% of clinicians | Compliance/HR lead has budget | 30–90 days, BAA + security review | One failed audit jeopardizes billing → strong willingness to pay for risk reduction |
| **Solo supervisor moonlighting** | Large, fragmented | Out of pocket, price-sensitive (~$50–100/mo ceiling) | Self-serve, hours | Saves admin time, replaces spreadsheets |
| **The associate themselves** | Largest by headcount | $10–25/mo solo ceiling, high churn at licensure | Self-serve, minutes | Anxiety: "I'm going to lose my hours" |

### Recommended motion: **supervisor-led, supervisee-priced**

- **Marketing pitched to the supervisor**: "Manage your whole roster's compliance from one place. Never lose another supervisee's hours."
- **Pricing unit is the supervisee** (one paid seat per supervisee on the supervisor's roster), but the supervisor and any HR admin are included.
- **Supervisee solo account is free** with manual tracking — this is the long-loop play. Today's free supervisee becomes tomorrow's paying supervisor in 2–4 years.
- **Network effect**: 1 paying supervisor brings 3–8 supervisees. Each supervisee, when they become a supervisor 2–4 years later, is a warm conversion target.

### What we explicitly are NOT doing in v1

- Selling to associates as the primary buyer. Their wallet is too small and their churn at licensure is too high to anchor revenue on.
- Dual-GTM. We pick supervisor-led, nail the messaging and onboarding, and add a self-serve supervisee PLG layer only after supervisor-led has PMF.

## 3. Competitive landscape

### Direct competitors (clinical supervision tracking)

| Product | Target | Last-known pricing | Weakness |
|---|---|---|---|
| **MyClinicalSupervisor** | LMHC/LCSW associate + supervisor | ~$15–20/mo per supervisee | Dated UI; no AI; no transcript import; weak roster dashboards |
| **Supervise.io** | Solo supervisors | Quote-only / unclear if active | Small footprint |
| **Motivity** (supervision module) | **ABA / BCBA** (different niche) | ~$15–30/supervisee, enterprise tiers | BACB-aligned, not LCMHCA |
| **CentralReach** (supervision suite) | ABA practices | ~$75–125/user/mo | ABA-only, expensive |

**Takeaway**: ABA has solved this category 4–5 ways over. Mental-health counseling hasn't. That's an order-of-magnitude opportunity.

### Adjacent practice-management with supervision features

| Product | Supervision treatment | Pricing |
|---|---|---|
| **SimplePractice** | "Supervisor" seat + co-sign | $29 / $69 / $99 per clinician/mo |
| **TherapyNotes** | Co-sign on notes | $59 + $30/clinician/mo |
| **TheraNest** | Co-sign | $42 / $54 / $98 / $325+ tiered |
| **ICANotes** | Co-sign + review queue | $70–85/clinician/mo |

**The wedge**: none of these produce a state-board audit package. They handle the clinical workflow, not the regulatory workflow.

### Analog compliance trackers (for pricing reference)

| Niche | Product | Price | Model |
|---|---|---|---|
| CLE (lawyers) | CEBroker | $29–39/yr individual | Per-credential annual |
| CME (physicians) | MyCME, CMEFly | Mostly free to doctor | Sponsor-paid |
| CPE (CPAs) | CCH CPELink, Surgent | $199–499/yr unlimited | Annual subscription |
| Healthcare workforce CE | Relias | $50–150/seat/yr | Org contract |

**Pattern**: individual compliance trackers run $30–50/yr direct. Org/employer-paid runs $50–150/seat/yr. AuditHalo bundles more than these (AI notes, e-sign, audit package) so price ceiling is higher.

## 4. Pricing

**Recommended tier structure** (annual prices = 2 months free, ~17% discount):

| Tier | Target | Price (monthly / annual) | Includes |
|---|---|---|---|
| **Free** | Solo supervisee, "try before audit" | $0 | Manual hour log, 1 supervisor link, 5 sessions/mo, no AI, no audit-package export |
| **Solo Supervisor** | 1 supervisor + up to 3 supervisees | **$89/mo / $890/yr** | NC + 1 other state rule, supervisor dashboard, e-sign, audit-package PDF, AI notes (10 transcripts/mo) |
| **Practice** | 4–20 supervisees, has HR person | **$25/supervisee/mo** + **$49 base/mo** (annual only) | All states, HR dashboard, exec rollup, SSO, audit log retention, bulk export, priority support, unlimited transcripts |
| **Enterprise** | 20+ supervisees, multi-location, BAA required | **Talk to sales** (target ~$15/supervisee/mo at scale) | SOC 2 report, custom DPA, dedicated CSM, API, Teams enterprise integration, custom state-rule additions |

**Anchors**:
- $89/mo Solo Supervisor is roughly 3× MyClinicalSupervisor (~$20/seat × 3 supervisees) but with state-rule engine + AI + audit packages.
- $25/seat Practice undercuts SimplePractice on a per-seat basis once you're 2+ supervisees, and we're not replacing the EHR — we're complementing it.
- Enterprise is intentionally vague — standard in healthcare SaaS, lets us capture larger budgets when SOC 2 / BAA are gating.

**Billing implementation phases**:
1. **Phase 1 (launch)**: Stripe Checkout (hosted) + Customer Portal. Three Products × two Prices (monthly/annual). Webhooks → DB sync of `organizations.subscription_status`.
2. **Phase 2 (50+ paid customers)**: per-seat quantity-based Practice tier with `subscriptionItems.update({ quantity })` on roster changes. Proration enabled.
3. **Phase 3 (Enterprise)**: Stripe Invoicing (not Subscriptions) for custom annual contracts requiring PO / NET-30 / wire.

**Skip until later**: Stripe Tax, Stripe Connect, custom dunning (use Smart Retries).

> **Decision needed (§12)**: confirm tiers and prices, or counter-propose.

## 5. Brand & visual identity

### Carry forward from the original AuditHalo design system

- **Palette** (Swiss High-Contrast + Organic Enterprise):
  - Foreground: `#0B1020` (near-black, primary)
  - Background: `#F8FAFC` (off-white)
  - Halo Blue: `#2563EB` (secondary)
  - Electric Violet: `#7C3AED` (accent — AI features)
  - Audit Gold: `#D4A72C` (accent — evidence packages)
  - Status: Success `#15803D`, Warning `#D97706`, Risk `#DC2626`
- **Typography**: Cabinet Grotesk (display) + IBM Plex Sans (body). Already wired in the scaffold.
- **Surfaces**: flat, 1px borders, sharp corners (2–4px radius). No drop shadows.

### What to add

- **Logomark**: currently we have a wordmark only. Recommend commissioning (or designing) a simple icon mark — a halo with a checkmark inside, or a halo over a clipboard. Should work at 16px favicon size.
- **Brand voice**: trustworthy, compliance-minded, calm under pressure. Plain English over jargon. Empathetic to associate anxiety. No marketing hyperbole.
- **Brand book** (`/docs/brand/brand-book.md`): codify palette, typography, voice/tone, do's and don'ts, image guidelines.

> **Decision needed (§12)**: keep existing palette/type or refresh? Logo direction?

## 6. Marketing site information architecture

```
audithalo.com
├── /                        Home (hero + features + social proof + pricing teaser + CTA)
├── /features                Detailed feature pages
├── /pricing                 Tier table + FAQ + ROI calculator
├── /for-supervisors         Persona landing (primary)
├── /for-practices           Persona landing (HR-led buyers)
├── /security                Security & compliance posture
├── /states/                 Index of supported states
│   ├── /nc-lcmhca           SEO landing for NC associates
│   ├── /ca-apcc-aswb-amft   CA tri-license overview
│   ├── /tx-lpc-associate
│   ├── /fl-rmhci
│   └── /ny-permit
├── /blog                    Content marketing (SEO long-tail)
├── /about                   Story + team
├── /contact                 Sales contact for Enterprise
└── /legal/
    ├── /privacy
    ├── /terms
    └── /baa                 BAA template (signal we take HIPAA seriously)
```

**SEO strategy**: state-specific landings are the priority pages. Each one targets queries like:
- "NC LCMHCA supervision hour tracking"
- "California LPCC supervised hours requirements"
- "Texas LPC associate hour tracker"

Each page has the state's full rule encoded in human-readable form, a "Start tracking your [STATE] hours" CTA, and links to the official board source. This is **content marketing + product demonstration in one**.

## 7. App scope (v1 = first paid customer)

### In v1 (port-and-ship)

- Auth.js v5 (email/password to start; add Google/Microsoft later)
- Organizations (groups of users that share a roster + billing)
- Roles: `supervisee`, `supervisor`, `hr_admin`, `executive`
- Supervisor invites supervisee by email → supervisee accepts → linked on roster
- State rule selection per supervisee (NC at launch, then CA/TX/FL/NY)
- Manual hour log entry with structured fields (date, duration, session_type, attendees, modality)
- Session scheduling (calendar entry without external calendar sync yet)
- E-signature flow with intent confirmation (already in original schema — port directly)
- Evidence package generation as PDF + immutable record (SHA-256 hash, citation of rule version)
- Supervisor dashboard: roster table with each supervisee's progress percentage, next-due date, at-risk flag
- Supervisee dashboard: progress meter, upcoming sessions, pending signatures, evidence packages

### v1.1 (after first paid customer)

- AI documentation from pasted transcripts (Option 2 UX with PHI pre-scan)
- HR dashboard
- Stripe billing live
- Multi-state expansion (CA, TX, FL, NY) with state landing pages

### v1.2 (after first practice customer)

- Microsoft Teams transcript import via Graph API
- Microsoft Calendar sync
- Executive dashboard
- Audit log per organization (every change attributed)

### v2 (HIPAA upgrade trigger)

- Migrate to BAA-eligible infrastructure
- Encrypted-at-rest fields for transcript storage
- SSO via SAML/OIDC for Enterprise

## 8. PHI & compliance strategy

### Launch posture: **Option 2 (user-redacted transcripts)**

- User pastes transcript → pre-upload screen runs regex pass for obvious PHI (phone numbers, SSNs, addresses, common name patterns) → warns user of any matches → user confirms "this contains no PHI" → submit.
- AI prompt is also instructed to flag and scrub anything PHI-like as a second line of defense.
- ToS includes user warrant that submitted content contains no PHI.
- **No BAAs needed at this stage**. We're not processing PHI (legally) because the user warrants it isn't there.

### Upgrade trigger: first practice customer with compliance officer

- Switch to **Option 4 (full HIPAA posture)**: BAAs with hosting, DB, AI provider, email; encrypted-at-rest; audit logs; access controls; breach response plan.
- Likely stack: **AWS** (S3 + RDS Postgres + Lambda or ECS) + **Azure OpenAI** (BAA via Azure) + **Postmark** (BAA available).
- One-time cost: ~1 week of compliance setup. Ongoing: ~$200–500/mo infra delta over current Neon/Vercel.

### SOC 2 plan

- **Now**: implement cheap controls — MFA on all admin accounts, employee laptop policy doc, audit logging, secrets management, dependency scanning, dependency update SLAs. Cost: hours.
- **Trigger**: when ARR > ~$200k or first Enterprise prospect requires SOC 2 letter.
- **Path**: Type 1 audit first (~$15k), Type 2 after 6 months operational evidence (~$20k). Use Vanta or Drata for evidence collection.

## 9. Multi-state rules system

### Launch states (cover ~60–70% of associate population)

| State | License | Approx. rule shape | Notes |
|---|---|---|---|
| **NC** | LCMHCA | 3,000 hrs over 2–5 yr; 100 hrs supervision; ≥1 hr individual per 2 weeks; supervisor must be LCMHCS | Already seeded in DB |
| **CA** | APCC (→LPCC) | 3,000 hrs over ≥104 weeks; 1,750 direct; weekly supervision; BBS-administered tri-license | Most complex; biggest associate pool |
| **TX** | LPC-Associate | 3,000 hrs over ≥18 months; 1,500 direct; 4 hrs/month supervision min; LPC-A # on materials | Counseling Compact (2024) impacts hour transfer |
| **FL** | RMHCI | 1,500 hrs over 100 wks; 100 hrs supervision; intern registration valid 5 yrs non-renewable | Telehealth carve-outs recent |
| **NY** | Limited Permit (LMHC) | 3,000 hrs supervised; permit-based, no associate license # | Permit expiration is a hard deadline — UI must surface this |

### Schema: hybrid structured + predicate DSL

- **Structured fields** (cover ~85% of cases): jurisdiction, license_code, total_hours, direct_contact_hours, supervision_hours, individual_supervision_min_per_period, group_supervision_max_pct, min_duration_weeks, max_duration_years, supervisor_credential_types[], pre_registration_required.
- **Predicate DSL layer** (cover ~15% of edge cases): JSON-Logic or CEL expressions evaluated against the user's hour log. Handles "1 hr individual per 2 weeks AND ≥1 hr supervision per 40 practice hours, whichever is greater," telehealth caps, supervisor-must-co-sign-by-date, etc.
- **Per-rule metadata**: `effective_start`, `effective_end`, `citation_admincode`, `citation_url`, `last_verified_at`, `last_verified_by`. Non-negotiable for audit trail.
- **Versioning**: in-flight obligations grandfather under their rule version (legally significant — grandfathering is statutory in many states).
- **Storage**: rules as YAML/JSON files in `/rules/` directory of the repo. Diff-reviewable PRs, not opaque DB mutations. CI deploys to runtime DB.

### Sources (authoritative)

- State admin code (e.g., 21 NCAC 53 for NC, 22 TAC 681 for TX, CCR Title 16 for CA, F.A.C. 64B4 for FL)
- State board pages (linked from NBCC State Board Directory)
- ASPPB Handbook of Licensing & Certification Requirements (~$200–400/yr) — psychology specifically
- ASWB Social Work Regulations Database — LCSW-family
- AAMFT State MFT Regulatory Boards Database — LMFT-family
- NBCC / ACA State Board Directory — LPC-family starting points

### Monitoring stack

| Mechanism | Cost | Reliability |
|---|---|---|
| State register RSS (CA OAL, TX Register, NY SAPA, FL FAR) | $0 | High (legally authoritative) |
| Visualping / Distill on board pages | ~$20–50/mo for ~200 pages | High for HTML, blind to PDF-only updates |
| State board email lists | $0 | Medium — often late |
| Professional association newsletters (ACA, NASW, AAMFT chapters) | $0–200/yr | Medium — early signal |
| LinkedIn / supervisor Facebook groups (tripwire only) | $0 | Anecdotal, fast |
| ASPPB / ASWB / AAMFT handbook subscriptions | $200–400/yr each | High, but PDF (manual ingest) |
| Quarterly manual audit (founder + contractor) | Time | Highest |

### Maintenance team

- **Months 0–6**: founder + a contracted licensed clinical supervisor (NC LCMHCS or equivalent) at ~5 hrs/month to verify NC rules. Add a paralegal/regulatory analyst contractor when expanding to states 2–5.
- **Year 1**: ~10 hrs/month total across all 5 states, mix of founder QA + analyst.
- **Year 2+**: part-time regulatory analyst (~20 hrs/month) maintaining the dataset across all supported states.

### Recent meaningful rule changes (last 2–3 yrs)

- **CA SB 1024 / BBS updates**: removed personal-psychotherapy hour requirement for AMFT/APCC; telehealth supervision rules
- **TX HB 4533 (2023) + Counseling Compact go-live 2024**: changes how out-of-state hours count
- **Social Work Compact (2023–24 approval, 2025–26 rollout)**: cross-state hour portability
- **FL**: telehealth supervision allowances; intern registration validity reaffirmed at 5 yrs non-renewable
- **NC**: LCMHCS supervisor qualification rules revised 2022–23

> **Decision needed (§12)**: confirm NC + CA + TX + FL + NY as launch states.

## 10. Tech & infrastructure

### Current (deployed)

- Next.js 16 + TypeScript + Tailwind CSS 4 on Vercel
- Neon Postgres + Drizzle ORM
- Custom domains: audithalo.com (marketing) + app.audithalo.com (app), proxy-routed
- Auth.js v5 installed (wiring next)
- OpenAI Node SDK installed (no calls yet)

### To add for v1

- **Stripe Billing** — Checkout + Customer Portal
- **Resend** — transactional email (invites, password resets, signature requests)
- **Sentry** — error tracking
- **PostHog** — product analytics + session replay (free tier)
- **shadcn/ui** — standardized form/button/card components

### To add for v1.1+

- **Cloudflare** in front of marketing for caching + WAF (optional)
- **MS Graph API** integration for Teams transcripts + Calendar (when porting AI doc)

### To add for v2 / HIPAA

- Either: **Vercel Enterprise** + Neon Enterprise (both BAA-capable but pricey)
- Or: **AWS** (S3 + RDS + ECS) + **Azure OpenAI** + **Postmark** — cheaper at scale, more compliance lift up-front

## 11. Roadmap

| Phase | Timing | Deliverables | Gate to next |
|---|---|---|---|
| **Phase 0** (done) | — | Infra: repo, scaffold, Neon, Vercel, domains, host-routing proxy | ✓ Complete |
| **Phase 1 — Brand + auth + supervisor onboarding** | Weeks 1–2 | Brand book; marketing v1 (home/features/pricing); shadcn/ui; Auth.js wired; org + roster invite flow; NC rule live; manual hour log; supervisor dashboard | First friendly-beta supervisor onboarded |
| **Phase 2 — Signature + evidence + billing** | Weeks 3–4 | E-sign with intent confirmation; evidence package PDF generation; Stripe Checkout live; supervisor can run a complete supervision-to-audit cycle | First paying supervisor |
| **Phase 3 — Multi-state + supervisee polish** | Month 2 | CA + TX + FL + NY rules encoded; state landing pages live; supervisee dashboard refined; signup funnel for self-serve supervisors | 5 paying supervisors |
| **Phase 4 — AI docs + Teams import** | Month 3 | Transcript paste UX with PHI pre-scan; OpenAI session-note generation; Teams import (mocked → real); calendar sync | First multi-supervisee practice |
| **Phase 5 — Practice tier + HIPAA prep** | Month 4+ | HR dashboard; exec dashboard; SOC 2 controls; SSO; BAA-eligible infra path documented; first HIPAA upgrade if customer demands | First Enterprise prospect |

## 12. Open decisions

| # | Decision | My recommendation | Damon's call |
|---|---|---|---|
| D1 | Lock supervisor-first GTM? | **Yes** — viral coefficient and budget authority both clearly favor it | ✅ **Locked: supervisor-first** (2026-06-01) |
| D2 | Confirm Tier 1 pricing ($89 Solo / $25/seat Practice + $49 base / Enterprise quote)? | **Yes** with launch promo (50% off first 3 months for first 20 customers) | Pending — revisit after first 5 friendly-beta supervisors |
| D3 | PHI: Option 2 launch, plan to upgrade to Option 4? | **Yes** — fastest path to ship; upgrade is straightforward when revenue demands | ✅ **Locked: Option 2 (user-redacted) → upgrade to Option 4 on first practice customer** (2026-06-01) |
| D4 | Launch with NC + CA + TX + FL + NY? | **Yes** — covers 60–70% of TAM and powers SEO long-tail | ✅ **Locked: NC + CA + TX + FL + NY** (2026-06-01) |
| D5 | Brand: keep existing palette + Cabinet Grotesk / IBM Plex Sans? | **Yes** — original system is strong | Pending — defaulting to "keep" unless overridden |
| D6 | Commission a logomark or stick with wordmark? | **Wordmark for v1**, commission icon mark before paid launch | Pending |
| D7 | Budget for ASPPB Handbook (~$300/yr) and Visualping (~$30/mo)? | **Yes** — both critical for rules-engine integrity | Pending |
| D8 | Hire a contracted LCMHCS or licensed clinical supervisor part-time for rule QA? | **Yes** — ~5 hrs/month at month 0; expands as we add states | Pending |
| D9 | First customer target: warm intro to NC practice, or cold launch to associates? | **Warm NC practice** — single design partner customer beats 50 cold trials | ✅ **Locked: warm + cold in parallel** (2026-06-01) |
| D10 | When to start commercial entity formation (LLC, BAA template, ToS)? | **Before first paid customer** — by end of Phase 2 | Pending |
