# Docs Screenshot Punch-List (P1 articles)

Status: OPEN. Generated 2026-09-14 from `[Screenshot: ...]` markers in the P1
help-center articles. Grouped by app route so each page is captured once and
its shots reused. Capture from a seeded demo org (Atlas Counseling Group) so no
real PHI appears. Once captured, replace the `[Screenshot: ...]` marker line in
each article with the image.

Recommended: full-width viewport, light theme, warm off-white background, no
browser chrome, no real client names.

---

## /register (marketing/app)
- [ ] Registration form showing the **Full name**, **Work email**, and **Password** fields.
  - Used by: `getting-started/supervisor.mdx`

## /accept-invite/[token]
- [ ] Invitation acceptance page showing the organization name and inviting supervisor.
  - Used by: `getting-started/supervisee.mdx`

## /dashboard/roster
- [ ] Roster page with the **Invite a supervisee** action visible.
  - Used by: `getting-started/supervisor.mdx`
- [ ] Roster showing supervisees with green, yellow, and red status badges.
  - Used by: `rules/understanding-compliance-status.mdx`

## /dashboard/roster/[superviseeId] (supervisee detail)
- [ ] Detail page after a rule is assigned, showing practice and supervision progress bars.
  - Used by: `getting-started/supervisor.mdx` and `rules/understanding-compliance-status.mdx`
- [ ] The **Log session** form showing supervision type and duration fields.
  - Used by: `sessions/log-and-sign-a-session.mdx`
- [ ] The practice hour entry form showing duration, direct contact hours, and practice state.
  - Used by: `practice-hours/logging-practice-hours.mdx` and `getting-started/supervisee.mdx`
- [ ] Detail page showing pending practice hour entries awaiting approval.
  - Used by: `practice-hours/approving-practice-hours.mdx`
- [ ] Detail page showing the assigned rule, its version, and a rule-update banner.
  - Used by: `rules/how-state-rules-work.mdx`

## /sign/[sessionId]
- [ ] Sign page with the supervisor signature confirmation checkbox.
  - Used by: `sessions/log-and-sign-a-session.mdx` and `getting-started/supervisor.mdx`
- [ ] Sign page showing session details and the signature confirmation checkbox (supervisee view).
  - Used by: `getting-started/supervisee.mdx`
- [ ] A sealed session showing the evidence package and its verification hash.
  - Used by: `sessions/log-and-sign-a-session.mdx`

## /dashboard/team
- [ ] Team page grouped by role, with the invite actions visible.
  - Used by: `getting-started/hr-admin.mdx`

## /dashboard/executive
- [ ] Executive dashboard showing the summary cards and the Needs attention table.
  - Used by: `getting-started/executive.mdx`

## /dashboard/audit-log
- [ ] Audit log page with the filter and export controls.
  - Used by: `getting-started/executive.mdx`

## /dashboard/account
- [ ] Two-factor setup step showing the QR code and the verification code field.
  - Used by: `account/two-factor-authentication.mdx`
- [ ] Password change section.
  - Used by: `account/password-and-email.mdx`
- [ ] Change-email section.
  - Used by: `account/password-and-email.mdx`
- [ ] The **Calendar integrations** card showing Microsoft and Google with a **Connect** action.
  - Used by: `integrations/connecting-your-calendar.mdx`

## /dashboard/billing
- [ ] Billing page showing the three plan tiers.
  - Used by: `billing/plans-and-pricing.mdx`
- [ ] Billing page showing plan selection and, for Practice, the seat picker.
  - Used by: `billing/managing-your-subscription.mdx`
- [ ] Billing page showing the link to the Stripe customer portal.
  - Used by: `billing/managing-your-subscription.mdx`

---

Total: 25 markers across 14 P1 articles, spanning 10 app routes.
