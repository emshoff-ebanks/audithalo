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

## P2 additions (by route)

### /dashboard/calendar
- [ ] Calendar in week view showing scheduled supervision sessions.
  - Used by: `integrations/using-the-calendar.mdx`

### New session / scheduling flow
- [ ] The schedule-a-session form showing date, time, duration, and meeting provider.
  - Used by: `sessions/scheduling-sessions.mdx`
- [ ] The recurring series options showing frequency and end condition.
  - Used by: `sessions/scheduling-sessions.mdx`

### /sign/[sessionId]
- [ ] Sign page showing the transcript input and the **Generate note** action.
  - Used by: `sessions/ai-session-notes.mdx`

### /dashboard/roster
- [ ] Roster rows showing status badges, progress, and pending-signature counts.
  - Used by: `team/managing-your-roster.mdx`
- [ ] A pending invitation row with resend and cancel actions.
  - Used by: `team/managing-your-roster.mdx`

### /dashboard/roster/[superviseeId]
- [ ] The **Assign rule** form showing rule selection and **Obligation start** date.
  - Used by: `rules/assigning-and-attesting-rules.mdx`
- [ ] An attestation gap with the record-attestation control.
  - Used by: `rules/assigning-and-attesting-rules.mdx`
- [ ] Grouped gaps showing severity and next-step actions.
  - Used by: `rules/compliance-gaps-and-warnings.mdx`

### /dashboard/team
- [ ] Team page showing **Invite Supervisor**, **Invite HR Admin**, **Invite Executive**.
  - Used by: `team/inviting-team-members.mdx`

### /dashboard/team/rules
- [ ] The override editor showing structured fields and checks with a tighter/looser/removed summary.
  - Used by: `rules/creating-rule-overrides.mdx`

### Sealed session / evidence
- [ ] A sealed evidence package showing session details, signatures, and the verification hash.
  - Used by: `evidence/understanding-evidence-packages.mdx`

### /verify/[packageId] (public)
- [ ] The public verification page confirming a package is authentic, with session and signer details.
  - Used by: `evidence/verifying-a-package.mdx`

### /dashboard/audit-log
- [ ] Audit log table showing actor, timestamp, action type, and resource columns.
  - Used by: `audit-log/reading-the-audit-log.mdx`
- [ ] Audit log export controls showing format choice and, for HR admins, the two-factor prompt.
  - Used by: `audit-log/exporting-the-audit-log.mdx`

---

Total: 40 markers across 28 articles (P1 + P2), spanning the app's key routes.
