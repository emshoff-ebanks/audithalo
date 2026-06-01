# AuditHalo — Brand Book (v0.1)

**Status**: Draft for Damon to react to. Three open palette/typeface decisions flagged inline.
**Last updated**: 2026-06-01

---

## 1. Positioning

> **AuditHalo is the calm, considered command center for clinical supervision compliance. Built for the supervisor who carries board liability and the practice that depends on every supervisee's hours holding up to scrutiny. We bring legal-grade evidence to a profession of care.**

Two emotional anchors:

- **Calm confidence.** The brand should feel like a senior supervisor saying *"You're covered. I've checked."* Not *"Crush your compliance"* (too bro). Not *"We're here for your journey"* (too soft).
- **Legal-grade meets clinical-warmth.** The product sits at the rare intersection of mental-health software (warm, humane) and compliance/audit tech (authoritative, defensible). Our brand wedge is the **hybrid neither pure niche owns**: sage + navy + signet gold + warm off-white. Editorial restraint like **Alma**. Compliance backbone like **Vanta**. Tonal calm like **Two Chairs**.

---

## 2. The name — etymology and metaphor

The name **AuditHalo** carries two surprisingly rich words:

- **Audit** comes from Latin *audire* — to hear. The original Roman auditor *heard* a recital of accounts. The ear, not the eye, is the audit's organ. Almost no competitor uses this — it's a recoverable advantage. Modern audit clichés (clipboard, magnifying glass, checkmark) come from much later.
- **Halo** is unusually deep: the religious aureole (ring of divine witness), the 22° atmospheric halo (a precise optical ring around the sun in ice-crystal atmospheres — a *naturally observable, scientifically valid ring*), the F1 HALO (titanium safety arc), the halo effect (trust transfer), galactic haloes.

**Where the two collide poetically** — the dual-meaning sweet spot the founder loves in **medipyxis** (Pyxis drug drawer + Pyxis constellation):

- The audit as a **"halo of hearing"** — sound waves of *audire* (the supervisee's recited case) radiating outward in concentric rings, accumulating into a sealed halo of evidence. *The halo is literally made of listening.*
- The audit package as a **"22° ring of truth"** — like the 22° optical halo, it's a precise ring that only forms when the underlying physics (or policy compliance) is correct. A ring you cannot fake — it emerges when the conditions are right.

These two are not competing — they're complementary. The 22° halo is the *form*; the audire ring is the *substance*. The wordmark and primary logo can carry one; the other becomes a recurring UI / product motif.

---

## 3. Logo direction

### Primary direction: **"The Sound-Wave Halo" (audire made visible)**

**Visual**: A perfect thin circle composed of short radial tick marks of varying heights — like a polar-coordinate audio waveform forming a ring. From far away: a halo. Up close: a recorded voice. Signet-gold (`#B8860B`) on warm off-white (`#FAFAF7`).

**Why it's the lead**:

1. **It's the only direction that fuses *both* words into one inseparable mark.** The halo shape *is* the audit. The audit *is* the heard voice rendered visible.
2. **It recovers the *audire* etymology that no competitor uses** — a defensible "we know what an audit really is" story for marketing and sales.
3. **It produces per-session unique fingerprints.** Each real supervision conversation can generate its own waveform-halo as a visible signature — a built-in product feature, not just a logo.
4. **It positions us right of the AI-voice wave in clinical tech.** Voice → evidence is the next chapter; we're prepared for it.
5. **Risk** (legibility at favicon size) is solvable by simplifying the tick count below 16px.

**Beyond the logo**:
- Active recording animates the ticks (the ring "listens")
- Each completed session generates a unique waveform-halo "fingerprint" attached to the evidence package
- PDF watermark = a faint sound-wave halo around the page number
- Loading states = a single rotating tick traversing the ring

### Secondary direction: **"The 22° Halo" (scientifically observable ring of truth)**

**Visual**: A perfectly geometric thin ring, very slightly heavier at the top arc, with a small filled signet-gold disc (the "sun-dog") at the 8-o'clock position outside the ring. Pale gold to off-white inner edge gradient, evoking the optical refraction. Reads as a clean asymmetric circle — distinctly *not* a generic ring.

**Why it's strong**:

1. **Secular** — no religious risk. Pure science.
2. **Restrained** — sits well with the compliance buyer's preference for sobriety.
3. **Distinctive** — the off-center sun-dog gives it a signature shape no other ring logo has.
4. **Defensible story** — *"Compliance is the halo that appears when supervision is geometrically correct."* That's a sentence sales can repeat.

This is the **fallback** if the sound-wave direction proves too poetic or hard to execute legibly at small sizes. Both can coexist in the brand: primary mark + UI motif.

### Four other directions explored but not recommended

| Direction | Why not |
|---|---|
| **Mandorla Threshold** (two overlapping circles) | Strong supervision-as-relationship metaphor, but the vesica piscis carries Christian/esoteric overtones that don't serve compliance trust. |
| **Closing Ring** (incomplete ring with a tick notch) | Tick + ring is well-trodden territory (SOC2/ISO badges). Hard to escape feeling generic. |
| **Supervisor's Arc** (F1 HALO inspired) | Strong protection metaphor but the F1 reference only registers for motorsport fans; reads as "bridge" or "rainbow" to others. |
| **Sealed Witness** (signet seal with ear glyph) | Owns the *audire* etymology but the ear icon reads odd at small sizes; needs heavy abstraction. |

> **Decision needed**: confirm the **Sound-Wave Halo** as primary direction, or switch to **22° Halo**. I'm generating image samples of both so you can see them, not just read about them.

---

## 4. Color palette

Final palette synthesizes the warmer/humane direction (b) with the authoritative/regulated direction (c) from research, in the proportions recommended by the cross-niche pattern analysis. Drops the electric violet entirely (research flagged it as the dominant 2025 "AI feature" color — a liability when selling legal-grade trust).

### Core

| Role | Token | Hex | Notes |
|---|---|---|---|
| Foreground (near-black) | `--foreground` | `#0A1428` | Deeper, more navy-tinged than the previous `#0B1020`. Reads authoritative-tech without going gothic. |
| Background | `--background` | `#FAFAF7` | **Warmer** off-white than `#F8FAFC`. Reduces clinical-cold feel for the supervisor persona without losing crispness. |
| Evidence surface | `--evidence-bg` | `#F5F1E8` | Warm oat. Used for the calmest, most human surfaces: evidence package previews, success states, supervisee progress views. |
| Card / surface | `--card` | `#FFFFFF` | Pure white. Used sparingly — for the most "official document" surfaces. |

### Brand accents

| Role | Token | Hex | Use |
|---|---|---|---|
| Primary navy | `--primary` | `#0F1F4C` | Deep authoritative navy. Used for top nav, headers, primary buttons. Replaces the near-black `#0B1020` in primary CTA role. |
| Halo Blue | `--secondary` | `#1D4ED8` | Sharper, more gravitas than the previous `#2563EB`. Used for links, secondary CTAs, focused interactive state. |
| Sage (humanity counterweight) | `--sage` | `#7BA098` | **Surfaces and illustration only — never body text** (fails AA contrast). Used for success-adjacent moments, supervisee-care surfaces, illustration tinting. |
| Signet gold | `--gold` | `#B8860B` | **The halo color.** Reserved exclusively for "audit-ready / sealed / verified / evidence" states. Never decoration. This is the differentiator no competitor owns. |

### Semantic (slightly desaturated for legal-grade restraint)

| Role | Token | Hex |
|---|---|---|
| Success | `--success` | `#166534` (forest, not emerald) |
| Warning | `--warning` | `#B45309` |
| Risk | `--risk` | `#B91C1C` (deeper than #DC2626) |

### Dropped from the previous palette

- `--accent-violet` `#7C3AED` — gone. Electric violet is the 2024-25 "AI feature" cliché (Linear, Notion AI, Perplexity, Anthropic UI). When AI features need a mark, use restrained indigo `#4F46E5` sparingly, or just let signet gold carry the accent.
- `--accent-gold` `#D4A72C` — replaced by the deeper, less acidic signet gold `#B8860B`.

### Why this palette serves both buyer types

- **Supervisor** (clinician, slightly anxious about board liability): warmer off-white + sage surfaces + restrained gold = *calm professional confidence*. Doesn't feel like a hospital, doesn't feel like a compliance hammer.
- **HR / compliance officer** (skeptical, defensive): deep navy + signet gold + restrained semantic colors = *legal-grade trust*. The discipline of using gold *only* for sealed/verified states is the meta-message: "we don't decorate. We earn the ring."

---

## 5. Typography

### Stack

| Role | Font | Reason |
|---|---|---|
| **Display** | **Cabinet Grotesk** (current) — revisit later | Free via Fontshare, already wired in. Research noted Söhne (Klim) would be the premium signaling upgrade — but Söhne is paid (~$200/yr per weight). Keep Cabinet Grotesk for v1; plan a swap to Söhne when first paid customer lands and a designer is engaged. |
| **Body** | **IBM Plex Sans** (current) | Designed for technical density. Strong at small sizes. Neutral-authoritative — perfect for compliance UIs. Keep. |
| **Audit trail / evidence / timestamps** | **IBM Plex Mono** (NEW) | Monospace signals *"machine record, immutable"* — exactly the trust cue HR/compliance buyers need. Use for: timestamps, hash values, case IDs, evidence-package metadata, audit-log entries. |
| **Accessibility alternate body** | **Atkinson Hyperlegible** (NEW) | Braille Institute-validated for low-vision readability. Offer as a user-toggleable alternate body font in app settings. |

### Hierarchy

| Element | Size | Weight | Line-height | Tracking |
|---|---|---|---|---|
| H1 | 48–56px | 600 | 1.1 | -0.02em |
| H2 | 32–36px | 600 | 1.2 | -0.01em |
| H3 | 20–24px | 600 | 1.3 | normal |
| Body | 16px | 400 | 1.6 | normal |
| Long-form body | 16px | 400 | 1.7 | normal |
| Label / overline | 12px | 500 | 1.2 | 0.06em + UPPERCASE |
| Mono (audit) | 13–14px | 400 | 1.5 | normal |

### Font rules

- **Sentence case in headlines.** Not Title Case. Not ALL CAPS. Sentence case reads "considered" — the writing convention of magazines like The Atlantic or The Economist.
- **Em-dashes for asides** — they signal considered writing.
- **Mono only for record-of-fact.** Never decorate with mono. Reserved for evidence-grade content.

> **Decision needed**: confirm we keep Cabinet Grotesk for v1 (free, fine) vs upgrade to Söhne now (paid, more distinctive). Default = keep CG.

---

## 6. Iconography

### Use Lucide as the working system

Lucide is already installed. Use it as the working icon set for every standard UI element. Stroke weight: 1.75 (matches our restraint — Lucide default is 2 which feels heavier than our type).

### When to commission custom

Three places worth custom icons (and only three):

1. **The halo mark** itself (logo + favicon + watermark)
2. **The "evidence sealed" mark** — used in the moment a package locks. A small signet-gold circle with a hashmark glyph. Used across the app, on PDFs, in emails.
3. **The "supervision session" mark** — a stylized listening curve. Used in the dashboard and on session-completion UI.

Everything else stays Lucide.

### Don't use

- Caduceus / medical cross (reads dated EMR)
- Shield + lock + checkmark trio (reads 2015 cybersecurity)
- Brain / head silhouette (Mindstrong cliché)
- Sparkles for "AI" (2024 cliché, will date instantly)

---

## 7. Imagery & illustration

### Default: no photography

Almost every page should work without a single photograph. Restraint signals confidence.

### When photography is justified

- Documentary-style portraits of real supervisors (after we have customer testimonials)
- Always tonal-graded into the brand palette (cool navy shadows, warm gold highlights)
- Never stock. Never crowd shots. Never therapy-couch shots.

### When illustration is justified

- Abstract geometric only. No blob shapes. No gradient meshes. No human figures.
- Sage + cream + navy washes. Gold reserved for evidence-related illustration.
- Lean on the halo motif: rings, arcs, concentric tick patterns.

### Forbidden visual languages

- Pastel blob gradients ("Headspace 2020")
- Gradient mesh backgrounds ("Series A SaaS 2023")
- 3D rendered cute mascots
- Stock photo of diverse smiling office team
- Hand-painted watercolor (too "wellness brand")

---

## 8. Voice & tone

### Rules

- **Sentence case** in headlines and most UI.
- **Specific over generic.** "Track 100 supervision hours against NC LCMHCA" beats "Track all your hours."
- **Verbs first.** "Schedule the session." "Sign the evidence package." "Verify the rule version."
- **Empathy through detail, not platitudes.** Don't say "We get it — supervision is hard." Show that we get it by surfacing the at-risk flag 60 days early.
- **Em-dashes are encouraged** — they read considered.
- **Plural-pronouns address the buyer.** "Your roster." "Your evidence."

### Words to use

- *Audit-ready, evidence package, supervised hours, ratio, obligation, rule version, citation, signature with intent, board-defensible, calm command center*

### Words to avoid

- *Crush, slay, ninja, magic, journey, holistic, mindful, conscious, transform, unlock potential, AI-powered* (use *AI-assisted* only when describing an actual feature), *seamless, leverage, frictionless*

### Examples

| Avoid | Use |
|---|---|
| "Crush your supervision compliance" | "Get your roster audit-ready in an afternoon." |
| "Holistic supervisor toolkit" | "One dashboard, every supervisee, every state rule, current." |
| "AI-powered session notes" | "AI-assisted session notes from your Teams transcripts." |
| "Frictionless e-signatures" | "Sign with intent. Two clicks. Done." |

---

## 9. Brand voice for the three core personas

- **To supervisors**: confident-and-caring. "*You signed up to grow clinicians, not run a spreadsheet.*" Respect their professional judgment.
- **To supervisees**: empathetic-and-clear. "*Your hours are safe. Your progress is visible. Your supervisor sees the same dashboard you do.*" Reduce anxiety with transparency.
- **To HR/compliance**: outcomes-and-evidence. "*Every supervisee's hours, citation-linked to their state rule, with a sealed evidence package per signed session.*" No hedging, no marketing-speak.

---

## 10. Don't list (consolidated)

| Category | Don't |
|---|---|
| Color | Pastel blob gradients · Pure teal/aqua (owned by SimplePractice/BetterHelp) · Gradient mesh backgrounds · Electric violet (AI cliché) · Emerald primary (overused) |
| Logo | Shield + lock + checkmark · Caduceus · Brain silhouette · Sparkle for AI |
| Type | All-caps tracked-out wordmark · Hand-painted display fonts · Title Case headlines |
| Imagery | Stock photography · Hand-painted watercolor · 3D mascots · Cliché diverse office team |
| Voice | "Crush" / "slay" / "journey" / "holistic" / "transform" / "AI-powered" |

---

## 11. Locked decisions

| # | Decision | Resolution |
|---|---|---|
| B1 | Primary logo direction | ✅ **Hybrid: Sound-Wave Halo ring + sun-dog at 22° clockwise from 12 o'clock, on the ring with a background-colored knockout gap.** Fuses both metaphors (audire ring + 22° atmospheric sun-dog) into a single inseparable mark — the medipyxis-style double-layer. Final spec: `hybrid-c4-a-clear.svg` — 48 ticks, ring inner 35 / outer 42, amplitude 3, dot r=10, knockout 5px. Source in `docs/brand/logos/generate.mjs`. (Locked 2026-06-01) |
| B2 | Palette refresh (warmer off-white, deeper navy, sage surfaces, signet gold, drop violet) | ✅ **Locked** — applied in `src/app/globals.css`. See §4 for tokens. (2026-06-01) |
| B3 | Display font | ✅ **Keep Cabinet Grotesk for v1**, plan Söhne migration after first paid customer + designer engagement. (2026-06-01) |
| B5 | Imagery: no photography in v1 | ✅ **Locked.** Restraint signals confidence; revisit when customer testimonials exist. (2026-06-01) |
| B4 | Logo execution path | ✅ **Internal SVG iteration** through this brand-book process. Logo is now production-ready. Consider commissioning a designer polish pass before paid-launch announcement, but the mark is shippable as-is. (2026-06-01) |

## 12. The logo, locked

**The AuditHalo mark** is a thin signet-gold ring composed of ~48 radial audio-waveform ticks (the *audire* etymology made visible — the audit is a halo of hearing), with a solid signet-gold sun-dog dot sitting *on the ring at 22° clockwise from 12 o'clock* (the 22° atmospheric halo reference — a ring that only forms when the underlying conditions are correct). A small background-colored knockout enforces a clean gap between the dot and the ring ticks.

**Two metaphors, one mark**:
- The ring = *audire* (Latin "to hear") — the audit visualized as a polar audio waveform
- The dot = the 22° sun-dog — the precise scientific reference; a ring that only appears when geometry is right

**Files**:
- Canonical source: `docs/brand/logos/hybrid-c4-a-clear.svg`
- Favicon: `src/app/icon.svg` (Next.js auto-serves at `/icon.svg`)
- React component: `src/components/brand/AuditHaloMark.tsx` — exports `<AuditHaloMark />` (mark only) and `<AuditHaloWordmark />` (mark + "AuditHalo" type, gap-2.5, Cabinet Grotesk bold)
- Generator (for future iterations): `docs/brand/logos/generate.mjs` (run with `node docs/brand/logos/generate.mjs`)

**Color discipline**:
- The mark is always signet gold (`#B8860B`) on warm off-white (`#FAFAF7`) or any light surface
- On dark surfaces (dark navy headers if/when they exist), swap mark color to off-white `#FAFAF7`
- The knockout color must always match the surface the mark sits on (the React component accepts a `bg` prop defaulting to `var(--color-background)`)

**Clear space**: at least 1× the mark height of empty padding on all sides

**Minimum size**: 16px (favicon) — the dense tick pattern degrades below 12px, so favicons below 16 should switch to a simplified glyph (TBD)

