# 25 — Website + App Redesign Master Prompt

> Copy the prompt section into a new Claude Code chat session.
> That session will implement the v2 design system across the
> marketing site first, then the app.

---

## The Prompt

```
I'm implementing a major visual redesign of AuditHalo — both the
marketing site (audithalo.com) and the app (app.audithalo.com).

Repo: C:\code\audithalo, branch main.
Stack: Next.js 16 (App Router), Tailwind 4, Vercel.

## Context files — read ALL of these before touching any code

1. AGENTS.md — runtime contract, git identity, authorization scope
2. docs/brand/design-system-v2.md — THE DESIGN SYSTEM. This is your
   bible for every visual decision. Read every section. It supersedes
   the old brand-book.md and the current globals.css.
3. docs/strategy/24-app-reference.md — complete product catalog
   (every route, feature, role, action). Use this to understand what
   every page does and what must NOT break.
4. docs/HANDOFF.md — product orientation, stack, common traps

## Critical rules

### 1. Preserve ALL existing logic and functionality
The design system doc contains EXAMPLE screenshots and descriptions
of how things should look. Some examples have inaccurate data or
simplified flows compared to what the app actually does. For example:
- The session note is described as having 4 fields (topics,
  competencies, feedback, next steps) — this is CORRECT
- But if any example shows 7 fields or different field names, the
  CODE is right, not the example
- The signing flow has supervisor-signs-first ordering — preserve it
- Practice hours require supervisor approval — preserve it
- All 16 notification types must continue working
- All server actions must continue working
- All role-based access control must continue working

When in doubt: the LOGIC stays, only the VISUALS change.

### 2. Work on a branch, not main
Create a branch called `redesign/v2` and do ALL work there.
Vercel automatically creates preview deployments for non-main branches.
After pushing, the preview URL will be something like:
  https://audithalo-git-redesign-v2-audit-helo.vercel.app

Share this URL with me after every push so I can review.
Do NOT merge to main until I explicitly approve.

### 3. Verify before every push
- npm run build must pass
- npm test must pass (535+ tests)
- Load the affected pages in a browser (npm run dev) and visually
  confirm they render correctly before pushing
- Check both marketing pages AND app pages

### 4. Marketing copy changes from v2
The design system locks specific copy rules (section 15):
- NEVER say "ten states", "10 states", etc. Use "your board",
  "every supported state", or "more boards, on request"
- Session note is "four fields" not "seven sections"
- Three value pillars: "Hours you can prove", "Your board, versioned",
  "No gaps. No surprises."
- Contact form fields are locked (read section 15.3)
- Add "Request a new state" CTA on every states section

## Phase 1: Token migration (do this first)

Before touching any component, migrate the CSS tokens:

1. Read current `src/app/globals.css` to understand existing tokens
2. Replace with the v2 token system from design-system-v2.md section 1-4:
   - --halo-yellow, --seal-gold
   - --ink-900 through --ink-100
   - --paper-white, --paper-50, --paper-100
   - --sage-500
   - --ok-*, --warn-*, --risk-*
   - --sp-* spacing scale
3. Create a token mapping from old names to new names
4. Update globals.css with the new tokens
5. DO NOT update components yet — just the tokens

After this phase: push, share preview URL, wait for my review.

## Phase 2: Marketing site redesign

Apply v2 to every marketing page. The marketing site is LIGHT-ONLY.

Pages to redesign (in order):
1. Layout (header nav + footer) — src/app/marketing/layout.tsx
2. Homepage — src/app/marketing/page.tsx
3. Features — src/app/marketing/features/page.tsx
4. For Supervisors — src/app/marketing/for-supervisors/page.tsx
5. For Group Practices — src/app/marketing/for-group-practices/page.tsx
6. States index + state detail pages
7. Pricing — src/app/marketing/pricing/page.tsx
8. Evidence Packages, Security, Contact, Founding
9. SEO content pages (clinical-supervision-software, etc.)

For each page:
- Apply the v2 color system (halo-yellow CTAs, warm paper ground,
  ink text colors, no navy, no halo-blue)
- Apply the surface system (Ground > Panel > Content, 14px radius,
  no shadows)
- Apply typography rules (Cabinet Grotesk display, IBM Plex body)
- Update copy per section 15 (no "10 states", correct value pillars,
  correct contact form fields)
- Preserve all existing images in public/images/
- Keep all existing SEO metadata, structured data, sitemap

After this phase: push, share preview URL, wait for my review.

## Phase 3: App redesign

Apply v2 to every app page. The app gets BOTH light and dark mode.

Key app pages (in order):
1. App layout (nav bar, notification bell)
2. Supervisor dashboard
3. Roster page
4. Supervisee detail page (the most complex page)
5. Sign page (signing flow, AI notes, transcript, recording)
6. Calendar
7. Team management + rules admin
8. Billing
9. Account settings
10. Audit log
11. Executive dashboard

For each page:
- Apply v2 tokens
- Apply the surface system (three layers, 14px radius, no nesting)
- Apply badge variants from section 7.1
- Apply the 3-zone pattern for lists (section 9)
- Apply form styling from section 8
- Preserve ALL functionality — every button, action, permission check
- Test that the page works (not just looks right)

Dark mode implementation:
- Use CSS custom properties that switch on a dark class or media query
- Follow the dark mode tokens from section 3 (ink-900 ground,
  ink-800 panels, rgba overlays)
- Marketing site stays light-only (section 3.2)

After this phase: push, share preview URL, wait for my review.

## Phase 4: Polish and QA

- Run Lighthouse on the marketing homepage and fix any regressions
- Verify all marketing images still display
- Test the full signing flow end-to-end
- Test the recording flow
- Test practice hour approval
- Verify all notification bell messages render
- Check mobile responsiveness on key pages
- Verify the design system's anti-patterns are not present (section 1.4,
  5.3, 6.4, 10.2, 14.3)

## What I will provide
- Approval/rejection after each phase's preview
- Specific feedback on what to change
- Screenshots of issues I spot

## What to do when the design doc and the code disagree
- If the design doc describes VISUAL STYLING: the design doc wins
- If the design doc describes APP LOGIC or DATA: the existing code wins
- If the design doc uses example data that differs from real data:
  the real data/schema wins
- When in doubt, ask me before changing logic
```
