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

- **[`docs/HANDOFF.md`](docs/HANDOFF.md)** — read this first to get the full project state in one document
- **[`docs/strategy/01-launch-plan.md`](docs/strategy/01-launch-plan.md)** — GTM, pricing, roadmap, locked decisions
- **[`docs/brand/brand-book.md`](docs/brand/brand-book.md)** — palette, typography, voice, logo
- **[`docs/brand/messaging.md`](docs/brand/messaging.md)** — taglines, elevator pitches, headline bank

---

## A note on the rules

The rules dataset (`rules/*/v1.yaml`) is the moat. It is curated, versioned, and citation-grounded — every rule links to the underlying admin code and statute. Each rule carries a `verification` block stating who last verified it and when. Rules that have not yet been reviewed by a licensed supervisor are explicitly marked **PRELIMINARY**. The product surfaces this state to the user.

If you spot an error in any encoded rule, please open an issue with the citation and the correction.

---

## License

All rights reserved. AuditHalo and the AuditHalo mark are trademarks of the project owner. Code is published on GitHub for transparency, not for redistribution.
