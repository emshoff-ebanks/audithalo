# Docs Writing Style Guide

Status: ADOPTED 2026-09-14. The clarity bar for every help-center article under
`src/content/docs/`. Companion to the brand book (`docs/brand/brand-book.md`,
voice + anti-AI-tells) and the fact-integrity rule (`docs/strategy/30`, every
statutory number traces to a `rules/*.yaml` field). Where this guide and the
brand book overlap, both apply; where the brand book is silent on docs craft,
this guide governs.

Source: article-level analysis of Stripe, Linear, Clerk, Twilio, and Notion
docs, plus the Google developer and Microsoft writing style guides.

---

## The one test

Before shipping any sentence: **does it help the reader act or verify?** If not,
delete it. Documentation is read by someone mid-task who wants to finish, not an
audience to be warmed up.

## Structure of every article

1. **Open with what the reader will do, in one line.** Not what the feature is,
   not a welcome. "This guide walks you through logging a supervision session,
   signing it, and collecting the countersignature that seals the evidence
   package." For a concept article, lead with a one-sentence definition anchored
   to something familiar, then mechanics.
2. **"What you'll need"** block (the `prerequisites` frontmatter) when the task
   has preconditions. Keep each to a short phrase.
3. **Task sections with verb-phrase, sentence-case headings** ("Invite your
   first supervisee", "Assign a state rule"), not noun headings ("Supervisee
   invitation").
4. **Numbered steps** for sequences; bullets for options; tables for lookups.
5. **Close by confirming success and pointing to the next task** (the `related`
   frontmatter feeds the Related articles block). End on momentum.

## Writing the steps

- **Imperative verb first, one action per step.** "Select **Invite supervisee**."
  Combine only micro-actions in the same place: "Select **Team > Add an
  account**." Never bundle two real decisions into one step.
- **State the location before the action.** "On the roster page, select **Invite
  supervisee**." Not "Select Invite supervisee on the roster page." The reader's
  eyes should land where they act before being told to act.
- **Bold the exact UI label, verbatim,** matching the product's capitalization
  so it is a visual target: the **Sign and seal** button, the **Obligation start
  date** field. If you do not know the literal label, describe the action from
  `docs/strategy/24-app-reference.md` and add a `[Screenshot: ...]` marker rather
  than inventing button text.
- **State the result right after the action.** "Select **Generate note**. The
  structured note appears with topics, competencies, feedback, and next steps."
  This is how the reader knows it worked.
- **Reference real routes by path** (`/dashboard/roster`, `/sign/[sessionId]`).

## Sentence craft

- **Present tense.** "The evidence package is generated," not "will be
  generated." Reserve "will" for genuinely later events.
- **Active voice, name the actor.** "The supervisor signs first," not "The
  session is signed first."
- **Second person.** "Your roster", "you sign".
- **Short, declarative sentences; vary length on purpose.** Instruction sentences
  stay terse. Let length go into the one sentence that carries context, never
  into a step.
- **No em-dashes** (brand rule). Use a period, comma, colon, or parentheses.

## Where the "why" goes

- Keep steps pure. Put rationale in a short lead-in sentence before the steps, or
  in a callout, not woven through the procedure.
- If a "why" changes what the reader should do, put it inline in one clause:
  "The supervisee cannot sign until you have signed, so sign promptly after the
  session." One clause, riding along.
- Use typed callouts for anything off the happy path:
  - **Note** for context that helps but is not required.
  - **Tip** for a shortcut or better-practice option.
  - **Warning** for a data-loss, compliance, or irreversible action (account
    deletion, deactivation, audit-log export).
  Render callouts in MDX as a blockquote led by a bold label:
  `> **Warning:** Deactivating a member is a 2FA-gated action.`

## Roles: be explicit about CAN and CANNOT

AuditHalo has four roles with a deliberate clinical/admin firewall. For any
multi-role feature, state plainly what each role can and cannot do, using the
authority defined in `docs/strategy/24-app-reference.md`. Example: "HR admins
invite and reassign, but cannot sign sessions or generate AI notes. Only
supervisors sign." When an article is written for one role, say so in the opening
and address that reader in second person.

## State-specific and statutory content

Every hour count, ratio, percentage, deadline, or citation must trace to a
`rules/{state}/v*.yaml` field (`docs/strategy/30`). No number from memory or
pattern-matching. `[PRELIM]`-flagged states carry the same
"preliminary, pending licensed-supervisor review" framing in docs that they
carry on the state landing pages. Cite the admin code so a reader can search it
themselves.

## Screenshots

Mark every screenshot location with `[Screenshot: concise description of the
exact screen/state]`. These become the capture punch-list. Put a marker wherever
a visual removes ambiguity: the first sight of a page, a form mid-fill, a
confirmation state.

## Banned (brand book + docs)

- **AI writing tells:** no em-dashes; no GPT-vocab (delve, tapestry, leverage,
  robust, seamless, crucial, pivotal, foster, navigate, ensure, etc.); no
  "it's not X, it's Y" contrastive filler; no copula-avoidance ("serves as",
  "stands as"); no promotional throat-clearing ("in today's fast-paced world",
  "it's important to note", "when it comes to").
- **Doc filler:** no "simply", "just", "easily", "of course". No rhetorical
  questions. No restating the heading in the first sentence. No preamble.
- **Brand banned words:** crush, slay, magic, journey, holistic, transform,
  unlock, frictionless, AI-powered (use "AI-assisted" for the real feature).
- **No emoji.**

## Quick before/after

| Avoid | Use |
|---|---|
| "Welcome! In this article, we'll explore the powerful roster feature." | "This guide shows you how to invite a supervisee and assign their state rule." |
| "The invitation will be sent to the supervisee, and they will need to accept it." | "AuditHalo emails the supervisee an invitation. They accept it to join your roster." |
| "Simply click on the Sign button." | "Select **Sign and seal**." |
| "You need the rule set. To assign it, go to the detail page." | "On the supervisee detail page, select **Assign rule**." |
| "It's important to note that only supervisors can sign." | "Only supervisors sign. HR admins and executives cannot." |
