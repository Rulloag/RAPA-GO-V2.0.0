CREATE TABLE "connectivity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"role" text,
	"had_connectivity" boolean NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"location_zone" text
);
--> statement-breakpoint
CREATE TABLE "offline_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid,
	"passenger_name" text NOT NULL,
	"passenger_phone" text NOT NULL,
	"origin_text" text NOT NULL,
	"destination_text" text NOT NULL,
	"assigned_driver_id" uuid,
	"status" text DEFAULT 'pending_sync' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_to_ride_id" uuid
);
--> statement-breakpoint
CREATE TABLE "sync_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"action" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone,
	"sync_error" text,
	"retry_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connectivity_logs" ADD CONSTRAINT "connectivity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offline_bookings" ADD CONSTRAINT "offline_bookings_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offline_bookings" ADD CONSTRAINT "offline_bookings_assigned_driver_id_users_id_fk" FOREIGN KEY ("assigned_driver_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offline_bookings" ADD CONSTRAINT "offline_bookings_synced_to_ride_id_ride_requests_id_fk" FOREIGN KEY ("synced_to_ride_id") REFERENCES "public"."ride_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_queue" ADD CONSTRAINT "sync_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;