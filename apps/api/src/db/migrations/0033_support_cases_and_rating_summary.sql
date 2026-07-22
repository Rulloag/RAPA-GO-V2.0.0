-- RAPA GO Bloque 07
-- Casos persistentes de soporte, reclamos y objetos perdidos.

CREATE TABLE IF NOT EXISTS "support_cases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tracking_code" varchar(40) NOT NULL,
  "requester_user_id" uuid NOT NULL,
  "requester_role" varchar(30) NOT NULL,
  "ride_request_id" uuid,
  "category" varchar(40) NOT NULL,
  "subject" varchar(140) NOT NULL,
  "description" text NOT NULL,
  "priority" varchar(20) DEFAULT 'normal' NOT NULL,
  "status" varchar(30) DEFAULT 'open' NOT NULL,
  "contact_phone" varchar(30),
  "contact_email" varchar(255),
  "lost_item_description" text,
  "lost_item_last_seen_at" timestamp with time zone,
  "assigned_admin_user_id" uuid,
  "admin_resolution" text,
  "first_response_at" timestamp with time zone,
  "resolved_at" timestamp with time zone,
  "closed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "support_cases_requester_user_fk"
    FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id")
    ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "support_cases_ride_request_fk"
    FOREIGN KEY ("ride_request_id") REFERENCES "public"."ride_requests"("id")
    ON DELETE set null ON UPDATE no action,
  CONSTRAINT "support_cases_assigned_admin_fk"
    FOREIGN KEY ("assigned_admin_user_id") REFERENCES "public"."users"("id")
    ON DELETE set null ON UPDATE no action,
  CONSTRAINT "support_cases_category_check"
    CHECK ("category" IN ('support', 'complaint', 'lost_item', 'safety', 'payment', 'other')),
  CONSTRAINT "support_cases_priority_check"
    CHECK ("priority" IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT "support_cases_status_check"
    CHECK ("status" IN ('open', 'in_review', 'waiting_user', 'resolved', 'closed', 'rejected')),
  CONSTRAINT "support_cases_lost_item_ride_check"
    CHECK ("category" <> 'lost_item' OR "ride_request_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "support_cases_tracking_code_uidx"
  ON "support_cases" USING btree ("tracking_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_cases_requester_created_idx"
  ON "support_cases" USING btree ("requester_user_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_cases_status_priority_idx"
  ON "support_cases" USING btree ("status", "priority", "updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_cases_category_created_idx"
  ON "support_cases" USING btree ("category", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_cases_ride_idx"
  ON "support_cases" USING btree ("ride_request_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_case_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "support_case_id" uuid NOT NULL,
  "actor_user_id" uuid,
  "actor_role" varchar(30) NOT NULL,
  "event_type" varchar(50) NOT NULL,
  "from_status" varchar(30),
  "to_status" varchar(30),
  "public_message" text,
  "internal_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "support_case_events_case_fk"
    FOREIGN KEY ("support_case_id") REFERENCES "public"."support_cases"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "support_case_events_actor_fk"
    FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id")
    ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_case_events_case_created_idx"
  ON "support_case_events" USING btree ("support_case_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_case_events_actor_created_idx"
  ON "support_case_events" USING btree ("actor_user_id", "created_at");
