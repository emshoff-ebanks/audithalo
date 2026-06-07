# Capturing marketing screenshots

Runs Playwright against the local dev server, signs in as the demo accounts,
and outputs PNGs at 1440×900 (desktop) and 390×844 (iPhone-ish mobile).

## One-time setup

```bash
npm install -D playwright
npx playwright install chromium
```

That downloads Chromium (~150 MB) into your local Playwright cache. It only
needs to happen once per machine.

## Each capture run

1. Make sure the demo org exists:

   ```bash
   npm run seed:demo
   ```

   This is idempotent — it clears any prior `demo-*@audithalo.com` users +
   `NC Counseling Demo Practice` org and recreates them, so the data is
   always polished. **Heads up:** the seed runs against whatever DB your
   `.env.local` points at, which is prod. The demo accounts live alongside
   real customer data without touching it.

2. Start the dev server in one terminal:

   ```bash
   npm run dev
   ```

3. In another terminal:

   ```bash
   npm run screenshots
   ```

PNGs land in `./screenshots/` (gitignored). Total run: ~30 seconds.

## What gets captured

| File | Page | Notes |
|---|---|---|
| `desktop-supervisor-dashboard.png` | `/dashboard` as Dr. Alex Rivera | Headline dashboard — onboarding checklist + summary cards + at-risk panel |
| `desktop-supervisor-roster.png` | `/dashboard/roster` | Full table view, 3 supervisees at green / yellow / red |
| `desktop-supervisee-detail-jamie.png` | `/dashboard/roster/<jamie>` | Jamie at 65% — most photogenic. Has pre-seeded AI session note. |
| `desktop-supervisee-detail-morgan.png` | `/dashboard/roster/<morgan>` | Morgan at 15% — at-risk red flag (urgency narrative) |
| `desktop-supervisee-detail-riley.png` | `/dashboard/roster/<riley>` | Riley at 95% — near-ready-to-license |
| `desktop-supervisor-account.png` | `/dashboard/account` | Anchor-nav layout + training hours badge |
| `desktop-supervisor-billing.png` | `/dashboard/billing` | Pricing tiers + seat picker (Phase 7-B) |
| `desktop-supervisor-audit-log.png` | `/dashboard/audit-log` | The audit trail — proof of "everything is recorded" |
| `desktop-supervisee-jamie-dashboard.png` | `/dashboard` as Jamie Chen | Supervisee's own view of their progress |
| `desktop-supervisee-riley-dashboard.png` | `/dashboard` as Riley Park | Same view, near-ready cohort |
| `mobile-*.png` | Same set at 390×844 | iPhone-ish width — proves the responsive work |

## Custom runs

Hit a Vercel preview deploy instead of localhost:

```bash
APP_URL=https://audithalo-git-feat-foo-audit-helo.vercel.app npm run screenshots
```

Just the supervisor pass on desktop? Open `scripts/marketing-screenshots.ts`
and comment out the calls you don't want at the bottom of `main()`.

## Caveats

- **Dates are real-time.** "3 days ago" labels move every time you re-seed.
  For evergreen marketing copy, prefer screenshots of static elements
  (cards, layouts) over scrolling timeline shots.
- **Demo emails are visible.** They're obviously fake (`demo-supervisor@…`)
  but if you'd rather they not show in a Capterra screenshot, mask them in
  Figma after capture.
- **PDF / evidence package not captured by the script.** Playwright can't
  render PDFs inline; for evidence package shots, open
  `https://app.audithalo.com/api/evidence/<id>` in Chrome and screenshot
  page 1 manually, or convert via `pdftoppm` after downloading.
