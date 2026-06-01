CREATE TABLE "session_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supervisee_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"duration_hours" double precision NOT NULL,
	"session_type" text,
	"supervisor_credentials" jsonb,
	"group_attendees" integer,
	"logged_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supervisee_rule_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supervisee_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"rule_id" text NOT NULL,
	"obligation_started_at" timestamp with time zone NOT NULL,
	"supervision_contract_filed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_supervisee_id_users_id_fk" FOREIGN KEY ("supervisee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_logged_by_id_users_id_fk" FOREIGN KEY ("logged_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervisee_rule_assignments" ADD CONSTRAINT "supervisee_rule_assignments_supervisee_id_users_id_fk" FOREIGN KEY ("supervisee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervisee_rule_assignments" ADD CONSTRAINT "supervisee_rule_assignments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;