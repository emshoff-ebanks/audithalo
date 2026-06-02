# AuditHalo — Cross-Session Handoff

**Purpose.** Read this first if you are a new chat picking up AuditHalo work. It is the minimum context required to resume development without backtracking. Anything important enough to be load-bearing is here; deeper detail lives in the linked docs.

**Last updated**: 2026-06-01 (end of Phase 3 v0).

---

## 1. The product in one paragraph

AuditHalo is a vertical SaaS that produces **state-board-audit-ready evidence packages** for the supervision of pre-licensed mental health counselors (LCMHCA in NC, APCC in CA, LPC-Associate in TX, RMHCI in FL, LMHC Limited Permit in NY at launch). The supervisor is the buyer; the supervisee is free. The moat is a curated, versioned, citation-grounded **multi-state rules engine** plus the maintenance discipline to keep it current. The wedge over EHRs (SimplePractice, TherapyNotes, ICANotes) is that they handle the *clinical* workflow but not the *regulatory* one — none ship an audit-ready evidence package keyed to a specific state's admin code.

Two domains:
- **audithalo.com** — marketing site
- **app.audithalo.com** — the product

Both are one Next.js app, routed by host via a proxy.

---

## 2. Who you are working with

- **Damon** (signs in as Damon in chat).
- Email: `damon@medipyxis.com` (user email — **NOT a git author**, see §3).
- GitHub login: `emshoff-ebanks` (numeric ID `228783329`).
- New to GitHub and Vercel — needs clear, step-by-step instructions when infra work is involved.
- Original AuditHalo was built on Emergent. This is the clean rebuild.

---

## 3. Hard rules (never break these)

### 3.1 Git identity and pushing

> **Never** push, commit, or attribute anything to `medipyxisman`, `medipyxis`, or the `damon@medipyxis.com` email. That account is for a separate company and must not appear in this repo. The owner is **`emshoff-ebanks`** (ID `228783329`).

**Read [`docs/PUSHING.md`](PUSHING.md) before you commit or push.** It has the per-command flags, the credential-cache reset commands, and the Vercel auto-deploy explanation.

Short version:

```bash
git -c user.email="228783329+emshoff-ebanks@users.noreply.github.com" \
    -c user.name="emshoff-ebanks" \
    commit -m "..."
git push origin main
```

If push fails with `Repository not found`, credentials are cached for the wrong account. Purge with `git credential-manager github logout medipyxisman` and `cmdkey /delete:git:https://github.com`, then push again to trigger re-auth.

Vercel watches `main` and auto-deploys both `audithalo.com` and `app.audithalo.com` on every push. No Vercel CLI commands needed for deploy.

**Do not** raise Vercel/GitHub attribution mismatch issues with the user — that ground was settled. Just keep the identity clean and move on.

### 3.2 Operational

- Working tree: `C:\code\audithalo`. The Nimbalyst session may report `cwd` as `C:\nimbalyst\nimbalyst`; always use absolute paths.
- Before every commit: `npm run build` and `npx vitest run` must both be green. 8 tests currently pass on the rule engine.
- Commit via `mcp__nimbalyst-mcp__developer_git_commit_proposal` when asked to commit work (avoids two-session race on the index). Other git operations are fine from the shell.
- Rules in `rules/*/v1.yaml` must include `verification.last_verified_by`. If the rule was drafted from training data without a live source pull, that field must say `"founder (preliminary — drafted from training data, no live source pulled)"`. **Do not** mark a rule "VERIFIED" without a real authoritative source pull plus licensed-supervisor review.

---

## 4. Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | **Next.js 16.2.6** (App Router, Turbopack) | `proxy.ts` does host-based routing (replaces the deprecated middleware). |
| Language | TypeScript 5 | strict |
| Styling | **Tailwind CSS 4** | `@theme` directive in `src/app/globals.css` exposes brand tokens as CSS vars. |
| UI primitives | **shadcn/ui** + Radix | Wired manually (the CLI hangs in non-TTY). `components.json` + `src/lib/utils.ts` (`cn`) + per-component files under `src/components/ui/`. |
| Auth | **Auth.js v5 beta** (`next-auth@5.0.0-beta.31`) | Credentials provider, JWT sessions, bcryptjs. `src/auth.ts`. Session.user augmented in `src/types/next-auth.d.ts`. |
| DB | **Neon Postgres** | `postgresql://neondb_owner:...@ep-flat-butterfly-ap1kaqy5...` |
| ORM | **Drizzle 0.45.2** + `drizzle-kit` | Migrations: `drizzle/*.sql` + `drizzle/meta/_journal.json`. **Do not** use `drizzle-kit push` (interactive, hangs). Use `npm run db:generate` then `npm run db:migrate`. |
| Rules | **YAML** + Zod | Files under `rules/<slug>/vN.yaml`. Loader caches in a module Map. `js-yaml` parses unquoted `YYYY-MM-DD` as JS Date — the `dateLike` Zod helper handles it. |
| PDFs | `@react-pdf/renderer` | `/api/evidence/[id]/route.tsx` — `runtime = "nodejs"`. Buffer wrapped in `new Uint8Array(...)` to satisfy `BodyInit`. |
| Email | **Resend** | `src/lib/email.ts` — falls back to `console.log` when `RESEND_API_KEY` is unset. |
| Billing | **Stripe** v22 | `src/lib/stripe.ts`. Webhook at `/api/stripe/webhook` (signature-verified, `runtime = "nodejs"`). |
| Tests | **Vitest 4** | `npx vitest run` — 8 passing on the rule engine. |
| Hosting | **Vercel** (project: `audithalo`) | Custom domains live. `next.config.ts` has `outputFileTracingIncludes: { "/**/*": ["./rules/**/*.yaml"] }` so YAML ships to Functions. |
| Errors | (not wired yet) | Sentry planned. |
| Analytics | (not wired yet) | PostHog planned. |

---

## 5. Repository layout

```
C:\code\audithalo
├── docs/
│   ├── HANDOFF.md                      <-- this file
│   ├── strategy/01-launch-plan.md      GTM, pricing, roadmap, locked decisions
│   └── brand/
│       ├── brand-book.md               palette, type, voice, logo decisions
│       ├── messaging.md                taglines / pitches / headlines
│       └── logos/
│           ├── generate.mjs            opentype.js v1.3 path generator
│           ├── hybrid-solid-a-subtle.svg   canonical mark source
│           └── *.svg / *.png           variants
├── rules/
│   ├── nc-lcmhca/v1.yaml               VERIFIED-by-founder
│   ├── ca-apcc/v1.yaml                 PRELIMINARY
│   ├── tx-lpc-associate/v1.yaml        PRELIMINARY
│   ├── fl-rmhci/v1.yaml                PRELIMINARY
│   └── ny-lmhc-lp/v1.yaml              PRELIMINARY
├── drizzle/
│   ├── 0000_init.sql                   base schema
│   ├── 0001_orgs_memberships_invitations.sql
│   ├── 0002_supervisee_assignments_session_events.sql
│   ├── 0003_session_signatures.sql
│   ├── 0004_evidence_packages_repoint.sql
│   ├── 0005_orgs_stripe_fields.sql
│   └── meta/_journal.json
├── src/
│   ├── proxy.ts                        host -> internal route mapping
│   ├── auth.ts                         Auth.js v5 config
│   ├── types/next-auth.d.ts            Session.user augmentation
│   ├── app/
│   │   ├── globals.css                 Tailwind 4 @theme + brand tokens
│   │   ├── icon.svg                    favicon
│   │   ├── marketing/                  audithalo.com (proxy target)
│   │   │   ├── layout.tsx              header/footer
│   │   │   ├── page.tsx                home
│   │   │   ├── features/page.tsx
│   │   │   ├── pricing/page.tsx
│   │   │   ├── for-supervisors/page.tsx
│   │   │   ├── security/page.tsx
│   │   │   └── states/
│   │   │       ├── page.tsx            index of jurisdictions
│   │   │       └── [slug]/page.tsx     per-state (generateStaticParams)
│   │   ├── app/                        app.audithalo.com (proxy target)
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   ├── accept-invite/[token]/page.tsx
│   │   │   ├── sign/[sessionId]/page.tsx
│   │   │   └── dashboard/
│   │   │       ├── page.tsx
│   │   │       ├── billing/page.tsx
│   │   │       └── roster/
│   │   │           ├── page.tsx
│   │   │           └── [superviseeId]/page.tsx
│   │   ├── actions/                    Server Actions
│   │   │   ├── auth.ts                 register/login/logout
│   │   │   ├── invitations.ts          invite/cancel
│   │   │   ├── accept-invite.ts
│   │   │   ├── supervisee.ts           assign rule, log session
│   │   │   ├── signatures.ts           sign + seal-on-complete
│   │   │   └── billing.ts              startCheckout / startPortal
│   │   └── api/
│   │       ├── stripe/webhook/route.ts
│   │       └── evidence/[id]/route.tsx PDF render (nodejs runtime)
│   ├── components/
│   │   ├── ui/                         shadcn primitives
│   │   └── brand/
│   │       └── AuditHaloMark.tsx       <Mark /> + <Wordmark />
│   └── lib/
│       ├── utils.ts                    cn()
│       ├── authz.ts                    requireSession, requireManager, getCurrentMembership, isManagerRole
│       ├── db/
│       │   ├── schema.ts               drizzle schema
│       │   ├── client.ts               pg pool + drizzle()
│       │   └── migrate.ts              tsx-runnable migrator
│       ├── rules/
│       │   ├── types.ts                Zod (ruleSchema, sessionEventSchema, evaluationContextSchema; dateLike)
│       │   ├── loader.ts               cache + ruleSlug/parseSlug/getLatestRuleByJurLic/listLatestRules
│       │   ├── checks.ts               9 check fns
│       │   ├── evaluator.ts            evaluate(ctx, rule) -> {compliant, totals, progress, riskLevel, gaps}
│       │   └── presentation.ts         riskBadgeVariant, severityStyles, toneClasses
│       ├── stripe.ts                   PRICES from env, stripe client
│       ├── invitations.ts              generateInvitationToken / hashToken
│       ├── evidence.ts                 canonicalJson / sha256Hex / generateEvidencePackage
│       └── email.ts                    Resend with console.log fallback
└── tests/                              vitest (rule engine)
```

---

## 6. What is live, end-to-end

A supervisor can do this whole loop today (Phases 1 + 2 + 3 v0):

1. **Sign up** at `/register` (supervisor role auto-creates a personal org).
2. **Invite a supervisee** by email from `/dashboard/roster` (Resend; falls back to console).
3. **Supervisee accepts** at `/accept-invite/[token]` (SHA-256 hashed token, 7d expiry). Account + membership created; auto-signed-in.
4. **Assign a rule** to the supervisee (`nc-lcmhca`, `ca-apcc`, `tx-lpc-associate`, `fl-rmhci`, or `ny-lmhc-lp`).
5. **Log supervision sessions** with structured fields. The rule engine evaluates live and shows progress, gaps, and a risk badge keyed to the rule's checks.
6. **Sign sessions** at `/sign/[sessionId]` — supervisor and supervisee sign with name + intent flag + IP + timestamp. When both signers present, the session **seals**.
7. **Evidence package generation** mints canonical JSON (sorted keys) + SHA-256 hash on seal. `/api/evidence/[id]` streams a PDF with rule citation, signatures, and the hash printed in monospace as a verification footer.
8. **Billing**: `/dashboard/billing` shows pricing tiers or current plan. Stripe Checkout supports Solo monthly/yearly and Practice (base + per-seat) with a 14-day trial. Customer Portal at "Manage". Webhook syncs `organizations.subscription_*` fields.

Permissions are locked down: a supervisee cannot view the roster, invite, view other supervisees, assign rules, or log sessions. `/dashboard` redirects supervisees to their own detail page. Defense in depth across UI and server actions.

Marketing: home / features / pricing / for-supervisors / security / states (index + 5 per-state pages with SSG via `generateStaticParams`). The state pages show a "Preliminary — pending licensed review" badge when `verification.last_verified_by` contains "preliminary".

---

## 7. Phase status

| Phase | Status | Commit | Notes |
| --- | --- | --- | --- |
| **0 — Infra** | DONE | (pre-commit) | Repo, Neon, Vercel, custom domains, proxy host-routing. |
| **1.1 — shadcn foundation** | DONE | `9c08ae6` | Button, Input, Label, Card, Badge mapped to brand tokens. |
| **1.2 — Marketing v1** | DONE | `cd278b0` | home / features / pricing / for-supervisors / security with nav + footer. |
| **Brand v0.1** | DONE | `bce671f` → `ecc393a` | Brand book, palette refresh, logo locked (`hybrid-solid-a-subtle`), wordmark generated via opentype.js v1.3. |
| **1.3 — Rule engine** | DONE | `ee224e7` | YAML + Zod, evaluator, 9 checks, NC LCMHCA encoded, 8 vitest tests. |
| **1.4 — Auth** | DONE | `47cfa29` | Auth.js v5, credentials + bcrypt, JWT, supervisor self-signup, protected `/dashboard`. |
| **1.5 — Orgs + invites** | DONE | `268e6be` | Orgs, memberships, invitations with hashed tokens + Resend fallback + accept flow. |
| **1.6 — Supervisee detail + live evaluator** | DONE | `f8bbac5` | Assign rule, log session, see risk badge + progress + gaps. **Phase 1 MVP complete.** |
| **(refactor)** | DONE | `33cd96b` | Extracted `getCurrentMembership` + presentation helpers. |
| **(permissions hardening)** | DONE | `c1a34e1` | Supervisee lockdown — cannot view roster / invite / log / assign. |
| **2.1 — E-signature with intent** | DONE | `65c5834` | signatures jsonb + signedAt; `/sign/[sessionId]` records name/role/IP/timestamp/intent; seal on both. |
| **2.2 — Evidence packages** | DONE | `1ba28dc` | Canonical JSON, SHA-256, PDF via `@react-pdf/renderer` at `/api/evidence/[id]`. |
| **2.3 — Stripe Billing** | DONE | `12948b6` | PRICES env, Solo monthly/yearly + Practice base+seat, 14d trial, webhook signature-verified, Customer Portal. |
| **3 v0 — Multi-state expansion** | DONE | `9690b54` | CA/TX/FL/NY rules encoded as PRELIMINARY; state index + per-state SSG pages live. |
| **3 v1 — Verification pass** | PENDING | — | Licensed supervisor sign-off; new checks (`weekly_supervision_cadence`, `permit_expiration_window`, `direct_client_contact_minimum`, `supervisor_training_course_required`); encode CA's conditional cadence properly. |
| **4 — AI docs + PHI pre-scan + Teams import** | PENDING | — | OpenAI for session notes from pasted transcripts; client-side PHI regex pre-scan; later Microsoft Graph for Teams transcripts + Calendar. |
| **5 — Practice tier + SOC 2 + HIPAA path** | PENDING | — | HR + Exec dashboards; SOC 2 evidence collection (Vanta/Drata); BAA-eligible infra plan (AWS S3+RDS+ECS or Vercel Enterprise + Neon Enterprise). |

---

## 8. Database schema (at a glance)

`src/lib/db/schema.ts`:

- **users** — id, email, password_hash, name, role enum (`supervisee` | `supervisor` | `hr_admin` | `executive`), created_at.
- **organizations** — id, name, slug, owner_id, **stripe_customer_id, stripe_subscription_id, subscription_status, subscription_tier, subscription_period_end**, created_at.
- **org_memberships** — id, org_id, user_id, role, created_at.
- **invitations** — id, org_id, email, role, **token_hash** (SHA-256 of a 32-byte hex token), expires_at, accepted_at, created_at.
- **state_rules** — legacy seed table (the live rule source is YAML on disk).
- **obligations** — legacy.
- **sessions** — legacy.
- **supervisee_rule_assignments** — id, supervisee_id, rule_slug, assigned_at.
- **session_events** — id, supervisee_id, supervisor_id, scheduled_for, duration_minutes, session_type, modality, attendees, notes, **signatures jsonb, signed_at**, created_at. (This is the live "session log" — evidence_packages was repointed here in `0004`.)
- **notifications**, **integrations** — legacy.

Migration discipline: when Drizzle's generator wouldn't produce what we needed (the evidence_packages repoint and the Stripe fields), the SQL was written by hand and `_journal.json` updated manually. That pattern is fine — just keep the journal in sync.

---

## 9. Rule engine

A rule lives at `rules/<slug>/v<N>.yaml`. The loader caches everything in a module-level Map. To use a rule:

```ts
import { getRule, getLatestRuleByJurLic } from "@/lib/rules/loader";
import { evaluate } from "@/lib/rules/evaluator";

const rule = await getRule("nc-lcmhca", 1);
const result = evaluate({ events, assignedAt }, rule);
// -> { compliant, totals, progress, riskLevel, gaps }
```

The 9 checks (`src/lib/rules/checks.ts`):
1. `preRegistrationRequired` — pre-permit hours don't count.
2. `supervisorCredentialRequired` — supervisor's credential must be in `accepted_credentials`.
3. `individualSupervisionCadence` — gap-based proxy for state cadence rules.
4. `supervisionRatioPerPracticeBlock` — ratio of supervision to practice (NC's "1 per 40").
5. `individualSupervisionMinimumShare` — ≥50% individual where required.
6. `groupSizeLimit` — per-state group size cap.
7. `totalPracticeHours` — cumulative.
8. `totalSupervisionHours` — cumulative.
9. `durationWindow` — min/max months between assignment and now.

State-specific edge cases (CA weekly cadence conditional on >10 direct hours, FL non-renewable 60-month cap, NY broad supervisor pool, TX monthly cadence with 1 individual + 4 total) are documented in each YAML's `notes:` block and queued for Phase 3 v1 new-check work.

**The verification triage** (re-read before pretending any of these are firm):

| Rule | Status |
| --- | --- |
| `nc-lcmhca` | Founder-verified against 21 NCAC 53. Still wants a licensed-supervisor sign-off before paid customers. |
| `ca-apcc` | PRELIMINARY. Multiple `LIKELY` flags. Needs live BBS source pull + CA-licensed Qualified Supervisor review. |
| `tx-lpc-associate` | PRELIMINARY. Group size cap (12 vs 6) is the highest-risk LIKELY. |
| `fl-rmhci` | PRELIMINARY. Group size cap (6 vs ?) and weekly-vs-biweekly cadence are the riskiest LIKELY values. |
| `ny-lmhc-lp` | PRELIMINARY. Group size cap is UNKNOWN (placeholder of 8). Supervisor pool (LCAT, LP inclusion) needs verification. |

---

## 10. Brand quick reference

Full detail in `docs/brand/brand-book.md`. Quick-lookup:

**Palette (locked, in `src/app/globals.css` as CSS vars):**
- `--foreground` `#0A1428` (deep navy-black)
- `--background` `#FAFAF7` (warm off-white)
- `--evidence-bg` `#F5F1E8` (warm oat — evidence surfaces)
- `--card` `#FFFFFF`
- `--primary` `#0F1F4C` (authoritative navy — nav, primary CTAs)
- `--secondary` `#1D4ED8` (Halo Blue — links)
- `--sage` `#7BA098` (humanity counterweight — illustration only, never body text)
- `--gold` `#B8860B` (**signet gold** — reserved for audit-ready / sealed / verified states)
- `--success` `#166534` · `--warning` `#B45309` · `--risk` `#B91C1C`

**Typography:**
- Display: **Cabinet Grotesk** (Fontshare, free). Plan to swap to Söhne after first paid customer.
- Body: **IBM Plex Sans**.
- Audit/mono: **IBM Plex Mono** (timestamps, hash values, case IDs).
- Accessible body alternate: **Atkinson Hyperlegible**.

**Voice:** Sentence case. Verbs first. Em-dashes encouraged. Specific over generic.
- **Use**: audit-ready, evidence package, supervised hours, ratio, obligation, rule version, citation, signature with intent, board-defensible, calm command center.
- **Avoid**: crush, slay, magic, journey, holistic, mindful, transform, AI-powered (use *AI-assisted*), seamless, leverage, frictionless.

**Logo:** Solid signet-gold annulus with audio-waveform outer edge (*audire*) + sun-dog dot at 22° clockwise from 12 o'clock (atmospheric 22° halo reference). Canonical source `docs/brand/logos/hybrid-solid-a-subtle.svg`. React component `src/components/brand/AuditHaloMark.tsx` exports `<AuditHaloMark />` and `<AuditHaloWordmark />`. Component viewBox is `25 25 150 150` (loosened so the dot has breathing room from the edge). Uses SVG `<mask>` for true transparent knockout around the sun-dog — works on any surface.

---

## 11. Strategy quick reference

Full detail in `docs/strategy/01-launch-plan.md`. Locked decisions:

- **GTM**: supervisor-led, supervisee free. Pricing unit = supervisee seat.
- **Pricing** (tentative): Free / Solo Supervisor $89/mo (or $890/yr) / Practice $25/seat/mo + $49 base / Enterprise quote.
- **PHI**: Launch with Option 2 (user-redacted transcripts + warrant). Upgrade to Option 4 (BAAs, encrypted at rest, AWS+Azure OpenAI+Postmark) on first practice customer demand.
- **Launch states**: NC + CA + TX + FL + NY. State landing pages are the SEO priority.
- **SOC 2**: defer formal audit until ARR > ~$200k or first Enterprise prospect needs the letter. Implement cheap controls now (MFA, secrets management, audit logs, dependency scanning).

---

## 12. Local dev cheat sheet

```pwsh
# install
cd C:\code\audithalo
npm install

# run
npm run dev                 # http://localhost:3000 (proxy treats localhost as marketing host)

# build + test (run BOTH before every commit)
npm run build
npx vitest run

# db
npm run db:generate         # generates a new migration from schema.ts diff
npm run db:migrate          # applies pending migrations (uses tsx + drizzle-orm migrator; do NOT use db:push)

# secrets
.env.local needs: DATABASE_URL, AUTH_SECRET, RESEND_API_KEY (optional — falls back to console),
                  STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
                  STRIPE_PRICE_SOLO_MONTHLY, STRIPE_PRICE_SOLO_YEARLY,
                  STRIPE_PRICE_PRACTICE_BASE, STRIPE_PRICE_PRACTICE_SEAT
```

Vercel project name: `audithalo`. Custom domains: `audithalo.com`, `app.audithalo.com`. Env vars set in the Vercel dashboard mirror `.env.local`. Stripe is in **test mode** with a webhook live.

---

## 13. Common traps (so you don't re-hit them)

- `js-yaml` parses unquoted `YYYY-MM-DD` as a JS Date. The `dateLike` Zod helper in `src/lib/rules/types.ts` coerces to ISO string. If a new rule's date field starts erroring, check it isn't being double-parsed.
- A line beginning with a quoted word in YAML (e.g. `"Triadic" supervision...`) breaks the parser. Don't start a value with a quoted word.
- `opentype.js` v2 has a NaN bug in `toPathData()` that breaks wordmark glyphs. Pin to **v1.3.4** and build the path manually from `path.commands`.
- The wordmark generator uses a **tight** mark viewBox (`translate(-40,-40)` then scaled) so the mark dominates the text in the horizontal lockup. The React component uses a **loose** viewBox (`25 25 150 150`) so the dot has breathing room in the header and favicon. **Do not** conflate these two — they are intentionally different.
- `@react-pdf/renderer` Route Handlers must declare `runtime = "nodejs"`. The Buffer must be wrapped: `new Response(new Uint8Array(buffer), { headers: ... })` to satisfy `BodyInit`.
- `drizzle-kit push` is interactive and hangs in non-TTY environments. Use `generate` + `migrate`.
- `shadcn` CLI `init` also hangs in non-TTY. Wire components manually if needed.
- Next.js 16 deprecated `middleware.ts` — host routing lives in `src/proxy.ts` exporting `function proxy`, with a matcher that excludes `_next/static`, `_next/image`, `/api/*`, and files with extensions.
- The Nimbalyst shell may report `cwd` as `C:\nimbalyst\nimbalyst`. The repo is at `C:\code\audithalo`. Use absolute paths in Bash invocations.

---

## 14. What to do first in a new session

1. Read this file.
2. Skim `docs/strategy/01-launch-plan.md` (locked decisions at the bottom).
3. Skim `docs/brand/brand-book.md` (locked decisions §11).
4. `git log --oneline -30` to see where the last session ended.
5. Ask Damon what's next. Don't assume.
