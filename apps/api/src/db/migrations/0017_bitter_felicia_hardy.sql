CREATE TABLE "ride_policy_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_ride_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"type" varchar(40) NOT NULL,
	"status" varchar(50) DEFAULT 'pending_admin_review' NOT NULL,
	"payment_method" varchar(30),
	"applicable_fare_clp" integer NOT NULL,
	"fee_percent" integer NOT NULL,
	"fee_cap_clp" integer NOT NULL,
	"calculated_amount_clp" integer NOT NULL,
	"approved_amount_clp" integer,
	"reason" text,
	"admin_decision_reason" text,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"applied_to_ride_id" uuid,
	"applied_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ride_policy_charges" ADD CONSTRAINT "ride_policy_charges_source_ride_id_ride_requests_id_fk" FOREIGN KEY ("source_ride_id") REFERENCES "public"."ride_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_policy_charges" ADD CONSTRAINT "ride_policy_charges_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_policy_charges" ADD CONSTRAINT "ride_policy_charges_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_policy_charges" ADD CONSTRAINT "ride_policy_charges_applied_to_ride_id_ride_requests_id_fk" FOREIGN KEY ("applied_to_ride_id") REFERENCES "public"."ride_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ride_policy_charges_source_ride_type_unique" ON "ride_policy_charges" USING btree ("source_ride_id","type");--> statement-breakpoint
CREATE INDEX "ride_policy_charges_owner_status_idx" ON "ride_policy_charges" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE INDEX "ride_policy_charges_applied_ride_idx" ON "ride_policy_charges" USING btree ("applied_to_ride_id");