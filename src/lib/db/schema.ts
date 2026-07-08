// Drizzle schema for AuditHalo.
// Mirrors the original Mongo collections from server.py, ported to relational Postgres.
// Tables defined here; migrations are generated from this file with `drizzle-kit generate`.

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  doublePrecision,
  integer,
  boolean,
  uuid,
  pgEnum,
  date,
  time,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", [
  "supervisee",
  "supervisor",
  // Enterprise tier (migration 0023). HR Admin = the practice's compliance
  // owner / org admin (the Enterprise buyer). Executive = read-only
  // oversight role (board members, external auditors, partner clinics).
  // See docs/strategy/04-enterprise-rbac.md for the role matrix.
  "hr_admin",
  "executive",
]);

export const ruleShape = pgEnum("rule_shape", [
  "ratio",
  "cadence",
  "accumulation",
  "constraint",
  "prerequisite",
]);

export const supervisionType = pgEnum("supervision_type", [
  "individual",
  "group",
  "any",
]);

export const sessionStatus = pgEnum("session_status", [
  "scheduled",
  "completed",
  "awaiting_signatures",
  "signed",
]);

export const obligationStatus = pgEnum("obligation_status", [
  "pending",
  "completed",
  "overdue",
]);

export const authTokenKind = pgEnum("auth_token_kind", [
  "password_reset",
  "email_verification",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  name: text("name").notNull(),
  role: userRole("role").notNull().default("supervisee"),
  state: text("state"),
  licenseType: text("license_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  /** Sessions issued (JWT iat) before this timestamp are invalidated. Set on
   *  "sign out everywhere", password change, and password reset. Null means no
   *  revocation has ever occurred — all valid tokens are accepted. */
  sessionsValidFrom: timestamp("sessions_valid_from", { withTimezone: true }),
  /** Professional credentials held by this supervisor (e.g. ["LCMHCS", "NCC"]).
   *  Used for: auto-populating the credential field when logging sessions,
   *  validating supervisor-supervisee assignment compatibility, and clearing
   *  the "sessions lack required credential" rule-engine warning. */
  credentials: jsonb("credentials").$type<string[]>(),
  /** Self-reported supervisor training hours (e.g., CA 16 CCR §1822 requires 15).
   *  Snapshotted onto each supervision session at log time. */
  supervisorTrainingHours: integer("supervisor_training_hours"),
  /** TOTP secret (base32-encoded). NULL if 2FA is not enabled for this user. */
  totpSecret: text("totp_secret"),
  /** Timestamp when 2FA was enabled. NULL if not enabled. */
  totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
  /** Backup codes (hashed). Single-use codes for recovery if the user loses their device.
   *  Each entry is a SHA-256 hash of a single backup code. NULL if 2FA not enabled. */
  totpBackupCodes: jsonb("totp_backup_codes").$type<string[]>(),
  /** Per-kind notification preferences. NULL means fall back to NOTIFICATION_DEFAULTS. */
  notificationPrefs: jsonb("notification_prefs").$type<NotificationPrefs>(),
  /** When true, the daily cron auto-bumps any of this supervisor's assignments
   *  whose ruleId is older than the latest available version (and still sends
   *  a rule_changed notification as a heads-up). Default false. */
  autoApplyRuleUpdates: boolean("auto_apply_rule_updates").notNull().default(false),
  /** Soft-delete timestamp. Set by the "Delete my account" action. The user
   *  is signed out immediately and existing sessions reject in auth.ts. A
   *  daily cron pass purges rows 30 days after this date. NULL = active. */
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  /** Cycle 2 / NIM-4. Flag set by the admin action when a Founding
   *  Supervisor application is approved. Renders a badge in the dashboard
   *  header and reserves the user for future early-access feature branches. */
  isFoundingSupervisor: boolean("is_founding_supervisor")
    .notNull()
    .default(false),
});

/** Discriminated set of notification kinds — keep in sync with notifications kinds in src/lib/notifications.ts */
export type NotificationKind =
  | "invite_accepted"
  | "signature_needed"
  | "rule_changed"
  | "trial_ending_soon"
  | "evidence_sealed"
  | "supervisor_rule_not_set"
  | "attestation_overdue"
  // Scheduling kinds (Phase 1+ of docs/strategy/08-scheduling-and-calendar.md).
  | "session_scheduled"
  | "session_canceled"
  | "session_rescheduled"
  | "session_reminder_1hour"
  | "session_reminder_15min"
  | "session_no_show"
  // Fires when a session's end time has just passed and it isn't signed
  // yet. Replaces the daily auto-no-show flow per docs/strategy/08.
  | "session_sign_reminder";

export type NotificationPrefs = {
  email: Partial<Record<NotificationKind, boolean>>;
};

// ===========================================================================
// Auth tokens — single-use, hashed tokens for password reset + email verification.
// Mirrors the invitations table pattern: raw token never lives in the DB.
// ===========================================================================

export const authTokens = pgTable("auth_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: authTokenKind("kind").notNull(),
  /** SHA-256 of the raw token, hex-encoded. The raw token never lives in the DB. */
  tokenHash: text("token_hash").notNull().unique(),
  /** For email_verification: the email being verified (may differ from users.email if changing email later). For password_reset: same as users.email at the time of request. */
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const stateRules = pgTable("state_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  state: text("state").notNull(),
  licenseType: text("license_type").notNull(),
  ruleShape: ruleShape("rule_shape").notNull(),
  parameters: jsonb("parameters").notNull(),
  evidenceRequirements: jsonb("evidence_requirements").notNull(),
  effectiveStart: timestamp("effective_start", { withTimezone: true }).notNull(),
  effectiveEnd: timestamp("effective_end", { withTimezone: true }),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const obligations = pgTable("obligations", {
  id: uuid("id").defaultRandom().primaryKey(),
  superviseeId: uuid("supervisee_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  ruleId: uuid("rule_id")
    .notNull()
    .references(() => stateRules.id),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
  requiredHours: doublePrecision("required_hours").notNull(),
  completedHours: doublePrecision("completed_hours").notNull().default(0),
  supervisionType: supervisionType("supervision_type").notNull().default("any"),
  status: obligationStatus("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  supervisorId: uuid("supervisor_id")
    .notNull()
    .references(() => users.id),
  superviseeIds: jsonb("supervisee_ids").$type<string[]>().notNull(),
  sessionType: supervisionType("session_type").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  modality: text("modality").notNull().default("virtual"),
  platform: text("platform"),
  status: sessionStatus("status").notNull().default("scheduled"),
  notes: text("notes"),
  transcript: text("transcript"),
  aiNotes: text("ai_notes"),
  signatures: jsonb("signatures").$type<SessionSignature[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type SessionSignature = {
  signerId: string;
  signerName: string;
  signerRole: string;
  signedAt: string;
  ipAddress: string;
  intentConfirmed: boolean;
};

export const evidencePackages = pgTable("evidence_packages", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** The signed session this package was minted from. */
  sessionEventId: uuid("session_event_id")
    .notNull()
    .references(() => sessionEvents.id, { onDelete: "cascade" })
    .unique(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  superviseeId: uuid("supervisee_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Canonical rule identifier ("nc-lcmhca-v1") so future board reviewers know which rule was in effect. */
  ruleId: text("rule_id").notNull(),
  signatures: jsonb("signatures").$type<SessionSignature[]>().notNull(),
  /** SHA-256 hex of the canonical document JSON. Independently verifiable. */
  documentHash: text("document_hash").notNull(),
  /** The full canonical document — the audit artifact. */
  documentContent: jsonb("document_content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const integrations = pgTable("integrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  email: text("email"),
  tenantId: text("tenant_id"),
  clientId: text("client_id"),
  settings: jsonb("settings"),
  connectedAt: timestamp("connected_at", { withTimezone: true }).defaultNow().notNull(),
});

// ===========================================================================
// Organizations + memberships + invitations
// An Organization is the unit of billing and of supervisee rostering. A
// supervisor's signup automatically creates their personal org; if they later
// join a group practice they can be added to additional orgs.
// ===========================================================================

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id),
  // Billing state — synced from Stripe via webhook.
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"),
  subscriptionTier: text("subscription_tier"),
  subscriptionPeriodEnd: timestamp("subscription_period_end", { withTimezone: true }),
  // Practice tier only. Number of seats the supervisor purchased at checkout
  // (or later modified via Stripe Billing Portal). Synced from the
  // practice_seat line item's quantity in the webhook handler. Null means
  // either Solo tier or a legacy Practice org from before pre-commit seats —
  // seats.ts treats null as unlimited.
  seatCount: integer("seat_count"),
  // Wave 2 / 2E — which PDF template to render for sealed evidence packages.
  // 'audithalo_generic' = existing EvidencePdf.tsx; 'recovery_innovations_v1' =
  // RI's 3-page Clinical Supervision Form layout. See plan at
  // nimbalyst-local/plans/2e-ri-clinical-supervision-form.md.
  pdfTemplateKey: text("pdf_template_key").notNull().default("audithalo_generic"),
  // Wave 2 Phase 2 — per-org Paycor connection config. null = not connected.
  // Set by an admin (Phase 3 setup UI). Contains legalEntityId, SFTP creds.
  // Migration 0031 adds the column; schema defined here so cron route compiles.
  paycorConfig: jsonb("paycor_config").$type<PaycorConfig>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const PDF_TEMPLATE_KEYS = ["audithalo_generic", "recovery_innovations_v1"] as const;
export type PdfTemplateKey = (typeof PDF_TEMPLATE_KEYS)[number];

export type PaycorConfig = {
  legalEntityId: string;
  environment: "sandbox" | "production";

  apimSubscriptionKey: string;
  oauthClientId: string;
  oauthClientSecret: string;
  oauthAccessToken?: string;
  oauthRefreshToken?: string;
  tokenExpiresAt?: string;

  sftpHost?: string;
  sftpUser?: string;
  sftpPrivateKey?: string;
  sftpBasePath?: string;

  connectedAt: string;
  connectedByUserId: string;
  lastSyncAt?: string;
  lastSyncStatus?: "success" | "partial" | "failed";
  lastSyncChanges?: number;
};

/**
 * Lifecycle status orthogonal to soft-deactivation. Captures Paycor-side
 * employment state for clinicians who remain on the org's payroll but
 * aren't actively working (on_leave) or work irregularly (prn). See
 * docs/strategy/13-paycor-integration.md §2A.
 *
 * - 'active'   default. Normal supervision evaluation + reminders.
 * - 'on_leave' pause cadence checks; suppress sign-reminders + "needs
 *              supervision this week" widget. Still tracked, just paused.
 * - 'prn'      no behavior change vs active; UI badge only. Bree's
 *              2026-06-25 reply locked this — PRN clinicians should
 *              continue receiving reminders since they may pick up
 *              shifts at any time.
 *
 * Paycor is source of truth (Phase 3 sync writes these); manual flip
 * from AuditHalo UI is intentionally NOT exposed in v1 to avoid drift.
 */
export const LEAVE_STATUS = ["active", "on_leave", "prn"] as const;
export type LeaveStatus = (typeof LEAVE_STATUS)[number];

export const SUPERVISION_TYPES = [
  "peer", "nursing", "clinician", "administrative", "app", "other",
] as const;
export type SupervisionType = (typeof SUPERVISION_TYPES)[number];

export const orgMemberships = pgTable("org_memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: userRole("role").notNull(),
  // Soft-deactivation (migration 0023). When set, the user cannot log in or
  // be assigned new work for this org, but their historical signed sessions
  // and audit-log entries stay intact (the audit trail is sacred).
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  deactivatedByUserId: uuid("deactivated_by_user_id").references(() => users.id),
  // Wave 2 / Phase 1.1 — lifecycle state for Paycor sync (see header
  // comment on LEAVE_STATUS above). All three columns added together;
  // backfill is the column-level default of 'active'.
  leaveStatus: text("leave_status", { enum: LEAVE_STATUS })
    .notNull()
    .default("active"),
  leaveStatusChangedAt: timestamp("leave_status_changed_at", {
    withTimezone: true,
  }),
  leaveStatusSource: text("leave_status_source"), // 'manual_hr_admin' | 'paycor_sync'
  paycorEmployeeId: text("paycor_employee_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Explicit M:N supervisor↔supervisee assignments (migration 0023).
 *
 * Replaces the implicit "every supervisor sees every supervisee in the org"
 * model that worked for Solo/Practice. Enterprise orgs have multiple
 * supervisors and a supervisee might have a primary + secondary supervisor.
 * Exactly one row per supervisee should have `isPrimary = true` and
 * `endedAt IS NULL` — the cadence rules and signature requirements run
 * against the primary supervisor.
 *
 * On reassignment: the old row gets `endedAt` + `transferredFromSupervisorId`
 * pointing back to the prior assignment's supervisor, and a fresh row is
 * inserted for the new supervisor. Existing signed sessions stay attributed
 * to whichever supervisor actually signed them.
 */
export const supervisorAssignments = pgTable("supervisor_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  supervisorId: uuid("supervisor_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  superviseeId: uuid("supervisee_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  isPrimary: boolean("is_primary").notNull().default(true),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  transferredFromSupervisorId: uuid("transferred_from_supervisor_id").references(
    () => users.id
  ),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Per-org settings (migration 0023). One row per org, backfilled on
 * migrate. Houses Enterprise-tier configuration: audit-log retention
 * preference, SSO setup (later), branding, and feature toggles like
 * "allow supervisors to invite supervisees" (HR Admins might want to lock
 * invitation power to themselves in a tightly controlled practice).
 */
export const orgSettings = pgTable("org_settings", {
  orgId: uuid("org_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  auditLogRetentionYears: integer("audit_log_retention_years")
    .notNull()
    .default(7),
  ssoProvider: text("sso_provider"),
  ssoMetadataUrl: text("sso_metadata_url"),
  brandingLogoUrl: text("branding_logo_url"),
  allowSupervisorsToInvite: boolean("allow_supervisors_to_invite")
    .notNull()
    .default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invitations = pgTable("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  name: text("name"),
  role: userRole("role").notNull().default("supervisee"),
  /** SHA-256 of the raw token, hex-encoded. The raw token never lives in the DB. */
  tokenHash: text("token_hash").notNull().unique(),
  invitedById: uuid("invited_by_id")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  acceptedById: uuid("accepted_by_id").references(() => users.id),
  // Optional rule + dates pinned at invite-time. When set, accept-invite writes
  // a superviseeRuleAssignments row in the same transaction as the membership.
  pendingRuleId: text("pending_rule_id"),
  pendingObligationStartedAt: timestamp("pending_obligation_started_at", {
    withTimezone: true,
  }),
  pendingContractFiledAt: timestamp("pending_contract_filed_at", {
    withTimezone: true,
  }),
  // HR Admin picks a supervisor at invite time (migration 0024). On accept,
  // supervisor_assignments row is created with this user. Null when the
  // inviter is themselves a supervisor (auto-assigns to themselves).
  pendingAssignmentSupervisorId: uuid("pending_assignment_supervisor_id").references(
    () => users.id
  ),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ===========================================================================
// Rule engine inputs: which rule a supervisee is operating under, and the
// session events that feed the evaluator.
// ===========================================================================

/** Pins a supervisee to a specific rule version. Versioning is statutory — a supervisee
 *  who started under v1 stays under v1 even when v2 ships. */
/** Per-assignment attestation bag (jsonb) keyed by checkId.
 *  Reserved for future-extensible attestations whose shape we haven't pinned
 *  down. Known-check attestations live in their own typed columns above. */
export type AttestationEntry = {
  attestedAt: string;
  attestedBy: string;
  value: Record<string, unknown>;
};

export const superviseeRuleAssignments = pgTable(
  "supervisee_rule_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    superviseeId: uuid("supervisee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Matches ruleId() in the rule registry — e.g., "nc-lcmhca-v1". */
    ruleId: text("rule_id").notNull(),
    obligationStartedAt: timestamp("obligation_started_at", {
      withTimezone: true,
    }).notNull(),
    supervisionContractFiledAt: timestamp("supervision_contract_filed_at", {
      withTimezone: true,
    }),
    /** Permit issue date — feeds permit_expiration_window when present. */
    permitIssuedAt: timestamp("permit_issued_at", {
      withTimezone: true,
    }),
    /** Permit expiry — feeds permit_expiration_window when present. */
    permitExpiresAt: timestamp("permit_expires_at", {
      withTimezone: true,
    }),
    /** Supervisor training completion date attested by the supervisor. */
    supervisorTrainingCompletedAt: timestamp(
      "supervisor_training_completed_at",
      { withTimezone: true }
    ),
    /** Supervisor training hours attested (e.g., CA 16 CCR §1822 = 15). */
    supervisorTrainingHoursAttested: integer(
      "supervisor_training_hours_attested"
    ),
    /** Future-extensible per-check attestation bag. NULL = empty. */
    attestations: jsonb("attestations").$type<Record<string, AttestationEntry>>(),
    /** Set when the supervisor dismisses a rule-update prompt for this
     *  assignment. Cron skips rule_changed notifications for 30 days
     *  afterward to avoid badgering. */
    ruleChangeSnoozedAt: timestamp("rule_change_snoozed_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  }
);

/** Tracks which Stripe webhook event IDs we've already processed. Prevents
 *  double-processing when Stripe retries on receiver timeout. */
export const processedStripeEvents = pgTable("processed_stripe_events", {
  /** The Stripe event ID (e.g., "evt_..."). Primary key for natural dedup. */
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Practice or supervision session events that feed the rule engine. */
export const sessionEvents = pgTable("session_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  superviseeId: uuid("supervisee_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  durationHours: doublePrecision("duration_hours").notNull(),
  /** Practice events only: direct client contact subset of durationHours.
   *  NULL means "treat as equal to durationHours" (backward compat for older events). */
  directContactHours: doublePrecision("direct_contact_hours"),
  /** Two-letter US state code where the practice happened. NULL means "assume
   *  supervisee's current state" (backward compat for events logged before this
   *  field existed). Used by future compact-aware rule logic. */
  practiceState: text("practice_state"),
  sessionType: text("session_type"),
  supervisorCredentials: jsonb("supervisor_credentials").$type<string[]>(),
  /** Supervision events only: snapshot of the supervisor's verified training hours
   *  at the moment this session was logged. Preserves "what was true when the
   *  session happened." NULL for legacy events or non-supervision events. */
  supervisorTrainingHours: integer("supervisor_training_hours"),
  groupAttendees: integer("group_attendees"),
  loggedById: uuid("logged_by_id")
    .notNull()
    .references(() => users.id),
  /** Intent-confirmed signatures by required signers. Empty until anyone signs. */
  signatures: jsonb("signatures").$type<SessionSignature[]>().default([]).notNull(),
  /** Set when ALL required signers have signed. Once non-null the session is part of the audit trail. */
  signedAt: timestamp("signed_at", { withTimezone: true }),
  // ── Scheduling / calendar feature (migration 0025) ─────────────────────
  // See docs/strategy/08-scheduling-and-calendar.md. All nullable so existing
  // logged sessions stay valid; populated only when a session was scheduled
  // in advance (vs logged retroactively).
  /** Lifecycle state for scheduled sessions: 'scheduled' | 'completed' |
   *  'canceled' | 'no_show'. NULL = legacy after-the-fact log entry. */
  scheduledStatus: text("scheduled_status"),
  /** When part of a weekly/biweekly recurring series. NULL for one-offs. */
  recurringSeriesId: uuid("recurring_series_id").references(
    () => recurringSessionSeries.id,
    { onDelete: "set null" }
  ),
  /** 'teams' | 'google_meet' | 'in_person' — which provider made the meeting. */
  meetingProvider: text("meeting_provider"),
  meetingJoinUrl: text("meeting_join_url"),
  /** Provider-specific meeting id (Teams onlineMeeting id, Google event id). */
  meetingId: text("meeting_id"),
  /** Map of {userId: providerCalendarEventId} so we can update/delete the
   *  corresponding calendar events on each attendee's connected calendar
   *  when the session is rescheduled or canceled. */
  calendarEventIds: jsonb("calendar_event_ids").$type<Record<string, string>>(),
  /** IANA tz string (e.g. 'America/New_York') for local display of
   *  scheduled_at. UTC is the canonical storage; this is for rendering. */
  timeZone: text("time_zone"),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  canceledByUserId: uuid("canceled_by_user_id").references(() => users.id),
  /** When the "time to sign" reminder was last fired for this session
   *  (migration 0028). The sign-reminder cron sets this to dedupe; the
   *  reschedule action nulls it so the reminder fires again after the
   *  new end time. NULL = no reminder fired yet. */
  signReminderSentAt: timestamp("sign_reminder_sent_at", { withTimezone: true }),
  /** AI-generated session note structure. Generated by supervisor before signing.
   *  null if no AI note has been generated yet. The transcript itself is NEVER
   *  stored — only the structured note + metadata. */
  aiNote: jsonb("ai_note").$type<{
    topics: string[];
    competencies: string[];
    supervisorFeedback: string;
    nextSteps: string[];
    generatedAt: string;        // ISO timestamp
    generatedByUserId: string;  // UUID of the supervisor who generated it
    model: string;              // e.g. "gpt-4o-2024-08-06"
    transcriptHash: string;     // SHA-256 of input transcript (for audit only; transcript itself not stored)
    transcriptWordCount: number;
    editedAt?: string;          // ISO timestamp — set when a supervisor manually edits after generation
    editedByUserId?: string;    // UUID of the supervisor who edited it
    /** "manual" = supervisor pasted transcript; "teams" = ingested from
     *  MS Teams; "google_meet" = fetched from Google Drive.
     *  Absent on legacy rows (treat as "manual"). */
    source?: "manual" | "teams" | "google_meet";
    /** Provider-specific meeting id for transcript-sourced notes. */
    teamsMeetingId?: string;
  }>(),
  // Wave 2 / 2E — type of clinical oversight provided. Orthogonal to sessionType
  // (which is individual/triadic/group format). Used by all orgs; required for RI.
  supervisionType: text("supervision_type"),
  // Wave 2 / 2E — RI Clinical Supervision Form structured data. Populated by
  // supervisor on the sign page for RI orgs (gated by org.pdfTemplateKey).
  // See src/lib/clinical-form/types.ts for the shape.
  clinicalFormData: jsonb("clinical_form_data").$type<import("@/lib/clinical-form/types").ClinicalFormData>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ===========================================================================
// Calendar + scheduling feature (migration 0025)
// See docs/strategy/08-scheduling-and-calendar.md.
// ===========================================================================

/**
 * Per-user OAuth tokens for connected calendar providers (Microsoft Teams /
 * Outlook Calendar, Google Meet / Calendar). Tokens are AES-256-GCM encrypted
 * at rest via src/lib/crypto.ts using MS_TOKEN_ENCRYPTION_KEY.
 *
 * One row per (user, provider) where disconnected_at IS NULL. Soft-disconnect
 * preserves the row for audit; reconnect creates a fresh row.
 */
export const userCalendarIntegrations = pgTable("user_calendar_integrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** 'microsoft' | 'google' */
  provider: text("provider").notNull(),
  accountEmail: text("account_email"),
  /** AES-256-GCM ciphertext. Never store plaintext. */
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  scopes: text("scopes").array().notNull().default([]),
  /** Reminder cron consults this to send T-N notifications. Default 60min + 15min. */
  defaultReminderMinutes: integer("default_reminder_minutes")
    .array()
    .notNull()
    .default([60, 15]),
  syncSupervisionSessions: boolean("sync_supervision_sessions")
    .notNull()
    .default(true),
  /** Picker default for this user when scheduling. At most one provider per
   *  user should have is_preferred=true; UI enforces. */
  isPreferred: boolean("is_preferred").notNull().default(false),
  connectedAt: timestamp("connected_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
});

/**
 * Recurring supervision series. Created by the supervisor (or HR Admin) when
 * scheduling a weekly/biweekly cadence. Concrete session_events are
 * materialized upfront on creation, capped at end_count or 52 occurrences /
 * 1 year (locked decision #9 in 08-scheduling-and-calendar.md).
 */
export const recurringSessionSeries = pgTable("recurring_session_series", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  supervisorId: uuid("supervisor_id")
    .notNull()
    .references(() => users.id),
  /** Array of supervisee user_ids. >1 for group recurring series. */
  superviseeIds: jsonb("supervisee_ids").$type<string[]>().notNull(),
  startDate: date("start_date").notNull(),
  /** HH:MM in the series's timezone. */
  timeOfDay: time("time_of_day").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  timeZone: text("time_zone").notNull(),
  /** 'weekly' | 'biweekly' | 'every_3_weeks' | 'monthly' */
  frequency: text("frequency").notNull(),
  /** 'count' | 'end_date' | 'never' */
  endType: text("end_type").notNull(),
  endCount: integer("end_count"),
  endDate: date("end_date"),
  meetingProvider: text("meeting_provider"),
  location: text("location"),
  notes: text("notes"),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  canceledByUserId: uuid("canceled_by_user_id").references(() => users.id),
});

/**
 * Group-session attendees. Per Option A in the strategy doc, the primary
 * supervisee stays on session_events.supervisee_id; additional attendees
 * join via this table. ALL attendees must sign before seal.
 */
export const sessionAttendees = pgTable("session_attendees", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionEventId: uuid("session_event_id")
    .notNull()
    .references(() => sessionEvents.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  /** Mirrors session_events.supervisee_id for the primary attendee. Lets
   *  group-session signing logic iterate all attendees uniformly. */
  isPrimarySupervisee: boolean("is_primary_supervisee").notNull().default(false),
  addedAt: timestamp("added_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Append-only audit log per organization. Records who-did-what-when for
 *  every state-changing action. 7-year retention per Practice tier promise. */
export const auditLogEntries = pgTable("audit_log_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  /** User who took the action. Null if action was system-initiated (e.g., webhook). */
  actorUserId: uuid("actor_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  /** Short snake_case action verb, e.g. "rule.assigned", "session.signed", "member.role_changed". */
  action: text("action").notNull(),
  /** Type of resource the action affected, e.g. "supervisee", "session_event", "invitation". */
  resourceType: text("resource_type"),
  /** Identifier of the affected resource (usually a UUID). */
  resourceId: text("resource_id"),
  /** Structured detail: arbitrary JSON describing the change. */
  details: jsonb("details").$type<Record<string, unknown>>(),
  /** IP address of the actor at the time of the action. */
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ===========================================================================
// Notifications (Phase 5.3): in-app bell + opt-in emails.
// One row per pending or already-shown notification. Kind drives template
// selection and bell icon; payload shape depends on kind.
// ===========================================================================

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Notification kind — discriminator that drives template + UI icon. */
  kind: text("kind").$type<NotificationKind>().notNull(),
  /** Kind-specific payload. Shape lives in notification-kinds.ts. */
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  /** Set when the user reads it (clicks the bell or visits the link). */
  readAt: timestamp("read_at", { withTimezone: true }),
  /** Set when the email side-effect succeeded. Used so daily cron dedup
   *  knows not to email a stale notification a second time. */
  emailedAt: timestamp("emailed_at", { withTimezone: true }),
});

// ===========================================================================
// Rule-drift monitoring: per-rule snapshot of the citation URL hash.
// One row per ruleId. The weekly cron fetches the URL, hashes the body,
// upserts here. /admin/rule-drift lists all snapshots so a human can verify
// changes before deciding to ship a new rule version YAML.
// ===========================================================================

export const ruleSourceSnapshots = pgTable("rule_source_snapshots", {
  /** Matches the rule loader's id, e.g. "nc-lcmhca-v1". */
  ruleId: text("rule_id").primaryKey(),
  /** The citation.url we fetched. */
  url: text("url").notNull(),
  /** SHA-256 hex of the response body. */
  contentHash: text("content_hash").notNull(),
  /** "ok" | "changed" | "error". "changed" sticks until a human acknowledges
   *  by updating verification.last_verified_at + source_hash in the rule YAML
   *  and the next cron pass sees the new hash matches. */
  status: text("status").notNull(),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).notNull(),
  lastChangedAt: timestamp("last_changed_at", { withTimezone: true }).notNull(),
  /** HTTP status from the last fetch (null on network error). */
  httpStatus: integer("http_status"),
  /** Last error message — populated when status="error". */
  errorMessage: text("error_message"),
});

// ===========================================================================
// Org rule overrides (migration 0027).
// Two-tier rule model — see docs/strategy/09-rules-admin.md.
//   canonical_rule_id IS NOT NULL → override on a canonical YAML rule.
//   canonical_rule_id IS NULL     → custom org-authored rule (no canonical).
// ===========================================================================

export type RuleStructuredPatch = Partial<{
  total_practice_hours_required: number;
  total_supervision_hours_required: number;
  min_duration_months: number;
  max_duration_months: number;
  group_max_attendees: number;
  min_individual_supervision_fraction: number;
}>;

/** Shape of `checks_patch` for an OVERRIDE row. */
export type ChecksOverridePatch = {
  /** New checks to append. IDs must use the custom_ prefix. */
  add?: Array<{
    id: string;
    severity: "info" | "warning" | "blocker";
    description: string;
    params?: Record<string, unknown>;
  }>;
  /** Canonical check IDs to drop from the merged rule. */
  remove?: string[];
  /** Param edits keyed by canonical check id. Replaces the whole params
   *  object — partial merge happens above this layer in the merge helper. */
  replace_params?: Record<string, Record<string, unknown>>;
  /** Severity downgrades keyed by canonical check id. Only direction
   *  allowed: blocker → warning → info. Validated in the action. */
  replace_severity?: Record<string, "info" | "warning" | "blocker">;
};

/** Shape of `checks_patch` for a CUSTOM rule row. */
export type ChecksCustomPatch = {
  checks: Array<{
    id: string;
    severity: "info" | "warning" | "blocker";
    description: string;
    params?: Record<string, unknown>;
  }>;
};

/** Shape of `custom_metadata` for a CUSTOM rule row. */
export type CustomRuleMetadata = {
  license_name: string;
  issuing_board: string;
  summary: string;
  citation: { admincode: string; statute?: string; url: string };
  verification: {
    last_verified_at: string;
    last_verified_by: string;
  };
};

export const orgRuleOverrides = pgTable("org_rule_overrides", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  /** Canonical rule id (e.g. "nc-lcmhca-v1") when this row is an override.
   *  NULL when this row defines a custom org-authored rule. */
  canonicalRuleId: text("canonical_rule_id"),
  jurisdiction: text("jurisdiction").notNull(),
  licenseCode: text("license_code").notNull(),
  version: integer("version").notNull().default(1),
  label: text("label").notNull(),
  structuredPatch: jsonb("structured_patch")
    .$type<RuleStructuredPatch>()
    .notNull()
    .default({}),
  checksPatch: jsonb("checks_patch")
    .$type<ChecksOverridePatch | ChecksCustomPatch>()
    .notNull()
    .default({}),
  customMetadata: jsonb("custom_metadata").$type<CustomRuleMetadata>(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  lastEditedBy: uuid("last_edited_by").references(() => users.id),
});

// ===========================================================================
// Paycor SFTP delivery queue (Wave 2 Phase 2, Pass 3)
// Sealed evidence packages for Paycor-connected orgs are queued here.
// A cron worker picks up pending rows and pushes the PDF to Paycor's
// employee Documents folder via SFTP. Migration 0031.
// ===========================================================================

export const DELIVERY_STATUSES = ["pending", "delivered", "failed"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const paycorDeliveryQueue = pgTable("paycor_delivery_queue", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  evidencePackageId: uuid("evidence_package_id")
    .notNull()
    .references(() => evidencePackages.id, { onDelete: "cascade" }),
  paycorEmployeeId: text("paycor_employee_id"),
  status: text("status", { enum: DELIVERY_STATUSES })
    .notNull()
    .default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
