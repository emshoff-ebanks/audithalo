CREATE TYPE "public"."obligation_status" AS ENUM('pending', 'completed', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."rule_shape" AS ENUM('ratio', 'cadence', 'accumulation', 'constraint', 'prerequisite');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('scheduled', 'completed', 'awaiting_signatures', 'signed');--> statement-breakpoint
CREATE TYPE "public"."supervision_type" AS ENUM('individual', 'group', 'any');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('supervisee', 'supervisor', 'hr_admin', 'executive');--> statement-breakpoint
CREATE TABLE "evidence_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"supervisee_id" uuid NOT NULL,
	"supervisor_id" uuid NOT NULL,
	"rule_version" text NOT NULL,
	"form_version" text NOT NULL,
	"signatures" jsonb NOT NULL,
	"document_hash" text NOT NULL,
	"document_content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"email" text,
	"tenant_id" text,
	"client_id" text,
	"settings" jsonb,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "obligations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supervisee_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"required_hours" double precision NOT NULL,
	"completed_hours" double precision DEFAULT 0 NOT NULL,
	"supervision_type" "supervision_type" DEFAULT 'any' NOT NULL,
	"status" "obligation_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supervisor_id" uuid NOT NULL,
	"supervisee_ids" jsonb NOT NULL,
	"session_type" "supervision_type" NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"modality" text DEFAULT 'virtual' NOT NULL,
	"platform" text,
	"status" "session_status" DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"transcript" text,
	"ai_notes" text,
	"signatures" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "state_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" text NOT NULL,
	"license_type" text NOT NULL,
	"rule_shape" "rule_shape" NOT NULL,
	"parameters" jsonb NOT NULL,
	"evidence_requirements" jsonb NOT NULL,
	"effective_start" timestamp with time zone NOT NULL,
	"effective_end" timestamp with time zone,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'supervisee' NOT NULL,
	"state" text,
	"license_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "evidence_packages" ADD CONSTRAINT "evidence_packages_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_packages" ADD CONSTRAINT "evidence_packages_supervisee_id_users_id_fk" FOREIGN KEY ("supervisee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_packages" ADD CONSTRAINT "evidence_packages_supervisor_id_users_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obligations" ADD CONSTRAINT "obligations_supervisee_id_users_id_fk" FOREIGN KEY ("supervisee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obligations" ADD CONSTRAINT "obligations_rule_id_state_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."state_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_supervisor_id_users_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;