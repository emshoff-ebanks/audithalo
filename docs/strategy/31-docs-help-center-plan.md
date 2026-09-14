# AuditHalo Documentation / Help Center — Design Spec

Status: APPROVED (Phase 1, architecture) — 2026-09-14.
Scope: this doc covers hosting, information architecture, and in-app help strategy.
Phase 2 (infrastructure build) and Phase 3 (content writing) are separate passes,
each gated on the prior. Content writing is explicitly a separate pass after Phase 2.

Primary source of product truth: `docs/strategy/24-app-reference.md` (authoritative).
Brand: `docs/brand/brand-book.md`. Orientation: `docs/HANDOFF.md`.

---

## 1. Hosting decision — `/docs` subdirectory on audithalo.com

The help center is built as a new content-driven section of the existing Next.js app,
served at `audithalo.com/docs`, using the same pattern already proven by `/blog`:

- Content: MDX files under `src/content/docs/**`.
- Loader: `src/lib/docs.ts` mirroring `src/lib/mdx.ts` (gray-matter frontmatter, SSG).
- Routes: `src/app/marketing/docs/` (host-routed to the marketing domain via `proxy.ts`).
- Rendering: static generation (`generateStaticParams`), never client-rendered.
- Sitemap: docs entries appended in `src/app/sitemap.ts` like blog entries.

### Why this over the alternatives

**vs. `docs.audithalo.com` subdomain.** All existing SEO investment (10 state pages,
category pages, 8 pain pages, the blog production system in `docs/strategy/26`) is
concentrated on the apex domain. A subdirectory inherits that domain authority directly;
Google treats a subdomain as a weaker, signal-sharing relationship. There is no
offsetting operational benefit: no separate team owns docs, no separate deploy cadence
is needed, and `proxy.ts` host routing keeps a subdomain merely *possible*, not free.

**vs. external tool (Notion / GitBook / Mintlify / ReadMe).** Recurring cost for a
capability we get free from the existing stack. Generic theming undercuts a deliberately
"legal-grade trust" brand (navy / signet gold / Cabinet Grotesk) — an off-the-shelf help
widget reads as a smaller, less-considered product to the HR / compliance buyer this
brand is built to reassure. SEO value leaks off-domain. Their headline advantages
(multi-version docs, non-engineer editing) do not apply: one current product version, and
content is edited through the same repo / AI workflow as the blog.

**Search.** Client-side full-text search is correct at this scale (< 100 articles). No
Algolia or third-party search vendor. Matches Phase 2 requirements.

---

## 2. Competitor patterns adopted

Researched Notion Help Center, Linear Docs, Clerk Docs, Stripe Docs, and Intercom Help
Center. Patterns that hold regardless of company size, and which we adopt:

1. **Homepage is a card grid, not a document.** 10-ish top-level categories, at most two
   levels of nesting. No deep tree to drill through.
2. **Getting Started is pulled out of the taxonomy** and made the first, most visually
   distinct element on the index — never "first item alphabetically inside a category."
3. **Feature/task-based organization primary, role-based as an overlay.** Even Notion's
   role-based "Browse by team" sits on top of a feature-first structure.
4. **Trust signal fit to audience.** Given AuditHalo's legal-grade positioning and the
   fact that state-rule pages already surface citation + verification timestamps, docs
   carry a light "Last updated" date per article (Notion / Intercom lean), plus
   breadcrumbs and related-articles. We do not add a feedback ("was this helpful?") widget
   in v1 — no pipeline to act on it yet; revisit later.

---

## 3. Information architecture — hybrid (feature-primary, role overlay)

Ten top-level categories, named after real functional areas in `24-app-reference.md`.
Getting Started cards render above the category grid on the `/docs` index.

| Category (slug) | Primary audience |
|---|---|
| Getting Started (`getting-started`) | All roles (4 role quickstarts) |
| Sessions & Signing (`sessions`) | Supervisor, Supervisee |
| Practice Hours (`practice-hours`) | Supervisor, Supervisee |
| State Rules & Compliance (`rules`) | Supervisor, HR Admin |
| Evidence Packages (`evidence`) | Supervisor, HR Admin, Supervisee |
| Team & Roster (`team`) | HR Admin, Supervisor |
| Calendar & Integrations (`integrations`) | Supervisor, HR Admin |
| Billing & Plans (`billing`) | Supervisor, HR Admin |
| Account & Security (`account`) | All roles |
| Audit Log (`audit-log`) | HR Admin, Executive, Supervisor |

### 3.1 URL structure

`/docs` (index) · `/docs/[category]` (category landing) · `/docs/[category]/[article]`
(article). Category and article slugs are stable kebab-case. This differs from the flat
`/blog/[slug]` pattern deliberately: docs benefit from the category segment for
breadcrumbs and topical clustering; blog posts are standalone SEO landing pages.

### 3.2 Full article inventory

Priority legend: **P1** = write first (maps to the 8 stated writing priorities),
**P2** = write second, **P3** = later. Every article ends with a Related articles block
and a "Last updated" date. Articles in the `rules` category are subject to the same
fact-integrity discipline as blog posts (`docs/strategy/30`): every statutory number
traces to a `rules/*.yaml` field, with `[PRELIM]` disclaimers for unverified states.

#### Getting Started (`getting-started`)

| Title | Slug | Audience | Key topics | Documents | Priority |
|---|---|---|---|---|---|
| Getting started as a supervisor | `getting-started/supervisor` | Supervisor | Register, verify email, create personal org, invite first supervisee, assign a rule, log/sign first session | `/register`, `/dashboard`, `/dashboard/roster` | P1 |
| Getting started as a supervisee | `getting-started/supervisee` | Supervisee | Accept invite, view own detail page, log practice hours, countersign sessions, see progress | `/accept-invite/[token]`, `/dashboard`, `/dashboard/roster/[self]` | P1 |
| Getting started as an HR admin | `getting-started/hr-admin` | HR Admin | Org overview, invite roles, roster, rules admin, settings, 2FA-gated actions | `/dashboard/team`, `/dashboard/settings` | P1 |
| Getting started as an executive | `getting-started/executive` | Executive | Read-only rollup, what you can/can't see, audit-log export | `/dashboard/executive`, `/dashboard/audit-log` | P1 |
| Understanding roles and permissions | `getting-started/roles-and-permissions` | All | The 4 roles, clinical/admin firewall, what each can/cannot do | authz model, all dashboards | P2 |

#### Sessions & Signing (`sessions`)

| Title | Slug | Audience | Key topics | Documents | Priority |
|---|---|---|---|---|---|
| How to log and sign a supervision session | `sessions/log-and-sign-a-session` | Supervisor, Supervisee | Log supervision session, supervisor-first signing, intent confirmation, countersign, evidence seal | `/dashboard/roster/[id]`, `/sign/[sessionId]` | P1 |
| Scheduling supervision sessions | `sessions/scheduling-sessions` | Supervisor, HR Admin | One-off + recurring series, providers, conflict detection, cancel/reschedule/no-show | `/dashboard/calendar`, `/dashboard/roster/[id]` | P2 |
| AI-assisted session notes | `sessions/ai-session-notes` | Supervisor | Three input modes (paste, Teams/Meet fetch, in-person recording), no-PHI posture, editing, quota | `/sign/[sessionId]` | P2 |
| Supervision types and the clinical form | `sessions/supervision-types-and-clinical-form` | Supervisor | Supervision type field, RI clinical form (RI orgs only) | `/sign/[sessionId]` | P3 |
| Group and triadic sessions | `sessions/group-and-triadic-sessions` | Supervisor | Attendee picker, all-must-sign, group-size limits | `/dashboard/roster/[id]`, `/sign/[sessionId]` | P3 |

#### Practice Hours (`practice-hours`)

| Title | Slug | Audience | Key topics | Documents | Priority |
|---|---|---|---|---|---|
| Logging practice hours | `practice-hours/logging-practice-hours` | Supervisee, Supervisor | Log practice event, direct contact hours, practice state, pending-approval status | `/dashboard/roster/[id]` | P1 |
| Approving and rejecting practice hours | `practice-hours/approving-practice-hours` | Supervisor | Approval queue, batch approve, reject with reason, only approved hours count | `/dashboard/roster/[id]` | P1 |

#### State Rules & Compliance (`rules`)

| Title | Slug | Audience | Key topics | Documents | Priority |
|---|---|---|---|---|---|
| How state rules work | `rules/how-state-rules-work` | Supervisor, HR Admin | Canonical rules, checks + severity, evaluation, risk levels, citations | rules engine, `/dashboard/roster/[id]` | P1 |
| Understanding your compliance dashboard | `rules/understanding-compliance-status` | Supervisor, Supervisee | Green/yellow/red, progress bars, hour totals, at-risk flags | `/dashboard`, `/dashboard/roster`, `/dashboard/roster/[id]` | P1 |
| Compliance gaps and how to clear them | `rules/compliance-gaps-and-warnings` | Supervisor | The 5 gap action types (attestation, recurring, correction, accumulation, time warning) | `/dashboard/roster/[id]` | P2 |
| Assigning and attesting rules | `rules/assigning-and-attesting-rules` | Supervisor | Assign rule + obligation start, contract-filed / training / permit attestations | `/dashboard/roster/[id]` | P2 |
| Org rule overrides | `rules/creating-rule-overrides` | HR Admin | Tighten/loosen structured fields, add/remove/re-severity checks, severity-downgrade guardrail | `/dashboard/team/rules`, `/dashboard/team/rules/[id]` | P2 |
| Creating custom rules | `rules/creating-custom-rules` | HR Admin | Jurisdictions without canonical YAML, required citation, structured fields, checks | `/dashboard/team/rules/new` | P3 |
| Rule versions and drift | `rules/rule-versions-and-drift` | Supervisor, HR Admin | Version pinning, drift banner, upgrade, auto-apply preference | `/dashboard/roster/[id]`, `/dashboard/account` | P3 |
| State coverage reference | `rules/state-coverage` | All | The 10 states, license codes, boards; links to `/states/*` | `/states`, `rules/` | P2 |

#### Evidence Packages (`evidence`)

| Title | Slug | Audience | Key topics | Documents | Priority |
|---|---|---|---|---|---|
| Understanding evidence packages | `evidence/understanding-evidence-packages` | Supervisor, HR Admin, Supervisee | What's in a package, SHA-256 hash, when it's minted, PDF download | `/api/evidence/[id]`, `/sign/[sessionId]` | P2 |
| Verifying an evidence package | `evidence/verifying-a-package` | All (incl. external auditors) | Public verification page, hash check | `/marketing/verify/[id]` | P2 |
| The RI Clinical Supervision Form | `evidence/ri-clinical-form` | Supervisor (RI orgs) | 3-page RI template, when it applies, PDF template key | `/sign/[sessionId]`, `/api/evidence/[id]` | P3 |

#### Team & Roster (`team`)

| Title | Slug | Audience | Key topics | Documents | Priority |
|---|---|---|---|---|---|
| Managing your roster | `team/managing-your-roster` | Supervisor, HR Admin | Status badges, filters, search, pending invites, detail links | `/dashboard/roster` | P2 |
| Inviting your team | `team/inviting-team-members` | HR Admin, Supervisor | Invite supervisees (supervisor) vs any role (HR admin), 2FA on HR-admin invites, exec seat cap | `/dashboard/team`, `/dashboard/roster` | P2 |
| Reassigning supervisees | `team/reassigning-supervisees` | HR Admin | End/start assignment, transfer tracking | `/dashboard/team` | P3 |
| Leave status (on leave / PRN) | `team/leave-status` | HR Admin, Supervisor | active/on_leave/prn, cadence pause on leave, Paycor-set | `/dashboard/roster`, `/dashboard/team` | P3 |
| Bulk CSV import | `team/bulk-csv-import` | HR Admin | Paste/upload CSV, preview, validate, batch invite, skips | `/dashboard/team/import` | P3 |

#### Calendar & Integrations (`integrations`)

| Title | Slug | Audience | Key topics | Documents | Priority |
|---|---|---|---|---|---|
| Connecting your calendar | `integrations/connecting-your-calendar` | Supervisor, HR Admin, Supervisee | Microsoft (Teams/Outlook) + Google (Meet/Calendar) OAuth, set preferred, disconnect | `/dashboard/account` (#integrations) | P1 |
| Using the calendar | `integrations/using-the-calendar` | All | Week/month/list views, join URLs, statuses, reminders | `/dashboard/calendar` | P2 |
| Connecting Paycor | `integrations/connecting-paycor` | HR Admin | OAuth setup, manual sync, roster + leave sync, evidence SFTP delivery | `/dashboard/settings/integrations` | P3 |

#### Billing & Plans (`billing`)

| Title | Slug | Audience | Key topics | Documents | Priority |
|---|---|---|---|---|---|
| Plans and pricing | `billing/plans-and-pricing` | Supervisor, HR Admin | Solo / Practice / Enterprise, supervisee-free, AI quota, trial | `/dashboard/billing`, `/pricing` | P1 |
| Managing your subscription | `billing/managing-your-subscription` | Supervisor, HR Admin | Start trial, seat picker, Stripe portal, Solo→Practice upgrade | `/dashboard/billing` | P1 |
| Enterprise plans | `billing/enterprise` | HR Admin | Contract-managed, SOC 2 / BAA / CSM, provisioning | `/dashboard/billing` | P3 |

#### Account & Security (`account`)

| Title | Slug | Audience | Key topics | Documents | Priority |
|---|---|---|---|---|---|
| Securing your account with 2FA | `account/two-factor-authentication` | All | TOTP setup, QR, backup codes, disable, where 2FA is required | `/dashboard/account` | P1 |
| Managing your password and email | `account/password-and-email` | All | Password change, reset flow, email change + re-verify, sign out everywhere | `/dashboard/account`, `/forgot-password` | P1 |
| Your profile and credentials | `account/profile-and-credentials` | Supervisor | Display name, credentials list, training hours, snapshotting | `/dashboard/account` | P2 |
| Notification preferences | `account/notification-preferences` | All | Bell vs email, per-kind toggles, the 16 kinds | `/dashboard/account` | P2 |
| Closing your account | `account/deleting-your-account` | All | Soft delete, 30-day grace, session invalidation | `/dashboard/account` | P3 |

#### Audit Log (`audit-log`)

| Title | Slug | Audience | Key topics | Documents | Priority |
|---|---|---|---|---|---|
| Reading the audit log | `audit-log/reading-the-audit-log` | HR Admin, Executive, Supervisor | What's logged, columns, filters, recent-100 window | `/dashboard/audit-log` | P2 |
| Exporting and retaining the audit log | `audit-log/exporting-the-audit-log` | HR Admin, Executive | CSV/JSON export, 2FA gate (HR admin), retention 1-20 yrs | `/dashboard/audit-log`, `/dashboard/settings` | P2 |

Total: ~40 articles. P1 set (~14) satisfies the 8 stated writing priorities.

---

## 4. In-app help strategy

1. **Marketing nav.** Add a "Help" (or "Docs") link to the header nav in
   `src/app/marketing/layout.tsx` (no help link exists today) and to the footer.
2. **Dashboard help link.** Add a persistent Help link in the app shell (header/sidebar)
   pointing to `/docs`, opened in a new tab so the user's dashboard state on
   `app.audithalo.com` is not lost navigating to the marketing host.
3. **Contextual per-page help.** A small route → doc-slug lookup table drives a light
   help icon on key dashboard pages, deep-linking to the most relevant article (e.g.
   `/dashboard/team/rules` → `rules/creating-rule-overrides`), falling back to `/docs`.
4. **Inline tooltips linking to docs.** Deferred. No current signal it is needed; avoid
   the speculative surface. Revisit once real support questions reveal the hot spots.

Confusion → answer path: user sees Help in nav or a contextual icon → lands on `/docs`
index (Getting Started cards + category grid) or a deep-linked article → client-side
search covers everything else.

---

## 5. Phase 2 infrastructure (to be planned next, built after)

Deliverables, per the brief:
- `/docs` routes (index, category, article), layout with responsive sidebar grouped by
  category, breadcrumbs, prev/next within category.
- `src/lib/docs.ts` loader + docs frontmatter type.
- MDX rendering consistent with the blog's approach; brand design-system components.
- Reusable article template (title, last-updated, TOC for long articles, related
  articles, prereqs "What you'll need" block).
- Client-side full-text search.
- Schema markup: `Article` on articles, `HowTo` on step-based articles, `FAQPage` where
  an article carries an FAQ (reuse the blog's frontmatter-driven approach).
- Sitemap integration.
- In-app help links (nav + dashboard + contextual table).

Verification gate before any push: `npm run build`, `npm run lint`, `npm test`, and
exercise `/docs` in a browser. Git identity per `AGENTS.md`
(`emshoff-ebanks` / noreply). Push only after Caleb reviews the diff.

## 6. Phase 3 content (separate pass, after Phase 2 ships)

Write P1 articles first, then P2, then P3. Content rules per the brief and the brand book:
role-appropriate voice, no emoji, no AI writing tells, exact UI element names, real URL
paths, "What you'll need" prereqs, Related articles, per-role CAN/CANNOT clarity,
statutory claims cited to admin code, `[Screenshot: description]` markers. `rules`
articles run through the fact-integrity check (`docs/strategy/30`).
