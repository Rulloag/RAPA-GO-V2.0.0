CREATE TABLE "driver_rest_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_user_id" uuid NOT NULL,
	"schedule_id" uuid NOT NULL,
	"scheduled_start_at" timestamp with time zone NOT NULL,
	"actual_start_at" timestamp with time zone,
	"required_end_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"status" varchar(40) DEFAULT 'scheduled' NOT NULL,
	"delayed_by_ride_id" uuid,
	"duration_minutes" integer DEFAULT 720 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_rest_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_user_id" uuid NOT NULL,
	"start_minute_local" integer NOT NULL,
	"duration_minutes" integer DEFAULT 720 NOT NULL,
	"timezone" varchar(64) DEFAULT 'Pacific/Easter' NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ride_driver_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ride_request_id" uuid NOT NULL,
	"driver_user_id" uuid NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"elapsed_seconds" integer,
	"outcome" varchar(40) DEFAULT 'active' NOT NULL,
	"cancellation_reason" text,
	"cancelled_by_user_id" uuid,
	"cancelled_by_role" varchar(30),
	"cancellation_event" varchar(80),
	"location_lat" double precision,
	"location_lng" double precision,
	"location_accuracy_meters" double precision,
	"location_captured_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "driver_rest_periods" ADD CONSTRAINT "driver_rest_periods_driver_user_id_users_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_rest_periods" ADD CONSTRAINT "driver_rest_periods_schedule_id_driver_rest_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."driver_rest_schedules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_rest_periods" ADD CONSTRAINT "driver_rest_periods_delayed_by_ride_id_ride_requests_id_fk" FOREIGN KEY ("delayed_by_ride_id") REFERENCES "public"."ride_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_rest_schedules" ADD CONSTRAINT "driver_rest_schedules_driver_user_id_users_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_rest_schedules" ADD CONSTRAINT "driver_rest_schedules_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_driver_assignments" ADD CONSTRAINT "ride_driver_assignments_ride_request_id_ride_requests_id_fk" FOREIGN KEY ("ride_request_id") REFERENCES "public"."ride_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_driver_assignments" ADD CONSTRAINT "ride_driver_assignments_driver_user_id_users_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_driver_assignments" ADD CONSTRAINT "ride_driver_assignments_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "driver_rest_periods_driver_scheduled_unique" ON "driver_rest_periods" USING btree ("driver_user_id","scheduled_start_at");--> statement-breakpoint
CREATE INDEX "driver_rest_periods_driver_status_idx" ON "driver_rest_periods" USING btree ("driver_user_id","status","required_end_at");--> statement-breakpoint
CREATE UNIQUE INDEX "driver_rest_schedules_driver_effective_unique" ON "driver_rest_schedules" USING btree ("driver_user_id","effective_from");--> statement-breakpoint
CREATE INDEX "driver_rest_schedules_driver_effective_idx" ON "driver_rest_schedules" USING btree ("driver_user_id","effective_from","effective_to");--> statement-breakpoint
CREATE UNIQUE INDEX "ride_driver_assignments_ride_driver_accepted_unique" ON "ride_driver_assignments" USING btree ("ride_request_id","driver_user_id","accepted_at");--> statement-breakpoint
CREATE INDEX "ride_driver_assignments_ride_outcome_idx" ON "ride_driver_assignments" USING btree ("ride_request_id","outcome");--> statement-breakpoint
CREATE INDEX "ride_driver_assignments_driver_accepted_idx" ON "ride_driver_assignments" USING btree ("driver_user_id","accepted_at");