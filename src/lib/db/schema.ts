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
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", [
  "supervisee",
  "supervisor",
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
  /** Self-reported supervisor training hours (e.g., CA 16 CCR §1822 requires 15).
   *  Snapshotted onto each supervision session at log time. */
  supervisorTrainingHours: integer("supervisor_training_hours"),
});

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

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orgMemberships = pgTable("org_memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: userRole("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ===========================================================================
// Rule engine inputs: which rule a supervisee is operating under, and the
// session events that feed the evaluator.
// ===========================================================================

/** Pins a supervisee to a specific rule version. Versioning is statutory — a supervisee
 *  who started under v1 stays under v1 even when v2 ships. */
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
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
