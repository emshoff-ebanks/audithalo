# AuditHalo Design System

> The reference document for every UI decision. When in doubt about how something should look, behave, or feel, check here first.

**Brand voice (from `brand-book.md`):** Calm authority. Like a senior supervisor saying "You're covered. I've checked." Verb-first like Vanta, editorial like Alma, tonal restraint like Two Chairs.

**What this is NOT:** A component library. The components are in `src/components/`. This is the *rules* for how those components should look, what state they should communicate, and how they should behave.

---

## 1. Color System

### The brand palette (locked)

| Token | Hex | Used for |
|---|---|---|
| `background` | `#FAFAF7` | Page background (warm off-white) |
| `foreground` | `#0A1428` | Body text (deep navy-black) |
| `primary` | `#0F1F4C` | Headlines, navigation, primary CTAs |
| `secondary` | `#1D4ED8` | Links, interactive accents (halo blue) |
| `accent` | `#7BA098` | Subtle surfaces only (sage) |
| `gold` | `#B8860B` | Sealed/verified states only (signet gold) |
| `evidence-bg` | `#F5F1E8` | Evidence/document surfaces (warm oat) |

### The severity ladder (NEW — replaces single-color status)

The previous mistake was using one color per severity at the same perceptual lightness. The eye couldn't rank them. The fix: **fill vs. outline + always pair with an icon**.

| Level | Visual treatment | Use when |
|---|---|---|
| **OK / Compliant** | Small green dot (8px) + label, no badge background | Hours on track, signed, current |
| **Pending / Neutral** | Outlined pill, neutral grey | Awaiting action, not blocking |
| **Warning** | Outlined pill, amber border + amber icon | Cadence drift, approaching deadline |
| **Critical / At-risk** | **Solid filled pill**, white text, alert icon | Overdue, blocker check failed |
| **Blocking** | Solid red pill + 3px left border on the table row | License lapsed, missing contract |

**The rule:** Solid fills are reserved for items that need action *now*. Outlines mean "be aware." Dots mean "all good."

### Severity hex values

```css
/* OK / Compliant */
--ok-50:    #F0F4EE;   /* surface tint */
--ok-700:   #166534;   /* dot, text */

/* Warning */
--warn-50:  #FEF3E2;   /* surface tint */
--warn-500: #D97706;   /* icon, outlined badge border */
--warn-700: #B45309;   /* text on tint */

/* Critical / Risk */
--risk-50:  #FEE2E2;   /* surface tint */
--risk-600: #DC2626;   /* solid fill for pills */
--risk-700: #B91C1C;   /* hover state, dark text */
--risk-900: #7F1D1D;   /* blocking-tier solid fill */
```

All combinations are WCAG AA at minimum (text contrast ≥ 4.5:1 for normal, ≥ 3:1 for large). White on `#B91C1C` = 6.4:1. `#B45309` on `#FEF3E2` = 6.1:1.

### Color anti-patterns (do not do)

- ❌ Pure red `#FF0000` or saturated orange. Breaks "calm authority."
- ❌ Color as the *only* signal. Always pair with icon + label.
- ❌ Filling whole cards or banners with `#B91C1C`. Reserve solid fills for compact pills.
- ❌ Adding a fourth state color (purple, blue) for "info." Use neutral grey.
- ❌ Animated/pulsing red. Use only for genuine real-time alerts (none yet in product).
- ❌ Using gold (`#B8860B`) for anything other than sealed/verified evidence states.

---

## 2. Typography

### Type stack

- **Display**: Cabinet Grotesk Bold — headlines, hero, dashboard titles
- **Body**: IBM Plex Sans — paragraph text, labels, UI strings
- **Mono**: IBM Plex Mono — audit trails, timestamps, hashes, citations (anything that's a machine record)

### Scale

| Class | Size / Line | Use |
|---|---|---|
| `font-display text-6xl` | 60/1.05 | Marketing hero only |
| `font-display text-4xl` | 36/1.1 | Page titles (Dashboard, Roster, etc.) |
| `font-display text-3xl` | 30/1.15 | Section headings |
| `font-display text-2xl` | 24/1.2 | Card titles, subsection |
| `font-display text-xl` | 20/1.3 | Group headers |
| `text-base` | 16/1.5 | Body |
| `text-sm` | 14/1.5 | Secondary, tables |
| `text-xs` | 12/1.4 | Metadata, captions, footers |
| `label-overline` | 11/1.2 uppercase tracked | Field labels, card section headers |
| `font-mono text-xs` | 12/1.4 | Hashes, IDs, timestamps |

### Rules

- Sentence case in all headings. No title case. No all-caps except `.label-overline`.
- Em-dashes for asides — never two hyphens.
- No exclamation points. Anywhere. Brand-violation.
- Numbers in tables: `font-mono` for any numeric column with comparison purpose (hours, percentages, counts).

---

## 3. Spacing & Layout

### Spacing scale (Tailwind defaults — keep)

`px-3` (12px), `px-4` (16px), `px-6` (24px), `px-8` (32px), `py-12` (48px), `py-16` (64px), `py-20` (80px), `py-24` (96px).

### Container

- Max width: `max-w-6xl` (72rem / 1152px) for most pages
- Side padding: `px-6` mobile, scale to `px-8` on lg
- Vertical rhythm: sections separated by `border-t border-border` + `py-20 lg:py-24`

### Cards

- Border: 1px `border-border`
- Radius: 2-4px (sharp corners; brand uses `rounded-sm`)
- Padding: `p-6` standard, `p-8` for hero cards
- Shadow: **none**. Flat surfaces only.
- Background: `bg-card` (matches background or `#F5F1E8` evidence-bg for document-like surfaces)

### Grid

- 12-col default mental model, but use `grid-cols-1 lg:grid-cols-3` style explicit grids
- Gap: `gap-6` between cards, `gap-4` for tight metric grids, `gap-px bg-border` for "spreadsheet" tables

---

## 4. Loading States & Feedback

### Click feedback hierarchy

1. **Top progress bar** for route transitions — `nextjs-toploader` in `--ok-700` (green), 2px, no shadow, no spinner.
2. **Button spinner** for server actions — 200ms-deferred so fast actions don't flash. Button keeps width via `min-w-[N]`.
3. **`loading.tsx`** per route segment with skeleton matching destination layout.
4. **`useOptimistic`** for low-risk toggles (mark-as-read, dismiss notification).

### Button states

| State | Treatment |
|---|---|
| Default | Brand color, full opacity |
| Hover | Subtle brightness shift (Tailwind `hover:bg-primary/90`) |
| Active/Pressed | No bouncy animation — instant color shift |
| **Disabled (pending)** | `disabled:opacity-70 disabled:cursor-wait`. **Keep brand color.** |
| Disabled (unavailable) | `disabled:opacity-50 disabled:cursor-not-allowed`. |
| Destructive | Risk red (`bg-risk-600 text-white hover:bg-risk-700`) |

### Skeleton patterns

For tables: 3-5 placeholder rows with shimmer. For cards: match the actual card dimensions to prevent layout shift. Use shadcn `Skeleton` component.

### Anti-patterns

- ❌ Full-page modal spinner that blocks UI for a single-row action
- ❌ Greying out the button on disable (looks broken)
- ❌ Showing a spinner for actions < 200ms
- ❌ Button text width changing on state ("Save" → "Saving the changes now…")
- ❌ Top progress bar in shadcn-default blue when our brand is earth tones

---

## 5. Status Badges & Data Display

### Badge variants

```tsx
<Badge variant="ok">          {/* solid green dot + text */}
  <Circle className="h-2 w-2 fill-current" />
  Compliant
</Badge>

<Badge variant="outline-warn">  {/* outlined amber pill */}
  <AlertTriangle className="h-3 w-3" />
  Drift detected
</Badge>

<Badge variant="critical">     {/* SOLID red fill */}
  <AlertOctagon className="h-3 w-3" />
  Overdue 12d
</Badge>

<Badge variant="blocking">     {/* SOLID dark red + row border */}
  <ShieldAlert className="h-3 w-3" />
  License expired
</Badge>

<Badge variant="sealed">       {/* gold for evidence packages */}
  <FileSignature className="h-3 w-3" />
  Sealed
</Badge>
```

### Table row treatments

- Default row: white background, 1px bottom border
- Hover: `hover:bg-accent/40`
- Critical row: `border-l-[3px] border-l-risk-600 bg-risk-50/30`
- Blocking row: `border-l-[3px] border-l-risk-900 bg-risk-50/50`

### Progress bars

- Track: `h-2 bg-muted rounded-full`
- Fill: `bg-gold` for hour progress (signet gold = "this is the audit value")
- For at-risk progress where the supervisee is behind schedule: switch fill to `bg-warn-500`

### Metric/KPI cards (dashboard summary)

- Icon top-left, color matches state tone (success green if healthy, warn amber if attention needed, neutral if just informational)
- Number: `font-display text-3xl font-bold`, color matches state tone
- Label below: `text-sm text-foreground/60`
- Hover: `hover:bg-accent/40 cursor-pointer` when card links somewhere

---

## 6. Forms

### Input states

| State | Class |
|---|---|
| Default | `border-border bg-background` |
| Focus | `focus:ring-1 focus:ring-secondary focus:outline-none` |
| Error | `border-risk-600 focus:ring-risk-600` |
| Disabled | `bg-muted text-foreground/40 cursor-not-allowed` |

### Validation

- Inline below field, `text-xs text-risk-700`
- Server-action errors: show as a banner above the form, not a toast (compliance ops need persistent error messages)
- Required fields: don't mark with `*`. Mark optional fields with "(optional)" instead.

### Layout

- Labels above inputs, `text-sm font-medium`
- 12px gap between label and input
- 20px gap between fields
- Submit button right-aligned for short forms, full-width for mobile/single-purpose forms

---

## 7. Lists & Tables (the 3-Zone Pattern for long lists)

Standard pattern for any list > 25 items (session logs, audit trails, supervisee history):

```
┌──────────────────────────────────────────────────┐
│  ZONE 1: Needs your attention (N)                 │
│    pending items requiring action — top of page  │
├──────────────────────────────────────────────────┤
│  ZONE 2: Filter bar — All / Pending / Signed     │
│         Date: [Last 90d ▾]   (URL-state)         │
├──────────────────────────────────────────────────┤
│  ZONE 3: Grouped log (by month, accordion)        │
│    ▼ Current month — expanded                    │
│    ▶ Prior months — header w/ count + hours      │
└──────────────────────────────────────────────────┘
```

### Rules

- **No pagination** for audit data. Breaks Ctrl+F and audit screenshots.
- **No infinite scroll** for audit data. Same reasons + breaks mobile back-button.
- **Group by month** with `{count} sessions · {hours} hrs` in the accordion header
- **Filter state in URL** (`?status=pending&from=2026-03-01`) so views are bookmarkable
- **Current month expanded by default**; prior months collapsed but visible
- Older years grouped behind "2024 (12 months) ▶ Expand"

### Empty states

- Centered text, `text-foreground/50 text-sm`
- One-line action prompt: "No sessions yet. Log your first one →"
- Don't use illustrations or icons for empty states. Brand is restrained.

---

## 8. Modals & Overlays

### When to use a modal

- Confirming a destructive action (delete, revoke signature)
- A single short focused decision (assign rule, send invitation)

### When NOT to use a modal

- ❌ Logging a session — use inline form on the supervisee detail page
- ❌ Viewing an evidence package — use a dedicated page with shareable URL
- ❌ Anything with > 1 form section

### Modal styling

- Width: `max-w-md` for confirmation, `max-w-2xl` for form
- Backdrop: `bg-background/80 backdrop-blur-sm`
- Border: 1px `border-border`, 2-4px radius
- No drop shadow

---

## 9. Empty States, Error States, Edge Cases

### Empty roster

```
No supervisees yet — invite one to get started.
[Invite supervisee →]
```

### Empty session log

```
No sessions logged yet.
[Log first session →]
```

### Server error

Don't auto-retry. Show the error inline:
```
We couldn't load this. Refresh to try again — or contact info@audithalo.com if it keeps happening.
[Refresh]
```

### Loading error vs. permission error vs. not-found

- 404 (not in roster): "This supervisee isn't on your roster."
- 403 (wrong role): redirect, don't show error
- 500 (server): generic message + refresh button

---

## 10. Accessibility

### Minimums

- WCAG AA contrast for all text (4.5:1 normal, 3:1 large)
- All interactive elements keyboard-navigable
- Focus rings visible (`focus:ring-1 focus:ring-secondary`)
- `aria-label` on icon-only buttons
- Form fields have associated `<Label>` elements
- Color is never the only signal — always paired with icon or text

### Tested patterns

- All severity badges have an icon, so colorblind users get the signal
- Progress bars have numeric % next to them
- Table headers have `scope="col"` (Tailwind tables)

---

## 11. Motion

### Rules

- 150ms `transition-colors` on hover (default Tailwind)
- 200ms `transition-all` on layout changes (accordions, expand)
- No bounce. No spring physics. Linear or ease-in-out only.
- No autoplay video. No looping animations except the top progress bar.

### Allowed animations

- Top progress bar (route transitions)
- Spinner (button pending state, 200ms-deferred)
- Accordion open/close
- Modal fade-in (150ms)

### Disallowed

- ❌ Confetti
- ❌ Floating action button bounces
- ❌ Pulsing buttons (except real-time alert states that don't exist yet)
- ❌ Skeleton shimmer faster than 1.5s cycle

---

## 12. Compliance-Specific UI Patterns

These are domain-specific patterns for audit/compliance dashboards that don't apply to general SaaS.

### Evidence packages

- Always show the **document hash** (SHA-256) in mono font, truncated to 8-12 chars with full hash on hover
- "Sealed" badge in gold for finalized packages
- Download link always present, never hidden in a menu

### Citations

- State rule citations in mono font: `21 NCAC 53`
- Link to source: small text underneath, secondary color
- Last-verified date in mono font: `2026-06-01`

### Hour displays

- Always `font-mono` for numeric hour counts
- Format: `1,944.5h` (comma thousands, one decimal max)
- Progress bars next to the number for visual context

### At-risk supervisees (the "Needs Attention" pattern)

- Always pinned to the top of any list view
- Each item is a `<Link>` to the supervisee detail
- Show: name, what's at risk, how many days
- Background: `bg-warn-50/30 border-l-4 border-l-warn-500` for warning-tier
- Background: `bg-risk-50/30 border-l-4 border-l-risk-600` for critical-tier

---

## 13. Mobile / Responsive

### Breakpoints

- `sm`: 640px — phone landscape
- `md`: 768px — tablet portrait
- `lg`: 1024px — tablet landscape, small laptop
- `xl`: 1280px — desktop

### Mobile priorities

- Tables become cards (use `<table>` for desktop, `<div>` cards for mobile)
- Sidebar becomes hamburger menu (already implemented in marketing nav)
- KPI cards stack from 4-col to 2-col
- Forms always single-column on mobile

---

## 14. References

- Brand book: `docs/brand/brand-book.md`
- Brand voice guide: `docs/brand/brand-voice.md`
- SEO roadmap: `docs/strategy/seo-roadmap.md`
- Developer review methodology: `docs/developers.md`

---

## Changelog

- **2026-06-02**: Initial design system reference. Captures research findings on loading states, severity ladder, and 3-zone list pattern.
