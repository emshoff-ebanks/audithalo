# App Redesign (Phase 3) — Prompt for a fresh session

**Paste everything below the line into a new session.** It is self-contained.

---

You are redesigning the **AuditHalo app** (`app.audithalo.com`, routes under
`src/app/app/`) to the v2 visual design, in **light AND dark mode**, on a preview
branch. Repo: `C:\code\audithalo`, Next.js 16 App Router, Tailwind 4, Vercel. The
marketing site was already redesigned to v2 on branch `redesign/v2` — reuse that
foundation. **Read `AGENTS.md` first** (runtime contract).

## Lessons from the marketing round — do NOT repeat these
1. **Don't work blind.** The #1 mistake was writing CSS/JSX without ever rendering it,
   so broken things (empty-image panels, off-brand screenshots) shipped unnoticed.
   **Run the app and screenshot every page; look at each one before calling it done.**
2. **Don't do a timid recolor.** The other mistake was swapping tokens on the old DOM
   instead of recomposing pages to the design. **Rebuild to `app.html` + the design
   system.** For elements not in the mockup, design them in the same v2 language.
3. **Verify the deploy, not just the push.** A push is not a live change. Confirm the
   Vercel build actually **succeeded** and the preview shows your work; if a build
   fails on Vercel but passes locally, investigate immediately (env/build-only issues).
4. **Be careful with parallel subagents.** Last round the write/permission channel
   intermittently died ("Stream closed"), and agents that couldn't persist returned
   code that had to be hand-applied. Prefer doing load-bearing work in the main session,
   commit frequently, and confirm each agent actually wrote its files.
5. **Never ship fabricated data.** Design mockups contain fake names/stats — the app
   renders REAL data; preserve it and never invent numbers/records.
6. **Keep context lean.** This is a fresh session on purpose; stay focused on the app.

## Mandate
Visually redesign every app screen to v2 (three-layer surfaces, 14px panels, halo-yellow
CTAs, seal-gold for sealed evidence only, ink/paper neutrals, mono for machine data,
Lucide 2px icons). **Preserve 100% of functionality** — this is a live-ish product with
real logic. Add **dark mode** (app-only).

## Design sources (stick close to them)
- `docs/brand/design-system-v2.md` — especially §3 surfaces, §5 icons, §6 loading/feedback,
  §7 badges/tables/KPI panels, §8 forms, §9 the 3-zone list pattern, §10 modals,
  §11 the AI-assist pattern (yellow-bordered surfaces + Sparkles chip), §12 compliance UI
  (evidence packages, citations, hour displays, at-risk/"Needs attention", the four-field
  Session Note editor, the signing flow), §13 accessibility, §14 motion, §16 responsive.
- HTML mockups at `C:\Users\Caleb\Documents\Extra\AuditHalo\AuditHalo Design System\` —
  `app.html` is the app reference (shell = sidebar + header + main-canvas as panels on the
  ground, stat/KPI cards, roster table, status pills, badges). Also `tokens.css`,
  `styles.css`, `app.css`. Read them for exact component specs.
- The redesigned marketing components on `redesign/v2` are the polish reference.

## PRESERVE ALL LOGIC — non-negotiable
- **Read `docs/strategy/24-app-reference.md`** — it catalogs every route, role, server
  action, and the 16 notification types. Nothing there may break.
- Keep intact: the 4 roles + RBAC (`src/lib/authz.ts`), every server action
  (`src/app/actions/*`), the signing flow's supervisor-first ordering
  (`src/lib/sign-permissions.ts`), practice-hour approval, the rules engine + evaluator,
  evidence sealing/hashing (`src/lib/evidence.ts`), calendar/scheduling, billing (Stripe),
  audit log, executive dashboard, admin routes, notifications.
- **Visual changes only.** Do not alter data flow, permission checks, server-action
  signatures, form `name=` attributes, or route params.

## Dark mode (new for the app)
- The v2 tokens + a `.dark` block already exist in `src/app/globals.css`. Wire a theme
  toggle (a `dark` class on `<html>`), persist the choice, and **verify every app page in
  BOTH modes**. Marketing stays light-only.

## Work method (screenshot-driven — solve app rendering FIRST)
- `npm run dev`. The proxy maps the `app.*` host to `/app/*`; locally you can hit the raw
  routes at `localhost:3000/app/...` (or `app.localhost:3000`). Figure out app routing +
  **authenticated** rendering before anything else.
- To screenshot signed-in pages you need a session per role. Options: `npm run seed:demo`
  seeds the **Atlas Counseling Group** demo org (Emily/Marcus/Sofia/David + HR Admin Maria,
  Supervisor James, Exec Robert), then log in; or reuse the Playwright auth in `e2e/`.
  **CAUTION: dev and prod share the same Neon DB (HANDOFF §12).** Do not mutate prod — check
  which DB `DATABASE_URL` points at and get a heads-up before seeding/writing.
- Screenshot each app page in light + dark, compare to `app.html`, rebuild, re-verify.
- `npm run build` and `npm test` (551 tests) must stay green throughout.

## Pages to redesign (in order)
App layout (sidebar nav + notification bell) → supervisor dashboard → roster →
supervisee detail (most complex: rule assignment, hour bars, gaps, session log, evidence
packages, attestations) → sign page (`/sign/[id]`: pre/post-meeting, AI note, transcript,
recording, sign-and-seal, clinical form) → calendar → team + rules admin → billing →
account settings → audit log → executive dashboard → admin routes.
Apply badge variants (§7.1), the 3-zone list pattern (§9), form styling (§8), KPI/hero-stat
panels (§7.4, one halo-yellow hero stat per screen), the AI-assist pattern (§11), and the
evidence/seal treatments (§12).

## Guardrails (from AGENTS.md)
- Git identity **must** be `emshoff-ebanks`
  (`228783329+emshoff-ebanks@users.noreply.github.com`). The repo credential hint is set,
  so pushes shouldn't prompt for an account.
- **Never** touch prod Neon (no `db:push`, no raw SQL writes, no migrations without an
  explicit yes). DB reads: give a heads-up.
- Branch from `redesign/v2` (to inherit the v2 tokens/components), e.g. `redesign/app-v2`.
  Build + test before each push. Share the preview URL after pushing.
- Accessibility: WCAG AA, keyboard-navigable, focus rings `halo-yellow`, color never the
  only signal. No fabricated data.

## Definition of done
Every app screen in `24-app-reference.md` matches the v2 design in **light and dark**,
every role/action/permission still works, `npm run build` + `npm test` pass, and the
branch is pushed with a verified preview.
