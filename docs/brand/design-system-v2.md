# AuditHalo Design System

> The reference document for every UI decision. When Claude Code, an engineer, or a subagent is unsure how something should look, behave, or feel, this file wins over ad-hoc precedent and over older sibling docs. If this file and a code file disagree, the code is out of date — open an issue or a PR.

**Status**: v2 — locked 2026-09-14 in the [AuditHalo Design System preview](https://www.perplexity.ai/computer/a/audithalo-design-system-PjKMNt.eTrS6w3banurzFw) (Foundations + App Components + Marketing). This supersedes the v1 (navy `#071A3D` / halo-blue) palette that still appears in `docs/brand/brand-book.md §4` and in `src/app/globals.css`. Rolling the codebase forward is a separate, planned change — flagged in §15.

**Brand voice (unchanged from `brand-book.md`):** Calm authority. Like a senior supervisor saying "You're covered. I've checked." Verb-first like Vanta, editorial like Alma, tonal restraint like Two Chairs.

**What this is NOT:** A component library. The React components live in `src/components/`. This document is the *rules* — what those components should look like, what state they should communicate, and how they should behave.

---

## 1. Color System

### 1.1 The two-yellow rule (locked)

AuditHalo has **two yellows and only two yellows**. They are not interchangeable.

| Token | Hex | Reserved for |
|---|---|---|
| `--halo-yellow` | `#FFD60A` | Primary CTAs, active nav pill, sparkles/AI chip on light surfaces, key stat callouts |
| `--seal-gold` | `#B8860B` | Sealed / verified evidence only — badges, seal stamps, "Sealed & Verified" pills, evidence-package chrome |

**The rule:** Halo yellow says *do this*. Seal gold says *this is proof*. Never use seal gold on a CTA. Never use halo yellow on a sealed-evidence badge. The two colors must never appear inside the same panel unless the panel is genuinely mixing action + evidence (rare — flag in PR review).

### 1.2 Warm-neutral ground (locked)

The whole product runs on a warm off-white ground with a near-black text color. No cool greys. No blue-tinted whites.

| Token | Hex | Used for |
|---|---|---|
| `--ink-900` | `#0E0E0C` | Body text, headlines, dark-mode ground |
| `--ink-800` | `#1F1F1B` | Dark-mode surfaces (panels on ink-900 ground) |
| `--ink-600` | `#4A4A44` | Secondary text, uppercase labels |
| `--ink-400` | `#8A8A82` | Placeholders, muted metadata |
| `--ink-200` | `#D8D4C6` | Panel borders, table dividers on paper |
| `--ink-100` | `#E8E4D6` | Inner dividers, subtle strokes |
| `--paper-white` | `#FFFFFF` | Input fields, doc surfaces inside panels |
| `--paper-50`   | `#FAF7F0` | Marketing page ground, dashboard ground |
| `--paper-100`  | `#F5F1E6` | Panel background, evidence surfaces, table zebra |
| `--sage-500`   | `#5F8F86` | Sage accent — supervisee-care moments, illustrations, "in progress" ticks. **Never on CTAs.** |

### 1.3 The severity ladder (kept from v1, retuned to new ground)

Solid fills are reserved for items that need action *now*. Outlines mean *be aware*. Dots mean *all good*. Color is never the only signal — every state pairs with a Lucide icon and a text label.

| Level | Visual treatment | Use when |
|---|---|---|
| **OK / Compliant** | Small green dot (8px) + label, no badge background | Hours on track, signed, current |
| **Pending / Neutral** | Outlined pill, `--ink-200` border, `--ink-600` text | Awaiting action, not blocking |
| **Warning** | Outlined pill, `--warn-500` border + Lucide `AlertTriangle` | Cadence drift, approaching deadline |
| **Critical / At-risk** | **Solid filled pill**, white text, Lucide `AlertOctagon` | Overdue, blocker check failed |
| **Blocking** | Solid `--risk-900` pill + 3px left border on the table row | License lapsed, missing contract |

```css
/* OK / Compliant */
--ok-50:    #F0F4EE;
--ok-700:   #166534;

/* Warning */
--warn-50:  #FEF3E2;
--warn-500: #D97706;
--warn-700: #B45309;

/* Critical / Risk */
--risk-50:  #FEE2E2;
--risk-600: #DC2626;
--risk-700: #B91C1C;
--risk-900: #7F1D1D;
```

All combinations meet WCAG AA (text contrast ≥ 4.5:1 normal, ≥ 3:1 large).

### 1.4 Color anti-patterns

- ❌ Pure red `#FF0000`, saturated orange, or emerald green. Breaks *calm authority*.
- ❌ Color as the only signal — always pair with a Lucide icon and a text label.
- ❌ Filling a whole card or banner with `--risk-600`. Reserve solid fills for compact pills.
- ❌ A fourth state color (purple, blue) for "info." Use neutral ink-600 on paper-100.
- ❌ Animated / pulsing red. Only for genuine real-time alerts, of which there are currently none.
- ❌ **Halo yellow on a sealed evidence badge.** Use seal gold. Always.
- ❌ **Seal gold on a CTA.** Use halo yellow. Always.
- ❌ Sage as a CTA color.

---

## 2. Typography

### 2.1 Type stack (locked)

- **Display**: Cabinet Grotesk Bold — marketing headlines, dashboard page titles, panel titles that need weight
- **Body**: IBM Plex Sans — every paragraph, label, UI string
- **Mono**: IBM Plex Mono — audit trails, timestamps, SHA-256 hashes, citations, rule versions, IDs — anything that reads as a machine record
- **Accessibility alternate**: Atkinson Hyperlegible — offered as a user-toggleable body-font override in app settings (Braille Institute-validated for low-vision readability)

Cabinet Grotesk is Fontshare-hosted (free). A Söhne migration is planned once a first paid customer + designer engagement lands — see `brand-book.md §5`. Until then, do not swap the display face.

### 2.2 Scale

| Class | Size / Line | Use |
|---|---|---|
| `font-display text-6xl` | 60/1.05 | Marketing hero only |
| `font-display text-4xl` | 36/1.1 | Page titles (Dashboard, Roster, Session Note, etc.) |
| `font-display text-3xl` | 30/1.15 | Section headings |
| `font-display text-2xl` | 24/1.2 | Card titles, subsection |
| `font-display text-xl`  | 20/1.3 | Group headers |
| `text-base` | 16/1.5 | Body |
| `text-sm`   | 14/1.5 | Secondary, tables |
| `text-xs`   | 12/1.4 | Metadata, captions, footers |
| `label-overline` | 11/1.2 uppercase, tracked 0.06em | Field labels, panel section headers |
| `font-mono text-xs` | 12/1.4 | Hashes, IDs, timestamps, rule versions |

### 2.3 Rules

- Sentence case in all headings. No Title Case. No all-caps outside `.label-overline`.
- Em-dashes for asides — never two hyphens.
- No exclamation points. Anywhere. Brand violation.
- Numbers in tables get `font-mono` when the column has comparison purpose (hours, percentages, counts, cycle progress).
- Numeric denominators in fractions (`92 / 100`) render in `--ink-400` on light, `rgba(250,247,240,0.55)` on dark, with the numerator in the surface foreground color.

---

## 3. Surface System — Three Layers

Every screen composes from exactly **three surface layers**. Never nest panels.

```
Ground → Panel → Content
```

| Layer | Light mode | Dark mode | Purpose |
|---|---|---|---|
| **Ground** | `--paper-50` `#FAF7F0` | `--ink-900` `#0E0E0C` | Page background |
| **Panel** | `--paper-100` `#F5F1E6`, 14px radius, 1px `--ink-200` border | `--ink-800` `#1F1F1B`, 14px radius, 1px `rgba(250,247,240,0.10)` border | Grouping container |
| **Content** | `--paper-white` `#FFFFFF` for inputs / doc surfaces inside a panel | `rgba(250,247,240,0.04)` for the same | Editable / interactive surface |

### 3.1 Panel rules

- **14px border radius**. Not 12, not 16.
- **No drop shadows.** Flat surfaces only.
- **No panel-in-panel.** If content needs internal grouping, use `.panel-inner` (subtle border, no fill) or a divider. Nesting a second Panel is a review-blocker.
- **Panel title** (`.shell-panel-title`): `padding var(--sp-4) var(--sp-5)`, 1px bottom border (`--ink-200` light, `rgba(250,247,240,0.10)` dark), h4 in `--ink-900` (light) / `--paper-50` (dark).
- **Flush panels** (`.panel-flush`): `padding: 0; overflow: hidden;` — for panels whose only child is a table or media block that manages its own padding.

### 3.2 Dark mode scope

Dark mode is **app-only**. The marketing site is light-only, permanently. This is a deliberate audience signal — marketing serves buyers evaluating trust; the app serves clinicians who work at night.

---

## 4. Spacing & Layout

### 4.1 Spacing scale (locked tokens)

```css
--sp-1: 4px;   --sp-2: 8px;    --sp-3: 12px;
--sp-4: 16px;  --sp-5: 20px;   --sp-6: 24px;
--sp-7: 28px;  --sp-8: 32px;   --sp-9: 40px;
--sp-10: 48px; --sp-12: 64px;  --sp-14: 80px;  --sp-16: 96px;
```

Tailwind users: `--sp-N` maps roughly to `p-{N-1}` etc., but authoring against the tokens is preferred for anything the design system owns.

### 4.2 Container

- Max width: `max-w-6xl` (72rem / 1152px) for most pages
- Side padding: `px-6` mobile, scaling to `px-8` on `lg`
- Vertical rhythm: sections separated by `border-t border-[color:var(--ink-200)]` + `py-20 lg:py-24`

### 4.3 Grid

- 12-col mental model, but always spell out the columns: `grid-cols-1 lg:grid-cols-3`
- Gaps: `gap-6` between panels, `gap-4` for tight metric grids, `gap-px bg-[color:var(--ink-200)]` for spreadsheet-style tables

---

## 5. Icons

### 5.1 The icon system (locked)

- **Library**: Lucide. Only Lucide.
- **Weight**: 2px stroke.
- **Joins**: `stroke-linecap="round"`, `stroke-linejoin="round"`.
- **Color**: `currentColor`. Never hard-code a hex on an icon path.
- **One concept per icon.** Do not stack a shield behind a checkmark to mean "sealed and verified." Pick one — the pair is a compound signal, not an icon.

### 5.2 Reserved icon → color mappings

| Icon | Color | Meaning |
|---|---|---|
| Lucide `Sparkles` | `--halo-yellow` on light surfaces | AI-generated or AI-assisted content |
| Lucide `ShieldCheck` (or the seal SVG) | `--seal-gold` | Sealed / verified evidence — never for anything else |
| Lucide `AlertTriangle` | `--warn-500` | Warning-tier severity |
| Lucide `AlertOctagon` | `--risk-600` (on solid pill) | Critical / at-risk severity |
| Lucide `Clock` | `--ink-600` on light, `--paper-50` on dark | Hours, cycles, time (never a `$` icon — see §1.4) |

### 5.3 Anti-patterns

- ❌ Heroicons, Feather, Phosphor, or Font Awesome. Lucide only.
- ❌ Filled Lucide variants — always stroked, 2px.
- ❌ Icons with hard-coded fills. Always `currentColor`.
- ❌ Sparkles in seal gold, or a Seal glyph in halo yellow.
- ❌ Two icons stacked to mean one concept.

---

## 6. Loading States & Feedback

### 6.1 Click feedback hierarchy

1. **Top progress bar** for route transitions — `nextjs-toploader` in `--ok-700`, 2px, no shadow, no spinner.
2. **Button spinner** for server actions — 200ms-deferred so fast actions don't flash. Button keeps width via `min-w-[N]`.
3. **`loading.tsx`** per route segment with a skeleton matching the destination layout.
4. **`useOptimistic`** for low-risk toggles (mark-as-read, dismiss notification).

### 6.2 Button states

| State | Treatment |
|---|---|
| Default | Halo yellow fill (`--halo-yellow`), `--ink-900` text |
| Hover | Slight brightness shift (`hover:bg-[color:var(--halo-yellow)]/90`) |
| Active / Pressed | Instant color shift, no bounce, no spring |
| **Disabled (pending)** | `disabled:opacity-70 disabled:cursor-wait`. **Keep halo yellow.** |
| Disabled (unavailable) | `disabled:opacity-50 disabled:cursor-not-allowed` |
| Secondary | Ghost — transparent fill, `--ink-900` text, no border, underline on hover |
| Destructive | `bg-[color:var(--risk-600)] text-white hover:bg-[color:var(--risk-700)]` |

### 6.3 Skeleton patterns

Tables: 3–5 placeholder rows with a slow shimmer (≥ 1.5s cycle). Panels: match the actual panel dimensions to prevent layout shift. Use the shadcn `Skeleton` primitive.

### 6.4 Anti-patterns

- ❌ Full-page modal spinner blocking UI for a single-row action
- ❌ Greying out the button on disable (looks broken)
- ❌ Spinner for actions < 200ms
- ❌ Button text width changing on state (`Save` → `Saving the changes now…`)
- ❌ Top progress bar in shadcn-default blue

---

## 7. Status Badges & Data Display

### 7.1 Badge variants

```tsx
<Badge variant="ok">                {/* solid green dot + text */}
  <Circle className="h-2 w-2 fill-current" />
  Compliant
</Badge>

<Badge variant="outline-warn">      {/* outlined amber pill */}
  <AlertTriangle className="h-3 w-3" />
  Drift detected
</Badge>

<Badge variant="critical">          {/* SOLID red fill */}
  <AlertOctagon className="h-3 w-3" />
  Overdue 12d
</Badge>

<Badge variant="blocking">          {/* SOLID dark red + row border */}
  <ShieldAlert className="h-3 w-3" />
  License expired
</Badge>

<Badge variant="sealed">            {/* seal gold — evidence packages only */}
  <FileSignature className="h-3 w-3" />
  Sealed
</Badge>

<Badge variant="ai">                {/* halo yellow + Sparkles — on light surfaces only */}
  <Sparkles className="h-3 w-3" />
  AI
</Badge>
```

### 7.2 Table row treatments

- Default row: paper-white background, 1px `--ink-100` bottom border
- Hover (light): `hover:bg-[color:var(--paper-100)]`
- Hover (dark): `hover:bg-[rgba(250,247,240,0.04)]`
- Critical row: `border-l-[3px] border-l-[color:var(--risk-600)] bg-[color:var(--risk-50)]/30`
- Blocking row: `border-l-[3px] border-l-[color:var(--risk-900)] bg-[color:var(--risk-50)]/50`
- **At-risk (warn) row**: `background: rgba(255, 214, 10, 0.06)` — subtle halo-yellow tint. Do not use `--warn-500` as a row tint; the yellow tint is the roster convention.

### 7.3 Progress bars

- Track: `h-2 bg-[color:var(--ink-100)] rounded-full` (light) / `bg-[rgba(250,247,240,0.12)]` (dark)
- Fill: `--seal-gold` for cycle hour progress ("this is the audit value")
- At-risk fill: `--warn-500`
- Always render the numeric `{n} / {max}` in mono next to or above the bar

### 7.4 Metric / KPI panels

- Panel primitive is the standard `.panel`, not a bespoke card
- Icon top-left (Lucide, 2px, `currentColor`), color matches state tone
- Number: `font-display text-3xl font-bold`, color matches state tone
- Label below: `label-overline` in `--ink-600` (light) / `rgba(250,247,240,0.65)` (dark)
- Hero stat (the one panel per screen that carries halo yellow): fill is `--halo-yellow`, everything inside becomes `--ink-900`. **Only one hero stat per shell.**

---

## 8. Forms

### 8.1 Input states

| State | Class |
|---|---|
| Default | `border-[color:var(--ink-200)] bg-[color:var(--paper-white)]` |
| Focus | `focus:ring-2 focus:ring-[color:var(--halo-yellow)] focus:outline-none` |
| Error | `border-[color:var(--risk-600)] focus:ring-[color:var(--risk-600)]` |
| Disabled | `bg-[color:var(--ink-100)] text-[color:var(--ink-400)] cursor-not-allowed` |

### 8.2 Validation

- Inline below field, `text-xs text-[color:var(--risk-700)]`
- Server-action errors: show as a banner above the form, not a toast (compliance operators need persistent error surfaces)
- Required fields: do not mark with `*`. Mark optional fields with "(optional)" instead.

### 8.3 Layout

- Labels above inputs, `text-sm font-medium`
- 12px gap between label and input
- 20px gap between fields
- Submit button right-aligned for short forms, full-width for mobile / single-purpose forms
- Send / submit buttons in a flex-column form use `align-self: flex-start` — they must not stretch to fill the row

---

## 9. Lists & Tables — the 3-Zone Pattern

Standard pattern for any list > 25 items (session logs, audit trails, supervisee history):

```
┌──────────────────────────────────────────────────┐
│  ZONE 1: Needs your attention (N)                │
│    Pending items requiring action — top of page  │
├──────────────────────────────────────────────────┤
│  ZONE 2: Filter bar — All / Pending / Signed     │
│         Date: [Last 90d ▾]   (URL-state)         │
├──────────────────────────────────────────────────┤
│  ZONE 3: Grouped log (by month, accordion)       │
│    ▼ Current month — expanded                    │
│    ▶ Prior months — header w/ count + hours      │
└──────────────────────────────────────────────────┘
```

### 9.1 Rules

- **No pagination** for audit data. Breaks Ctrl+F and audit screenshots.
- **No infinite scroll** for audit data. Same reasons + breaks the mobile back button.
- **Group by month** with `{count} sessions · {hours} hrs` in the accordion header
- **Filter state in URL** (`?status=pending&from=2026-03-01`) so views are bookmarkable
- **Current month expanded by default**; prior months collapsed but visible
- Older years grouped behind `2024 (12 months) ▶ Expand`

### 9.2 Empty states

- Centered text, `text-[color:var(--ink-400)] text-sm`
- One-line action prompt: `No sessions yet. Log your first one →`
- No illustrations, no icons. Brand is restrained.

---

## 10. Modals & Overlays

### 10.1 When to use a modal

- Confirming a destructive action (delete, revoke signature)
- A single short focused decision (assign rule, send invitation)

### 10.2 When NOT to use a modal

- ❌ Logging a session — use an inline form on the supervisee detail page
- ❌ Viewing an evidence package — use a dedicated page with a shareable URL
- ❌ Anything with more than one form section
- ❌ AI assist — always inline, never a modal (see §11)

### 10.3 Modal styling

- Width: `max-w-md` for confirmation, `max-w-2xl` for form
- Backdrop: `bg-[color:var(--ink-900)]/70 backdrop-blur-sm`
- Border: 1px `--ink-200`, 14px radius (matches panels)
- No drop shadow

---

## 11. AI-Assist Pattern (locked)

Every AI touchpoint follows the same three rules:

1. **Yellow-bordered surface.** AI-generated draft content sits inside a container with a 1px `--halo-yellow` left border (3px on tables). The user can tell at a glance what came from the AI vs. what they wrote.
2. **Sparkles chip.** Every AI action button, suggestion pill, or field header carries a Lucide `Sparkles` glyph in `--halo-yellow` and the label `AI` (or a verb like `Suggest from transcript`).
3. **Inline, never modal.** AI assist appears in place — beside the field, above the field, or as a chip on the field label. It never opens a modal or a drawer.

Session-note fields (`topics`, `competencies`, `feedback`, `next_steps` — see `src/lib/ai/session-note.ts`) each carry the Sparkles-chip in their field head.

---

## 12. Compliance-Specific UI Patterns

Domain rules that do not apply to general SaaS.

### 12.1 Evidence packages

- Always display the SHA-256 document hash in `font-mono`, truncated to 8–12 chars with the full hash on hover
- "Sealed" badge in **seal gold** (`--seal-gold`) — never halo yellow
- Download link always present, never hidden behind a menu
- Seal treatment: seal-gold top border (2px) + seal-gold badge — mirrors the `EVIDENCE PACKAGE · SEALED` card in the design system preview

### 12.2 Citations

- State-rule citations in mono: `21 NCAC 53`
- Source link: small text underneath, `--ink-600`
- Last-verified date in mono: `2026-06-01`
- Rule version string in mono: `v2024.03`

### 12.3 Hour displays

- Numeric hour counts always `font-mono`
- Format: `1,944.5h` (comma thousands, one decimal maximum)
- Progress bar next to the number for visual context (see §7.3)

### 12.4 At-risk supervisees (the "Needs Attention" pattern)

- Always pinned to the top of a list view
- Each item is a `<Link>` to the supervisee detail page
- Show: name, credential + state, what is at risk, how many days
- Warning tier: `bg-[color:var(--warn-50)]/30 border-l-4 border-l-[color:var(--warn-500)]`
- Critical tier: `bg-[color:var(--risk-50)]/30 border-l-4 border-l-[color:var(--risk-600)]`
- Roster row warn tint: `background: rgba(255, 214, 10, 0.06)` — see §7.2

### 12.5 The Session Note editor

Real schema (`src/lib/ai/session-note.ts`) — four fields, in this reading order:

1. Topics discussed
2. Competencies demonstrated
3. Supervisor feedback
4. Next steps

Anything that says "seven sections" or lists Overview / Goals / Sign as fields is stale — see §15 changelog. The wizard rail shows the four fields + `Sign & seal` as a fifth step.

### 12.6 Signing Flow

Two signatures produce one tamper-evident seal. Every signature block captures: signer name, credential, role, timestamp, IP, explicit intent flag. Both supervisor and supervisee must sign before the note becomes a sealed evidence package.

---

## 13. Accessibility

### 13.1 Minimums

- WCAG AA contrast for all text (4.5:1 normal, 3:1 large)
- All interactive elements keyboard-navigable
- Focus rings visible: `focus:ring-2 focus:ring-[color:var(--halo-yellow)]`
- `aria-label` on icon-only buttons
- Form fields have associated `<Label>` elements
- Color is never the only signal — always paired with icon or text
- Atkinson Hyperlegible offered as a user-toggleable body-font override in app settings

### 13.2 Tested patterns

- Every severity badge carries a Lucide icon, so colorblind users still get the signal
- Progress bars always show the numeric `{n} / {max}` next to them
- Table headers use `scope="col"`
- Marquee carousels honor `prefers-reduced-motion: reduce` (halt animation)

---

## 14. Motion

### 14.1 Rules

- 150ms `transition-colors` on hover
- 200ms `transition-all` on layout changes (accordions, expand)
- No bounce. No spring physics. Linear or ease-in-out only.
- No autoplay video. No looping animations except the top progress bar and marketing marquees.
- Marquees pause on hover and honor `prefers-reduced-motion`.

### 14.2 Allowed

- Top progress bar (route transitions)
- Button spinner (200ms-deferred)
- Accordion open / close
- Modal fade-in (150ms)
- Marketing trust-row marquee (32s linear scroll, pause on hover, mask-fade edges, reduced-motion halt)

### 14.3 Disallowed

- ❌ Confetti
- ❌ Floating-action-button bounce
- ❌ Pulsing buttons (no real-time alerts exist yet)
- ❌ Skeleton shimmer faster than 1.5s cycle
- ❌ Section entrance animations on scroll

---

## 15. Marketing-Specific Rules

The marketing site is light-only (see §3.2) and shares the same tokens as the app.

### 15.1 Copy locks

- **Never** say "ten state boards", "10 states", "ten state", or "All 10 states" anywhere. States are added on demand. Use "your board", "every supported state", or "more boards, on request".
- Every states section carries a **Request a new state** primary CTA (`href="#contact"`, halo-yellow fill).
- The note editor is described as **four fields** (topics, competencies, feedback, next steps) — see §12.5. Never "seven sections".

### 15.2 Value pillars (locked)

Three pillars, each using a Lucide icon:

- `ShieldCheck` — Hours you can prove
- `MapPin` — Your board, versioned
- `AlertTriangle` — No gaps. No surprises.

### 15.3 Contact form

Real intake fields — must match `src/components/marketing/contact-form.tsx` and `src/app/marketing/contact/page.tsx`:

- Name, Email, Topic, Message
- **Topic options (exact order and wording):** General question · Supervisor account help · Enterprise / group practice · State rule request · Partnership or press · Other
- Contact email surfaces as `info@audithalo.com` in the sidebar

Anything drifting from this list is out of date — update the design surface, not the form schema.

---

## 16. Mobile / Responsive

### 16.1 Breakpoints

- `sm` 640px — phone landscape
- `md` 768px — tablet portrait
- `lg` 1024px — tablet landscape, small laptop
- `xl` 1280px — desktop

### 16.2 Mobile priorities

- Tables become cards (`<table>` for desktop, `<div>` cards for mobile)
- Sidebar collapses to hamburger (already wired in marketing nav)
- KPI panels stack from 4-col to 2-col
- Forms are always single-column on mobile

---

## 17. Open Items — Not Yet Reconciled

These are known tensions between v2 and existing repo assets. They are Damon's call, not Claude Code's.

- **`docs/brand/brand-book.md §4`** still describes the v1 palette (navy `#071A3D`, sharp digital blue `#2457FF`, cream `#FBFAF6`, oat `#F3EBDD`, sage `#5F8F86`, gold `#C28A12`). v2 supersedes it. When Damon approves, land a parallel edit to `brand-book.md` collapsing §4 into the two-yellow / warm-neutral / paper-Ink scheme in §1 of this file.
- **`src/app/globals.css`** currently exports v1 tokens (`--primary: #071A3D` etc). Roll forward in a separate PR — rename to `--halo-yellow`, `--seal-gold`, `--ink-*`, `--paper-*`, `--sage-500`, and update every component consuming the old names.
- **Söhne migration** for the display face is planned post-first-paid-customer. Cabinet Grotesk stays until then.
- **AuditHalo Mark colorway** — the sound-wave halo (`docs/brand/brand-book.md §3, B1`) was locked in seal gold on paper-50. v2 confirms that colorway; the mark does not become halo-yellow, even in the header of a dark shell.

---

## 18. References

- Live preview (source of truth for v2): https://www.perplexity.ai/computer/a/audithalo-design-system-PjKMNt.eTrS6w3banurzFw
- Brand book: `docs/brand/brand-book.md`
- Brand voice guide: `docs/brand/brand-voice.md`
- SEO roadmap: `docs/strategy/seo-roadmap.md`
- Developer review methodology: `docs/developers.md`
- Session note schema: `src/lib/ai/session-note.ts`
- Contact form schema: `src/components/marketing/contact-form.tsx`
- Supervisee dashboard: `src/app/app/dashboard/_supervisee-dashboard.tsx`

---

## Changelog

- **2026-09-14 — v2 (this document).** Full replacement. Two-yellow rule locked (`--halo-yellow` for CTAs, `--seal-gold` for sealed evidence only). Warm-neutral ground swaps out v1 halo-blue / navy. Three-layer surface system (Ground → Panel → Content, 14px radius, no nesting). Lucide-only icon system with reserved color mappings. Session Note corrected to four real fields. Marketing copy locks (no "ten state boards", Request-a-state CTA, real contact-form fields). Dark mode confined to app. Marketing marquee + `prefers-reduced-motion` behavior codified.
- **2026-06-02 — v1.** Initial reference. Halo-blue primary, halo-blue links, sage accent, generic sealed treatment. Superseded by v2.
