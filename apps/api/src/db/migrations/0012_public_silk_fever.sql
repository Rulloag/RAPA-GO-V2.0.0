CREATE TABLE "driver_statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_user_id" uuid NOT NULL,
	"availability" varchar(20) DEFAULT 'unavailable' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"current_ride_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "driver_statuses_driver_user_id_unique" UNIQUE("driver_user_id")
);
--> statement-breakpoint
ALTER TABLE "driver_statuses" ADD CONSTRAINT "driver_statuses_driver_user_id_users_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_statuses" ADD CONSTRAINT "driver_statuses_current_ride_id_ride_requests_id_fk" FOREIGN KEY ("current_ride_id") REFERENCES "public"."ride_requests"("id") ON DELETE set null ON UPDATE no action;