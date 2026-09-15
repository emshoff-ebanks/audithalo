# 24 -- AuditHalo Complete Product Reference

> Generated 2026-09-14. Authoritative reference for documentation writers.
> If this doc and the code disagree, the code wins -- update this doc.

# AuditHalo -- Complete Product Feature Catalog

## 1. USER ROLES

There are four roles, defined in `C:\code\audithalo\src\lib\authz.ts` and the `user_role` enum in `C:\code\audithalo\src\lib\db\schema.ts`.

### supervisee
- The pre-licensed clinician accumulating supervised practice hours.
- Can view only their own detail page (`/dashboard/roster/{selfId}`).
- Can view the calendar (limited to their own sessions).
- Can sign sessions (countersign after supervisor signs first).
- Can log practice hours (which require supervisor approval before counting).
- Can mark a scheduled session as no-show.
- Can manage their own account (profile, password, 2FA, notifications, calendar integrations, delete account).
- CANNOT view the roster list, team page, billing, audit log, executive dashboard, or org settings.
- CANNOT assign rules, log supervision sessions, generate AI notes, approve practice hours, or invite anyone.

### supervisor
- The credentialed clinical supervisor who oversees supervisees.
- Can view their own roster (supervisees assigned to them).
- Can invite supervisees (if org settings allow).
- Can assign state rules to supervisees.
- Can log supervision sessions (practice + supervision).
- Can schedule, cancel, reschedule, and mark sessions as no-show.
- Can sign sessions (signs first; supervisee countersigns).
- Can generate AI session notes (paste transcript, auto-fetch from Teams/Google Meet, in-person recording).
- Can approve or reject practice hours submitted by supervisees.
- Can attest compliance checks (contract filed, training completed, permit dates).
- Can view audit log (read-only) and team page (read-only).
- Can manage billing (start checkout, open Stripe portal, upgrade Solo to Practice).
- Can manage their own credentials, training hours, and compliance preferences.
- CANNOT invite supervisors, HR admins, or executives.
- CANNOT deactivate members, reassign supervisees, manage org settings, or export audit log.

### hr_admin
- The practice's compliance owner / org administrator (the Enterprise buyer).
- Full org-wide write access: can invite any role (supervisors, HR admins, executives, supervisees), deactivate members, reassign supervisees between supervisors.
- Can view the entire org roster (not just their own assignments).
- Can manage org settings (audit log retention, integrations).
- Can export the audit log (requires 2FA confirmation).
- Can view the executive dashboard.
- Can manage billing.
- Can manage state rules (create overrides, create custom rules).
- Can schedule sessions on behalf of supervisors.
- Can do bulk CSV team imports.
- CANNOT sign sessions, generate AI notes, or perform any clinical-supervisor actions (intentional clinical/admin firewall).
- 2FA is required for sensitive actions: inviting HR admins, exporting audit log, deactivating users.

### executive
- Read-only oversight role (board members, external auditors, partner clinics).
- Automatically redirected to `/dashboard/executive` on login.
- Can view the executive dashboard (org-wide rollup of compliance, at-risk supervisees, pending signatures, scheduling stats).
- Can view the audit log (read-only).
- Can export the audit log (read-only export, no 2FA required).
- Can view the calendar (limited to their own sessions).
- CANNOT sign sessions, log sessions, invite anyone, manage team, change anything, or access billing/settings.
- Max 5 executive seats per org.

### Workspace Admin (separate from RBAC)
- Defined by the `ADMIN_EMAILS` environment variable.
- Gates internal-tooling routes: `/admin/orgs`, `/admin/rule-drift`, `/admin/founding-supervisors`.
- Can promote orgs to Enterprise, provision new Enterprise orgs, toggle Founding Supervisor badges, and monitor rule citation drift.

---

## 2. EVERY ROUTE IN THE APP

All routes are under `C:\code\audithalo\src\app\app\`.

| URL Path | Access | What It Shows | User Actions |
|---|---|---|---|
| `/` | Any | Redirect hub | Redirects authenticated users to `/dashboard`, unauthenticated to `/login` |
| `/login` | Unauthenticated | Sign-in form | Email/password login with optional TOTP 2FA |
| `/register` | Unauthenticated | Supervisor registration form | Create a new supervisor account (creates personal org automatically) |
| `/forgot-password` | Unauthenticated | Password reset request | Enter email to receive a 1-hour reset link |
| `/reset-password/[token]` | Unauthenticated | Password reset form | Set a new password using a valid reset token |
| `/verify-email/[token]` | Any | Email verification result | Consumes a verification token; shows verified/expired state with resend option |
| `/accept-invite/[token]` | Any | Invitation acceptance | New users: create account and join org. Existing users: one-click accept. Shows org name, inviter, and pending rule |
| `/dashboard` | Authenticated | Role-based dashboard | Supervisor/HR Admin: supervisor dashboard with roster summary, upcoming sessions, onboarding checklist. Supervisee: supervisee dashboard with own progress. Executive: redirected to `/dashboard/executive`. Admin-only users: redirected to `/admin/orgs` |
| `/dashboard/roster` | Supervisor, HR Admin | Supervisee roster list | View all supervisees with compliance status (green/yellow/red), practice hour progress, pending signatures. Filter by status, search by name, filter by supervisor (HR Admin). Invite new supervisees. Cancel/resend pending invitations |
| `/dashboard/roster/[superviseeId]` | Supervisor, HR Admin, or self (supervisee) | Supervisee detail page | View rule assignment, practice/supervision hour progress bars, compliance gaps/warnings, session log, evidence packages, completed attestations. Supervisor: assign/change rule, log sessions (practice + supervision), schedule sessions, approve/reject practice hours, attest compliance items, generate AI notes. HR Admin: reassign supervisor, schedule on behalf. Supervisee: view own progress, sign sessions |
| `/dashboard/calendar` | All authenticated | Calendar view | Week/month/list views of scheduled supervision sessions. Supervisor: sees own assigned supervisees. HR Admin: sees all org supervisees. Supervisee: sees own sessions. Shows meeting join URLs, session status, provider info |
| `/dashboard/team` | Supervisor (read-only), HR Admin (full) | Team management | Lists all org members by role (HR Admins, Supervisors, Executives, Supervisees) with leave status. HR Admin: invite supervisors/HR admins/executives, deactivate members, reassign supervisees. Link to CSV import. Link to rules admin |
| `/dashboard/team/import` | HR Admin | Bulk CSV import | Upload/paste CSV from any HRIS. Preview parsed rows, validate, then batch-send invitations. Skips existing members and open invitations |
| `/dashboard/team/rules` | HR Admin | State rules admin | Three sections: canonical rules in use, active overrides, custom rules. View override diffs (tighter/looser/removed counts). Create overrides on canonical rules. Create custom org-authored rules |
| `/dashboard/team/rules/new` | HR Admin | Create custom rule form | Author a new state rule for a jurisdiction not covered by canonical YAML. Supply board citation, structured requirements, and custom checks |
| `/dashboard/team/rules/[canonicalRuleId]` | HR Admin | Override editor | Edit structured fields (hours, durations, fractions) and checks (add custom, remove canonical, change severity, replace params) on a canonical rule for the org |
| `/dashboard/team/rules/[canonicalRuleId]/history` | HR Admin | Override version history | View past versions of an override on a canonical rule |
| `/dashboard/team/rules/custom/[overrideId]` | HR Admin | Custom rule editor | Edit an org-created custom rule's metadata, structured fields, and checks |
| `/dashboard/executive` | Executive, HR Admin | Executive dashboard | Read-only practice-wide rollup: supervisee count, at-risk count, pending signatures, supervision hours this month, scheduled this week, no-shows last 30 days, sealed evidence this month. "Needs attention" table (top 8 at-risk supervisees). Pending signatures by supervisor breakdown. No PHI/AI note content |
| `/dashboard/billing` | Supervisor, HR Admin | Billing &amp; subscription | Current plan display (Solo/Practice/Enterprise with status). Pricing tiers with feature lists. Start 14-day trial (Solo monthly/yearly, Practice with seat picker). Stripe Customer Portal for existing subscribers. In-app upgrade from Solo to Practice. Enterprise: "Talk to sales" |
| `/dashboard/settings` | HR Admin | Org settings | Audit log retention years (1-20). Link to integrations page |
| `/dashboard/settings/integrations` | HR Admin | Integrations | Connect/disconnect Paycor. View connection status, trigger manual sync, see last sync results |
| `/dashboard/account` | All authenticated | Personal account settings | Sections: Email verification, Billing link (supervisor), Notifications preferences, Calendar integrations (Microsoft/Google connect/disconnect/set preferred), Compliance preferences (auto-apply rule updates, supervisor only), Professional credentials (supervisor only), Supervisor training hours (supervisor only), Display name, Password change, 2FA setup/disable (TOTP with backup codes), Sign out everywhere, Change email, Delete account (30-day grace period) |
| `/dashboard/audit-log` | Supervisor (read-only), HR Admin, Executive | Audit log | Chronological table of every state-changing action with actor, timestamp, action type, resource, and details JSON. Filter by action type. HR Admin + Executive: export to file (HR Admin requires 2FA). Shows retention period |
| `/sign/[sessionId]` | Authenticated (scoped by permissions) | Session signing page | Pre-meeting: join meeting button, cancel, reschedule, mark no-show, in-person recording (within 15 min of start). Post-meeting: view session details (date, duration, kind, type, credentials), view/set supervision type, view existing signatures, in-person recording panel (if no transcript yet), saved transcript display (view/edit), AI session note (generate from pasted transcript, fetch from Teams/Google Meet, or display existing), clinical form (RI orgs only), sign with intent confirmation (supervisor first, supervisee countersigns), "didn't happen" escape hatch. Canceled/no-show sessions show read-only status |
| `/admin/orgs` | Workspace Admin | Org management | List all orgs with tier, status, owner. Promote org to Enterprise (flips owner to HR Admin). Provision new Enterprise org |
| `/admin/rule-drift` | Workspace Admin | Rule citation drift monitor | Lists all canonical rules with their citation URL fetch status (ok/changed/error). Shows last checked/changed timestamps |
| `/admin/founding-supervisors` | Workspace Admin | Founding Supervisor management | Toggle Founding Supervisor badge for supervisor-role users |

---

## 3. EVERY SERVER ACTION

All actions are in `C:\code\audithalo\src\app\actions\`.

### Authentication (`auth.ts`)
| Action | Role | Inputs | What It Does |
|---|---|---|---|
| `signupAction` | Unauthenticated | name, email, password, state | Creates supervisor account + personal org + org membership + org settings. Sends email verification. Logs audit event. Triggers PostHog capture |
| `loginAction` | Unauthenticated | email, password, totpCode? | Authenticates user. Checks rate limit (5 attempts/15 min). Validates password. If 2FA enabled, requires TOTP code. Checks soft-delete. Signs in via NextAuth |
| `logoutAction` | Authenticated | none | Signs out the user |

### Account Management (`account.ts`)
| Action | Role | Inputs | What It Does |
|---|---|---|---|
| `requestPasswordResetAction` | Unauthenticated | email | Sends password reset email with 1-hour token. Rate limited (3/hr) |
| `resetPasswordAction` | Unauthenticated | token, password | Validates token, updates password hash, invalidates all sessions, marks token used |
| `requestEmailVerificationAction` | Authenticated | none | Sends verification email with 24-hour token |
| `verifyEmailAction` | Any | token | Marks email as verified |
| `requestEmailChangeAction` | Authenticated | newEmail, password | Validates password, sends verification to new email |
| `updateNameAction` | Authenticated | name | Updates display name |
| `updatePasswordAction` | Authenticated | currentPassword, newPassword | Validates current password, updates hash, invalidates all sessions |
| `signOutEverywhereAction` | Authenticated | none | Sets sessionsValidFrom to now, invalidating all JWTs |
| `updateSupervisorTrainingHoursAction` | Supervisor | hours | Updates self-reported training hours |
| `updateCredentialsAction` | Supervisor | credentials[] | Updates professional credential list (e.g., LCMHCS, NCC) |
| `startTotpSetupAction` | Authenticated | none | Generates TOTP secret and returns QR code URI |
| `enableTotpAction` | Authenticated | totpCode | Verifies code against secret, enables 2FA, generates 8 backup codes |
| `disableTotpAction` | Authenticated | password, totpCode | Validates both, disables 2FA, clears secret and backup codes |
| `deleteAccountAction` | Authenticated | password | Soft-deletes account (30-day purge window). Invalidates sessions |
| `dismissOnboardingAction` | Authenticated | none | Dismisses the onboarding checklist |

### Invitations (`invitations.ts`)
| Action | Role | Inputs | What It Does |
|---|---|---|---|
| `inviteSuperviseeAction` | Supervisor, HR Admin | email, name?, ruleId?, obligationStartedAt?, supervisorId? (HR Admin), contractFiledAt? | Creates invitation with hashed token, pending rule/assignment. Checks seat limits. Sends invitation email. Logs audit event |
| `cancelInvitationAction` | Supervisor, HR Admin | invitationId | Deletes pending invitation. Logs audit event |
| `resendInvitationAction` | Supervisor, HR Admin | invitationId | Generates new token, extends expiry, re-sends email |

### Accept Invite (`accept-invite.ts`)
| Action | Role | Inputs | What It Does |
|---|---|---|---|
| `acceptInviteAction` | Unauthenticated | token, name, password | Creates user account, org membership. If pending rule: creates rule assignment. If pending supervisor: creates supervisor assignment. Marks invitation accepted. Sends invite_accepted notification to inviter. Auto-signs in |
| `acceptInviteAsExistingUserAction` | Authenticated (matching email) | token | Adds org membership to existing user. Same assignment/notification logic |

### Session Management (`sessions.ts`)
| Action | Role | Inputs | What It Does |
|---|---|---|---|
| `scheduleSessionAction` | Supervisor, HR Admin | superviseeId, date, startTime, durationMinutes, timeZone, meetingProvider?, sessionType, additionalSuperviseeIds?, confirmConflicts?, notes? | Creates session_event with scheduledStatus='scheduled'. Creates calendar events via provider API. Detects conflicts. Creates session_attendees for group sessions. Sends session_scheduled notifications |
| `cancelScheduledSessionAction` | Supervisor (assigned/logger), HR Admin | sessionId, cancelRemaining? | Sets scheduledStatus='canceled'. Deletes calendar events. Sends session_canceled notification. Optionally cancels rest of recurring series |
| `markSessionNoShowAction` | Supervisor, HR Admin, Supervisee (self) | sessionId | Sets scheduledStatus='no_show'. Sends session_no_show notification |
| `scheduleRecurringSeriesAction` | Supervisor, HR Admin | superviseeId, startDate, timeOfDay, durationMinutes, timeZone, frequency, endType, endCount/endDate, meetingProvider?, sessionType, additionalSuperviseeIds?, notes? | Creates recurring_session_series and materializes up to 52 concrete session_events. Creates calendar events for each |
| `rescheduleSessionAction` | Supervisor (assigned/logger), HR Admin | sessionId, newDate, newStartTime, newDurationMinutes, newTimeZone | Updates session_event date/duration. Updates calendar events. Sends session_rescheduled notification. Resets sign reminder |

### Supervisee Management (`supervisee.ts`)
| Action | Role | Inputs | What It Does |
|---|---|---|---|
| `assignRuleAction` | Supervisor | superviseeId, ruleId, obligationStartedAt, supervisionContractFiledAt? | Creates/updates supervisee_rule_assignments row. Logs audit event. Sends rule_changed notification if rule changed |
| `logSessionAction` | Supervisor, Supervisee (practice only) | superviseeId, kind, date, durationHours, sessionType?, supervisorCredentials?, groupAttendees?, directContactHours?, practiceState? | Creates session_event. For practice events logged by supervisee: requires supervisor approval. Sends practice_hours_submitted notification. Logs audit event |

### Signatures (`signatures.ts`)
| Action | Role | Inputs | What It Does |
|---|---|---|---|
| `signSessionAction` | Supervisor (assigned/logger), Supervisee (self) | sessionEventId, intentConfirmed | Enforces supervisor-first ordering. Records signature (name, role, IP, timestamp). When all required signers sign: sets signedAt, generates evidence package (SHA-256 hash of canonical document), creates notification (evidence_sealed, signature_needed for countersigner). Logs audit events. Queues Paycor delivery if connected |

### AI Session Notes (`ai-note.ts`)
| Action | Role | Inputs | What It Does |
|---|---|---|---|
| `generateSessionNoteAction` | Supervisor (assigned/logger) | sessionEventId, transcript, noPhiConfirmed | Checks AI note quota. Calls OpenAI to generate structured note (topics, competencies, supervisorFeedback, nextSteps). Stores on session_event.aiNote. Never stores the raw transcript. Stores transcript hash for audit |
| `updateSessionNoteAction` | Supervisor (assigned/logger) | sessionEventId, topics, competencies, supervisorFeedback, nextSteps | Updates an existing AI note (manual edits before signing) |
| `fetchTranscriptAndGenerateNoteAction` | Supervisor (assigned/logger) | sessionEventId | Auto-fetches transcript from Microsoft Teams or Google Meet via calendar integration. Then generates AI note from it |

### Transcript (`transcript.ts`)
| Action | Role | Inputs | What It Does |
|---|---|---|---|
| `updateTranscriptAction` | Supervisor (assigned/logger) | sessionEventId, transcript | Updates the saved transcript text on a session_event |
| `generateNoteFromTranscriptAction` | Supervisor (assigned/logger) | sessionEventId | Generates an AI note from the already-saved transcript on the session_event |

### Practice Hour Approval (`practice-approval.ts`)
| Action | Role | Inputs | What It Does |
|---|---|---|---|
| `approvePracticeHoursAction` | Supervisor | sessionEventIds[] | Batch-approves pending practice hour entries. Logs audit events |
| `rejectPracticeHoursAction` | Supervisor | sessionEventId, reason | Deletes the practice hour entry. Sends practice_hours_rejected notification to supervisee. Logs audit event |

### Attestations (`attestations.ts`)
| Action | Role | Inputs | What It Does |
|---|---|---|---|
| `attestAction` | Supervisor | assignmentId, superviseeId, checkId, value (date, hours?) | Records compliance attestation (contract filed, training completed, permit dates, or custom check). Writes to typed columns or jsonb bag. Logs audit event |
| `undoAttestationAction` | Supervisor | assignmentId, superviseeId, checkId | Removes a previously-recorded attestation. Logs audit event |

### Team Management (`team.ts`)
| Action | Role | Inputs | What It Does |
|---|---|---|---|
| `inviteSupervisorAction` | HR Admin | email, name? | Invites a supervisor. Sends email. Logs audit event |
| `inviteHrAdminAction` | HR Admin | email, name?, totpCode | Invites an HR Admin. Requires 2FA. Sends email. Logs audit event |
| `inviteExecutiveAction` | HR Admin | email, name? | Invites an executive (max 5 seats). Sends email. Logs audit event |
| `deactivateMemberAction` | HR Admin | membershipId, totpCode | Soft-deactivates an org member (sets deactivatedAt). Requires 2FA. Historical data preserved. Logs audit event |
| `reassignSupervisorAction` | HR Admin | superviseeId, newSupervisorId | Ends current assignment (sets endedAt + transferredFromSupervisorId), creates new assignment. Logs audit event |
| `canViewerInviteSupervisees` | Supervisor, HR Admin | none | Checks org settings and seat count to determine if the viewer can invite |

### Billing (`billing.ts`)
| Action | Role | Inputs | What It Does |
|---|---|---|---|
| `startCheckoutAction` | Supervisor, HR Admin | plan (solo_monthly/solo_yearly/practice), seats?, promoCode? | Creates Stripe Checkout Session with 14-day trial. Returns checkout URL |
| `upgradeToPracticeAction` | Supervisor, HR Admin | seatCount | Creates Stripe Checkout for upgrading from Solo to Practice tier |
| `startPortalAction` | Supervisor, HR Admin | none | Creates Stripe Billing Portal session. Returns portal URL |

### Rules Management (`rules.ts`, `rule-overrides.ts`, `custom-rules.ts`)
| Action | Role | Inputs | What It Does |
|---|---|---|---|
| `applyRuleVersionAction` | Supervisor | assignmentId, newRuleId | Upgrades a supervisee's rule assignment to a newer version |
| `dismissRuleChangeAction` | Supervisor | assignmentId | Snoozes rule-change notifications for 30 days |
| `updateAutoApplyRuleUpdatesAction` | Supervisor | enabled | Toggles auto-apply rule updates preference |
| `upsertCanonicalOverrideAction` | HR Admin | canonicalRuleId, label, structuredPatch, checksPatch | Creates or updates an org override on a canonical rule. Validates severity can only be downgraded. Logs audit event with diff |
| `deactivateOverrideAction` | HR Admin | overrideId | Soft-deactivates an override (sets isActive=false). Logs audit event |
| `createCustomRuleAction` | HR Admin | jurisdiction, licenseCode, version, label, metadata, structuredFields, checks[] | Creates a fully custom org-authored rule. Validates citation URL. Logs audit event |

### Audit Log Export (`audit-log-export.ts`)
| Action | Role | Inputs | What It Does |
|---|---|---|---|
| `prepareAuditLogExport` | HR Admin (with 2FA), Executive | format (csv/json), totpCode? | Generates a short-lived download token. HR Admin requires 2FA. Executive does not |
| `redeemAuditLogExport` | Any (with valid token) | token | Streams up to 10,000 audit log entries as CSV or JSON |
| `updateAuditRetentionAction` | HR Admin | years (1-20) | Updates org_settings.audit_log_retention_years |

### Calendar Integrations (`calendar-integrations.ts`)
| Action | Role | Inputs | What It Does |
|---|---|---|---|
| `disconnectCalendarIntegrationAction` | Authenticated | integrationId | Soft-disconnects a calendar integration (sets disconnectedAt) |
| `setPreferredCalendarIntegrationAction` | Authenticated | integrationId | Sets one calendar provider as preferred for scheduling |

### Notifications (`notifications.ts`)
| Action | Role | Inputs | What It Does |
|---|---|---|---|
| `fetchUnreadNotificationsAction` | Authenticated | none | Returns up to 20 unread notifications for the bell icon |
| `markNotificationReadAction` | Authenticated | notificationId | Sets readAt timestamp |
| `markAllReadAction` | Authenticated | none | Marks all unread notifications as read |
| `updateNotificationPrefsAction` | Authenticated | prefs (per-kind email toggles) | Updates user.notificationPrefs |

### Clinical Form (`clinical-form.ts`)
| Action | Role | Inputs | What It Does |
|---|---|---|---|
| `updateSupervisionTypeAction` | Supervisor | sessionEventId, supervisionType | Sets the type of clinical oversight (peer, nursing, clinician, administrative, app, other) |
| `saveClinicalFormDataAction` | Supervisor | sessionEventId, formData | Saves RI Clinical Supervision Form structured data |

### HRIS Import (`hris-import.ts`)
| Action | Role | Inputs | What It Does |
|---|---|---|---|
| `previewHrisImportAction` | HR Admin | csvText | Parses CSV, validates rows, returns preview with skip/add/error status |
| `commitHrisImportAction` | HR Admin | rows[] | Batch-creates invitations for validated import rows |

### Paycor Integration (`paycor-config.ts`)
| Action | Role | Inputs | What It Does |
|---|---|---|---|
| `initiatePaycorOAuthAction` | HR Admin | legalEntityId, environment, apimSubscriptionKey | Starts OAuth flow for Paycor connection |
| `disconnectPaycorAction` | HR Admin | none | Clears Paycor config from org |
| `triggerPaycorSyncAction` | HR Admin | none | Manually triggers a Paycor roster sync |

### Admin Actions (`admin-enterprise.ts`, `admin-founding.ts`)
| Action | Role | Inputs | What It Does |
|---|---|---|---|
| `promoteOrgToEnterpriseAction` | Workspace Admin | orgId | Sets org tier to enterprise, flips owner's role to hr_admin |
| `provisionEnterpriseOrgAction` | Workspace Admin | name, ownerEmail | Creates new Enterprise org with HR Admin owner |
| `toggleFoundingSupervisorAction` | Workspace Admin | userId | Toggles the isFoundingSupervisor flag |

### Other Actions
| Action | File | Role | What It Does |
|---|---|---|---|
| `submitContactAction` | `contact.ts` | Unauthenticated | Submits contact form from marketing site |
| `subscribeNewsletterAction` | `contact.ts` | Unauthenticated | Newsletter signup |
| `applyFoundingAction` | `founding.ts` | Authenticated | Applies for Founding Supervisor program |
| `captureLeadMagnetAction` | `lead-magnet.ts` | Unauthenticated | Captures lead magnet form submission |

---

## 4. KEY FEATURES

### Registration / Signup Flow
- Supervisors self-register at `/register` with name, email, password, and state.
- Registration creates the user, a personal organization, an org membership (role=supervisor), and org settings.
- Sends email verification. User lands on the supervisor dashboard.
- Supervisees never self-register -- they are always invited by a supervisor or HR Admin.

### Invitation System
- Supervisors invite supervisees from the roster page. HR Admins can invite any role from the team page.
- Invitations carry a SHA-256 hashed token, an expiry, and optional pending data: rule assignment, obligation start date, contract filed date, and assigned supervisor.
- On accept: new user account created (or existing user added to org), org membership, rule assignment, and supervisor assignment all happen in one transaction.
- Inviter receives an `invite_accepted` notification.
- Invitations can be canceled or resent. Resending generates a new token and extends expiry.

### Roster Management
- The roster page (`/dashboard/roster`) shows every supervisee with their compliance status (green/yellow/red risk badge), practice hour progress bar, pending signature count, and leave status (on_leave/PRN badges).
- Filters: all, at-risk, pending-signatures, on-track. Text search by name/email. HR Admin can filter by supervisor.
- Each row links to the supervisee detail page.
- Pending invitations appear inline in the roster table.
- HR Admin sees the full org roster; Supervisor sees only their assigned supervisees.

### Session Logging (Practice + Supervision)
- Two kinds of session events: `practice` and `supervision`.
- Practice sessions: logged by supervisee or supervisor. Inputs: date, duration, direct contact hours, practice state. Require supervisor approval before counting toward rule evaluation.
- Supervision sessions: logged by supervisor. Inputs: date, duration, session type (individual/triadic/group), supervisor credentials, group attendees count. Can also be scheduled in advance.
- Session types for scheduling: individual, triadic, group (with additional supervisee picker for group).

### Signing Flow (Supervisor-First Ordering)
- Implemented at `/sign/[sessionId]` with permissions from `C:\code\audithalo\src\lib\sign-permissions.ts`.
- Supervisor must sign first. Supervisee cannot sign until the supervisor has signed.
- Each signature records: signer name, role, timestamp, IP address, and explicit intent confirmation ("I confirm this is my electronic signature").
- When all required signers have signed: `signedAt` is set, an evidence package is generated (SHA-256 hash of canonical document JSON), and `evidence_sealed` notification fires.
- Group sessions: ALL attendees must sign.

### Practice Hour Approval Queue
- Visible on the supervisee detail page for supervisors.
- Supervisees log practice hours that appear as "pending approval."
- Supervisor can batch-approve or individually reject (with required reason).
- Rejected entries are deleted and a `practice_hours_rejected` notification is sent.
- Only approved practice hours count toward rule evaluation.

### AI Session Notes
Three input modes:
1. **Manual paste**: Supervisor pastes a session transcript text. Minimum 50 characters.
2. **Auto-fetch (Teams/Google Meet)**: For sessions scheduled with a meeting provider, a one-click button fetches the transcript via the calendar integration's OAuth token.
3. **In-person recording + transcription**: `RecordSessionPanel` component enables browser-based audio recording. Recording is transcribed (Whisper). Available within 15 minutes of session start for pre-meeting, and on the sign page post-meeting.

The transcript is sent to OpenAI which generates a structured note with: topics, competencies, supervisorFeedback, and nextSteps. The raw transcript is NEVER stored -- only the structured note plus a SHA-256 hash of the input (for audit). Notes can be manually edited before signing. AI note quota is enforced per billing tier (Solo: 10/month, Practice: 100/month per org).

### Evidence Packages
- Automatically generated when a session is fully signed.
- Contains: session metadata, rule ID, all signatures, and a canonical document JSON.
- SHA-256 hash of the document is stored for independent verification.
- PDF download available via `/api/evidence/[id]`.
- Two PDF templates: `audithalo_generic` (default) and `recovery_innovations_v1` (3-page RI Clinical Supervision Form).
- For Paycor-connected orgs: sealed evidence packages are queued for SFTP delivery to Paycor's employee Documents folder.

### State Rules Engine
Three-tier rule model:
1. **Canonical rules**: Board-verified YAML files in `/rules/`. Each defines: jurisdiction, license code, version, structured requirements (practice hours, supervision hours, durations, group limits), checks with severity (info/warning/blocker), evidence requirements, and citation. Edited only by AuditHalo staff.
2. **Org overrides**: Per-org modifications to canonical rules. Can tighten or loosen structured fields, add/remove/re-severity checks, replace check params. Shows tighter/looser/removed counters.
3. **Custom rules**: Fully org-authored rules for jurisdictions not covered by canonical YAML. HR Admin supplies the citation, structured fields, and checks.

The evaluator runs all checks against the supervisee's logged session events and produces: risk level (green/yellow/red), hour totals, progress percentages, and a list of gaps with actionable next steps (attestation, recurring behavior, data correction, data accumulation, time warning).

Rule version drift detection: when a newer version of a canonical rule exists, a banner appears on the supervisee detail page offering to upgrade.

### Compliance Gaps and Warnings
Each gap has a severity (info/warning/blocker) and an action type:
- **Attestation**: one-click "mark this fact as true" (e.g., "contract filed with board on [date]")
- **Recurring behavior**: "log another individual supervision session"
- **Data correction**: existing data is wrong; highlights the offending session rows
- **Data accumulation**: supervisee just needs more hours; shows progress
- **Time warning**: deadline approaching; shows days remaining or overdue status

Gaps are grouped by code for display. Blocker gaps set the risk level to red.

### Calendar / Scheduling
- Supports Microsoft (Teams/Outlook) and Google (Meet/Calendar) via OAuth.
- Users connect their calendar from `/dashboard/account#integrations`.
- Scheduling creates session_events with calendar events on both supervisor and supervisee calendars.
- Meeting providers: `teams`, `google_meet`, `in_person`.
- Recurring series: weekly, biweekly, every 3 weeks, monthly. End by count, end date, or never (capped at 52 occurrences / 1 year).
- Calendar page: week/month/list views with session status (scheduled/completed/canceled/no_show/signed).
- Conflict detection: warns when overlapping events exist on the calendar.
- Reminders: 1-hour and 15-minute reminders via cron.
- Sign reminder: fires when a session's end time passes and it isn't signed yet.
- Auto no-show: daily cron can mark sessions as no-show.

### Billing (Stripe)
Three tiers:
- **Solo Supervisor**: $89/month or $890/year. Up to 3 supervisees. 10 AI transcripts/month.
- **Practice**: $49/month base + $25/supervisee/month. Unlimited supervisees (buy seats upfront). 100 AI transcripts/month per org. Bulk HRIS import, 7-year audit log retention.
- **Enterprise**: Custom pricing, contract-managed (no Stripe). SOC 2, signed BAA, dedicated CSM.

All tiers start with a 14-day free trial. Solo can upgrade to Practice in-app. Enterprise is provisioned by workspace admins. Stripe webhooks sync subscription status, seat count, and period end.

### Notifications (16 types)
Defined in `C:\code\audithalo\src\lib\db\schema.ts` (`NotificationKind` type) and preference routing in `C:\code\audithalo\src\lib\notification-kinds.ts`.

| # | Kind | Trigger | Roles That See It |
|---|---|---|---|
| 1 | `invite_accepted` | Invitee accepts an invitation | Supervisor, HR Admin |
| 2 | `signature_needed` | A session needs the user's signature (after countersigner signs) | Supervisor, Supervisee |
| 3 | `rule_changed` | Supervisee's assigned rule was updated | Supervisee |
| 4 | `trial_ending_soon` | Stripe trial approaching end | Supervisor, HR Admin |
| 5 | `evidence_sealed` | All signatures collected, evidence package minted | Supervisor, Supervisee |
| 6 | `supervisor_rule_not_set` | Supervisee has no rule assigned (daily cron) | Supervisor, HR Admin |
| 7 | `attestation_overdue` | Compliance attestation is overdue | Supervisor, HR Admin |
| 8 | `session_scheduled` | A new session was scheduled | Supervisor, Supervisee |
| 9 | `session_canceled` | A scheduled session was canceled | Supervisor, Supervisee |
| 10 | `session_rescheduled` | A scheduled session was rescheduled | Supervisor, Supervisee |
| 11 | `session_reminder_1hour` | 1 hour before scheduled session (cron) | Supervisor, Supervisee |
| 12 | `session_reminder_15min` | 15 minutes before scheduled session (cron) | Supervisor, Supervisee |
| 13 | `session_no_show` | Session marked as no-show | Supervisor |
| 14 | `session_sign_reminder` | Session end time passed, not signed yet (cron) | Supervisor |
| 15 | `practice_hours_submitted` | Supervisee submitted practice hours for approval | Supervisor |
| 16 | `practice_hours_rejected` | Supervisor rejected practice hours | Supervisee |

Each notification appears in the in-app bell. Email side-effects are opt-in per kind. Defaults are set in `C:\code\audithalo\src\lib\notifications.ts`. Executive role receives no notifications.

### Account Management
- **Profile**: Update display name.
- **2FA (TOTP)**: Setup wizard generates secret + QR code. Enable requires verifying a code. Generates 8 single-use backup codes. Disable requires password + TOTP code.
- **Password reset**: Token-based, 1-hour expiry. Rate limited to 3/hour.
- **Email change**: Requires password confirmation. Sends verification to new address.
- **Sign out everywhere**: Invalidates all active sessions.
- **Delete account**: Soft-delete with 30-day grace period. User signed out immediately.
- **Professional credentials** (supervisor): Array of credential strings (e.g., LCMHCS, NCC, LPC). Snapshotted onto sessions at log time.
- **Supervisor training hours** (supervisor): Self-reported hours. Required by some states (CA requires 15 hours). Snapshotted onto sessions.
- **Compliance preferences** (supervisor): Toggle auto-apply rule updates.
- **Calendar integrations**: Connect Microsoft (Teams/Outlook) or Google (Meet/Calendar). Set preferred provider. Disconnect.

### Audit Log
- Append-only, per-organization.
- Records every state-changing action: invitations (sent/canceled/resent/accepted), rule assignments/changes, sessions (logged/signed/sealed), member role changes, practice hour approvals/rejections.
- Configurable retention: 1-20 years (default 7).
- Export: CSV or JSON, up to 10,000 rows. HR Admin requires 2FA; Executive does not.
- Filterable by action type in the UI.
- Shows most recent 100 entries; older entries require export.

### Team Management
- `/dashboard/team` shows all org members grouped by role.
- HR Admin can:
  - Invite supervisors, HR admins (requires 2FA), and executives (max 5 seats).
  - Deactivate members (requires 2FA) -- soft-deactivation preserves historical data.
  - Reassign supervisees between supervisors (ends old assignment, creates new one with transfer tracking).
  - Bulk import from CSV (`/dashboard/team/import`).
- Leave statuses: `active`, `on_leave` (pauses cadence checks), `prn` (badge only, no behavior change). Set by Paycor sync.

### Executive Dashboard
- Read-only practice-wide rollup at `/dashboard/executive`.
- Summary cards: total supervisees, need attention count, pending signatures, supervision hours this month, scheduled this week, no-shows last 30 days, sealed evidence this month.
- "Needs attention" table: top 8 at-risk supervisees with primary supervisor, credential, practice hours, status.
- "Pending signatures by supervisor" breakdown.
- No PHI/AI note content displayed (strict no-PHI posture).
- Accessible to Executive and HR Admin roles.

---

## 5. STATE COVERAGE (10 States)

All rule YAML files are in `C:\code\audithalo\rules\`.

| # | State | Code | License Code | License Name | Issuing Board |
|---|---|---|---|---|---|
| 1 | Arizona | AZ | LAC | Licensed Associate Counselor | Arizona Board of Behavioral Health Examiners |
| 2 | California | CA | APCC | Associate Professional Clinical Counselor | California Board of Behavioral Sciences |
| 3 | Delaware | DE | LACMH | Licensed Associate Counselor of Mental Health | Delaware Board of Mental Health and Chemical Dependency Professionals |
| 4 | Florida | FL | RMHCI | Registered Mental Health Counselor Intern | Florida Board of Clinical Social Work, Marriage and Family Therapy, and Mental Health Counseling |
| 5 | Louisiana | LA | PLPC | Provisional Licensed Professional Counselor | Louisiana Licensed Professional Counselors Board of Examiners |
| 6 | North Carolina | NC | LCMHCA | Licensed Clinical Mental Health Counselor Associate | NC Board of Licensed Clinical Mental Health Counselors |
| 7 | New York | NY | LMHC-LP | Licensed Mental Health Counselor -- Limited Permit | New York State Education Department, Office of the Professions |
| 8 | Ohio | OH | LPC | Licensed Professional Counselor (toward LPCC) | Ohio Counselor, Social Worker and Marriage and Family Therapist Board |
| 9 | Texas | TX | LPC-Associate | Licensed Professional Counselor Associate | Texas State Board of Examiners of Professional Counselors |
| 10 | Washington | WA | LMHCA | Licensed Mental Health Counselor Associate | Washington State Department of Health |

Each rule defines: total practice hours required, total supervision hours required, duration constraints (min/max months), group session limits, individual supervision fraction requirements, and a set of compliance checks (with info/warning/blocker severity). Rules include board citation URLs, verification timestamps, and are versioned (all currently at v1).

---

## 6. DATA MODEL SUMMARY (Key Tables)

From `C:\code\audithalo\src\lib\db\schema.ts`:

- **users**: Account with role, state, credentials, training hours, 2FA (TOTP), notification prefs, soft-delete
- **organizations**: Billing entity with Stripe fields, subscription tier/status, seat count, PDF template key, Paycor config
- **org_memberships**: User-to-org with role, soft-deactivation, leave status (active/on_leave/prn), Paycor employee ID
- **supervisor_assignments**: M:N supervisor-to-supervisee with primary flag, transfer tracking
- **invitations**: Hashed token, pending rule/assignment, expiry
- **supervisee_rule_assignments**: Pins supervisee to rule version with attestation data (contract filed, training, permit dates, extensible jsonb bag)
- **session_events**: Practice/supervision events with scheduling fields, signatures, AI note, transcript, clinical form data, approval tracking, calendar integration fields
- **evidence_packages**: Sealed audit artifacts with SHA-256 document hash
- **notifications**: Per-user with kind discriminator, payload, read/emailed timestamps
- **audit_log_entries**: Append-only per-org with actor, action, resource, details, IP
- **org_rule_overrides**: Override or custom rule per org with structured patch, checks patch
- **user_calendar_integrations**: OAuth tokens (AES-256-GCM encrypted), provider, preferences
- **recurring_session_series**: Recurring scheduling configuration
- **session_attendees**: Group session participants
- **org_settings**: Per-org config (retention, SSO, branding, invite permissions)