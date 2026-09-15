# v2 Redesign — Handoff / Review Prompt (for a fresh session)

**Paste everything below the line into a new session.** It is self-contained.

---

You are finishing a **dramatic visual redesign** of the AuditHalo marketing site on
branch `redesign/v2` (repo `C:\code\audithalo`, Next.js 16 App Router, Tailwind 4,
deployed on Vercel). A previous session did a first pass but was **too incremental** —
it recolored the old layouts with new tokens instead of rebuilding pages to match the
design. Your job is to make the whole site **actually look like the design**, not a
recolored version of the old site.

## Mandate (read twice)
- This is NOT production and NOT a cautious migration. Change things boldly.
- Stick **close to the design**. Sources, in priority order:
  1. `docs/brand/design-system-v2.md` — the rules (tokens, surfaces, type, components).
  2. The HTML mockups at `C:\Users\Caleb\Documents\Extra\AuditHalo\AuditHalo Design System\`
     — `index.html` (foundations), `app.html` (app components), `marketing.html`
     (marketing), plus `tokens.css`, `styles.css`, `marketing.css`, `app.css`. These show
     exactly how components should look. Read `marketing.css` for the real component specs.
- For any element **not** explicitly in the mockup: design it in the same visual
  language (warm paper ground, ink text, 14px panels, halo-yellow CTAs, seal-gold for
  sealed evidence only, mono for machine data, embossed numerals, etc.) so it matches.

## Work method (do NOT skip — the last session's mistake was working blind)
1. `npm run dev` (marketing renders at http://localhost:3000).
2. Screenshot every page with Playwright and LOOK at each one (a script exists at
   `scripts/tmp/shots.mjs`; extend it). Compare each to `marketing.html`.
3. For every page that still reads like the old site, **recompose it to the mockup** —
   don't just swap colors. Verify by re-screenshotting.
4. `npm run build` must pass; `npm test` must stay green (551 tests).
5. Commit in meaningful chunks and push to `redesign/v2` (see Git rules below).

## Known-weak pages to rebuild (verify all, but start here)
- `/docs` **index** and the docs shell — build the mockup's docs layout (§09 of
  `marketing.html`): sidebar TOC · article on a white document surface · **on-this-page
  rail** (extract MDX headings). Currently only recolored. This is the top complaint.
- `/blog` and blog post — make them match the mockup, not just recolored cards.
- `for-supervisors` / `for-group-practices` — still embed **old navy app screenshots**;
  remove or replace (no pre-redesign UI on the new site).
- Sweep the rest for old-DOM-recolored patterns and recompose.

## Already built (reuse these — don't reinvent)
- Tokens + dark-mode block: `src/app/globals.css` (v2 warm-neutral system; `.panel*`,
  `.mkt-marquee`, `.mkt-hl`, `.mkt-num-emboss`, `.mkt-quote-mark`, `.mkt-faq-*`).
- Shared components: `src/components/marketing/seal-medallion.tsx`,
  `state-marquee.tsx`, `verify-search.tsx`; primitives `ui/button`, `ui/badge`
  (variants: ok, outline-warn, critical, blocking, sealed, ai), `ui/card`, `ui/input`.
- Homepage (`src/app/marketing/page.tsx`) is the **reference** for the true design
  (hero proof card, marquee, embossed 3-step, deep-dive rows, testimonial, footer CTA).
- Marketing layout has the dark v2 footer. Public verify page is built + wired to real
  hash verification (`src/app/marketing/verify/[packageId]/page.tsx`, `/verify`).

## Hard rules (from AGENTS.md — do not violate)
- **Git identity:** `user.name=emshoff-ebanks`,
  `user.email=228783329+emshoff-ebanks@users.noreply.github.com`. Never any other.
- **Never** run anything against prod Neon (no `db:push`, no raw SQL writes). DB reads
  need a heads-up first.
- **§15 copy locks:** never "10 states"/"ten states"/"all 10" (use "your board" / state
  names / "every supported state"); session note is **four fields** (topics,
  competencies, feedback, next steps), never "seven sections"; every states section
  carries a **"Request a new state"** CTA to `/contact`; contact form fields + Topic
  options are locked (design-system-v2.md §15.3).
- **Content integrity:** do NOT fabricate testimonials, customer names/logos, or
  aggregate stats ("14,832 sealed"). Placeholders must be clearly marked.
- **Preserve SEO:** don't change `metadata`, JSON-LD, `<h1>` wording, `alt`, `href`s, or
  form field names/actions — only visuals (+ the §15 locks).
- Marketing is **light-only**; dark mode is app-only (Phase 3, not this task).

## Deploy troubleshooting (unresolved)
Homepage shows new design but docs shows old on the same branch-preview URL — likely the
branch alias is serving an older "Ready" build because a later build failed/queued. Check
Vercel dashboard → `audithalo` → Deployments → branch `redesign/v2` → latest commit's
status. If **Error**, read the build logs and fix (local `next build` passes with
`.env.local`, so suspect an env/build-only failure). The claude.ai Vercel connector
currently 403s on the `audit-helo` team — re-auth it to inspect deploys from chat.

## Definition of done
Every marketing page (home, features, pricing, states + per-state, for-supervisors,
for-group-practices, evidence-packages, security, contact, founding, all SEO/
`*-supervision-requirements` pages, docs index + article, blog index + post, verify)
visibly matches the v2 mockups — screenshot-verified — with build + tests green and the
branch pushed.
