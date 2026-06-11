# AuditHalo

**Audit-ready supervision. Every hour, every state, every signature.**

AuditHalo is a vertical SaaS for clinical-supervision compliance. It gives the supervisors of pre-licensed mental-health counselors (LCMHCAs, APCCs, LPC-Associates, RMHCIs, LMHC Limited Permit holders) one dashboard for their whole roster, a state-specific rules engine that flags gaps in real time, and a sealed, citation-grounded PDF evidence package per signed session.

The wedge: EHRs (SimplePractice, TherapyNotes, ICANotes) handle the *clinical* workflow but not the *regulatory* one. None produce a state-board-specific audit package keyed to the right admin-code citation. AuditHalo does.

---

## Status

Early development. Not yet accepting external contributions. The product is being built out in public on this repo; the marketing site lives at [audithalo.com](https://audithalo.com) and the app at [app.audithalo.com](https://app.audithalo.com).

If you are a state-board reviewer, licensed supervisor, or pre-licensed counselor who wants to look at the rules dataset or propose a correction, open an issue.

---

## What is in this repo

| Area | Where |
| --- | --- |
| Next.js app (marketing + product, one codebase, host-routed) | `src/app/` |
| Host-based routing (Next 16 proxy) | `src/proxy.ts` |
| Rule engine + state YAML rules | `src/lib/rules/`, `rules/<state>/v1.yaml` |
| Drizzle schema + migrations | `src/lib/db/schema.ts`, `drizzle/` |
| Auth (Auth.js v5) | `src/auth.ts` |
| Stripe billing + webhook | `src/lib/stripe.ts`, `src/app/api/stripe/webhook/` |
| Evidence package PDF render | `src/app/api/evidence/[id]/route.tsx` |
| Brand book, launch plan, messaging | `docs/brand/`, `docs/strategy/` |
| Cross-session context for AI agents | `docs/HANDOFF.md` |

---

## Stack

- **Next.js 16** (App Router, Turbopack) on **Vercel**
- **TypeScript 5** + **Tailwind CSS 4** + **shadcn/ui**
- **Auth.js v5** with credentials + JWT sessions
- **Neon Postgres** + **Drizzle ORM**
- **Stripe** billing (Checkout + Customer Portal)
- **Resend** for transactional email
- **@react-pdf/renderer** for evidence-package PDFs
- **Vitest** for tests (rule engine)

---

## Run locally

Prereqs: Node 20+, a Neon (or any Postgres) database, and a `.env.local` with the variables below.

```bash
npm install
npm run db:migrate
npm run dev
```

Required environment:

```
DATABASE_URL=postgresql://...
AUTH_SECRET=...                       # npx auth secret
RESEND_API_KEY=...                    # optional; falls back to console.log
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PRICE_SOLO_MONTHLY=price_...
STRIPE_PRICE_SOLO_YEARLY=price_...
STRIPE_PRICE_PRACTICE_BASE=price_...
STRIPE_PRICE_PRACTICE_SEAT=price_...
```

Before every commit:

```bash
npm run build
npx vitest run
```

---

## Documentation

Most context lives in `/docs`:

- **[`docs/strategy/01-launch-plan.md`](docs/strategy/01-launch-plan.md)** — GTM, pricing, roadmap, locked decisions
- **[`docs/strategy/04-enterprise-rbac.md`](docs/strategy/04-enterprise-rbac.md)** — Enterprise tier RBAC + multi-supervisor org spec
- **[`docs/strategy/08-scheduling-and-calendar.md`](docs/strategy/08-scheduling-and-calendar.md)** — scheduling, Teams/Meet integration, calendar view
- **[`docs/brand/brand-book.md`](docs/brand/brand-book.md)** — palette, typography, voice, logo
- **[`docs/brand/messaging.md`](docs/brand/messaging.md)** — taglines, elevator pitches, headline bank

A couple of files in `/docs` (`HANDOFF.md`, `PUSHING.md`) and the root `AGENTS.md` document the day-to-day workflow used by AI coding sessions on this repo. They're tracked because they're load-bearing for the maintainer's own setup; if you're reading the code from the outside, they're not required.

---

## A note on the rules

The rules dataset (`rules/*/v1.yaml`) is the moat. It is curated, versioned, and citation-grounded — every rule links to the underlying admin code and statute. Each rule carries a `verification` block stating who last verified it and when. Rules that have not yet been reviewed by a licensed supervisor are explicitly marked **PRELIMINARY**. The product surfaces this state to the user.

If you spot an error in any encoded rule, please open an issue with the citation and the correction.

---

## Security

If you believe you've found a security issue — credential leak, auth bypass, evidence-package tamper, anything that could affect a customer's data — please email **info@audithalo.com** with the details rather than opening a public issue. We'll respond within two business days.

---

## Contact

- General / press / partnerships → **info@audithalo.com**
- Rule-dataset corrections → open a GitHub issue with the citation
- Reviewer access for state boards → email **info@audithalo.com** for a read-only account

The marketing site lives at [audithalo.com](https://audithalo.com); the application at [app.audithalo.com](https://app.audithalo.com).

---

## License

Source-available, **not** open-source. Copyright © 2026 the AuditHalo project owner. All rights reserved.

The code in this repository is published for transparency and review. No license to use, copy, modify, redistribute, or run the code in production is granted by the publication of this repository. The "AuditHalo" name, the AuditHalo mark, and the state-rules dataset (`rules/`) are trademarks and proprietary work product of the project owner; the rules dataset in particular took meaningful effort to research, encode, cite, and verify and is **not** dedicated to the public domain.

If you want to license any part of this repository, email **info@audithalo.com**.
