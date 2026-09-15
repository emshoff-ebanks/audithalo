# 24 — Documentation Center Master Prompt

> Copy the prompt section into a new Claude Code chat session.
> That session will research, plan, and build AuditHalo's help center.

---

## The Prompt

```
I'm building a documentation / help center for AuditHalo — a SaaS for
licensed mental health supervisors who need audit-ready compliance records.

Repo: C:\code\audithalo, branch main.
Production: audithalo.com (marketing) + app.audithalo.com (app)
Stack: Next.js 16 (App Router, SSG), Tailwind 4, Vercel

## Context files to read FIRST (in order)

1. AGENTS.md — runtime contract, tools, authorization scope
2. docs/HANDOFF.md — product orientation, stack, common traps
3. docs/brand/brand-book.md — voice, tone, vocabulary
4. docs/strategy/24-app-reference.md — COMPLETE product catalog
   (every route, action, feature, role, notification, and state rule)
   THIS IS YOUR PRIMARY REFERENCE for writing accurate documentation.
   Do not re-discover the app — this doc is authoritative.

## Your job has three phases

### PHASE 1: Research and architecture decisions

Before writing any code or content, research and decide:

**1. Hosting approach**
Compare these options for our specific situation:
- /docs path on audithalo.com (same Next.js app)
- docs.audithalo.com subdomain (separate app or same app with host routing)
- External tool (Notion, GitBook, Mintlify, ReadMe)

Consider: SEO value (same domain vs subdomain), maintenance burden,
search capability, versioning needs, how the app links to docs
(contextual help links from within the product), cost, and how it
looks to enterprise buyers doing due diligence.

Recommend ONE approach with reasoning.

**2. Study best-in-class documentation sites**
Research these specifically and extract patterns:
- Notion Help Center (help.notion.so) — our closest analog
- Linear Docs (linear.app/docs) — clean design, role-based guides
- Clerk Docs (clerk.com/docs) — auth product, good getting-started flow
- Stripe Docs (docs.stripe.com) — gold standard structure
- Intercom Help Center — in-app help widget pattern

Report: what navigation structure do they use? How do they organize
by role vs by feature? Do they have getting-started guides? How do
they handle search? What makes the best ones feel trustworthy?

**3. Information architecture**
Based on the product catalog in docs/strategy/24-app-reference.md,
design the full documentation structure. Consider organizing by:

Option A: Role-based (Guide for Supervisors, Guide for Supervisees, etc.)
Option B: Feature-based (Sessions, Rules, Billing, etc.)
Option C: Hybrid (Getting Started per role + Feature reference)

For each article, specify:
- Title
- URL slug
- Target audience (role)
- Key topics covered
- Which app pages/features it documents
- Priority (write first / write later)

**4. In-app help strategy**
Design how the app links to documentation:
- Should there be a help icon on each page linking to the relevant doc?
- Should the dashboard have a Help nav link?
- Should there be contextual tooltips that link to detailed docs?
- How does a user get from confused to finding the answer?

### PHASE 2: Build the documentation infrastructure

Based on Phase 1 decisions, build:

1. The docs section (routes, layout, navigation, sidebar, search)
2. MDX configuration if using MDX
3. Responsive sidebar with section grouping
4. Breadcrumbs and prev/next navigation
5. A reusable article template component
6. Schema markup (Article, HowTo, FAQ as appropriate)
7. Sitemap integration (add docs pages to existing sitemap)

Technical requirements:
- Static generation (SSG)
- Must match the existing AuditHalo design system
- Mobile-responsive
- Built-in search (client-side full-text search is fine for <100 articles)

### PHASE 3: Write the documentation content

Using docs/strategy/24-app-reference.md as the authoritative source,
write every article in the documentation structure from Phase 1.

Content rules:
- Write for the target role (supervisor language vs HR admin language)
- Use AuditHalo brand voice (from docs/brand/brand-book.md)
- No emoji
- Include step-by-step instructions with exact UI element names
- Reference specific pages by their actual URL path
- Include What you'll need prereqs where relevant
- Include Related articles links at the bottom
- For features with multiple roles, write from each role's perspective
- Be specific about what each role CAN and CANNOT do
- State-specific content must cite the actual admin code
- Mark screenshot locations with [Screenshot: description]

Writing priorities (write these first):
1. Getting Started guides (one per role)
2. How to log and sign a supervision session
3. Understanding your compliance dashboard
4. How state rules work
5. Practice hour logging and approval
6. Setting up calendar integrations
7. Billing and subscription management
8. Account security (2FA, password management)

## What I will provide when you ask
- Screenshots of specific app pages
- Clarification on any feature behavior
- Brand voice examples
- Approval on architecture decisions before you build

## Constraints
- Read docs/strategy/24-app-reference.md THOROUGHLY before writing.
  Every feature, action, and route is documented there. If you write
  documentation that contradicts it, you are wrong.
- Do not build anything in Phase 2 until Phase 1 is approved by me.
- Do not write content in Phase 3 until Phase 2 infrastructure is built.
- Use the same git identity as AGENTS.md specifies.
- Verify build passes before every push.
- Test affected pages in a browser before pushing.
```
