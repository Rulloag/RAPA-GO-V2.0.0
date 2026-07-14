CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ride_request_id" uuid NOT NULL,
	"passenger_user_id" uuid NOT NULL,
	"amount_clp" integer NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"provider" varchar(32) NOT NULL,
	"provider_order_id" varchar(160),
	"provider_payment_id" varchar(160),
	"url_pay" text,
	"raw_provider_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"failed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_ride_request_id_ride_requests_id_fk" FOREIGN KEY ("ride_request_id") REFERENCES "public"."ride_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_passenger_user_id_users_id_fk" FOREIGN KEY ("passenger_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_ride_request_id_idx" ON "payments" USING btree ("ride_request_id");--> statement-breakpoint
CREATE INDEX "payments_passenger_user_id_idx" ON "payments" USING btree ("passenger_user_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_provider_order_id_idx" ON "payments" USING btree ("provider_order_id");