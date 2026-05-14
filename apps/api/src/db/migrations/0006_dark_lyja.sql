ALTER TABLE "ride_requests" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "ride_requests" ADD COLUMN "cancelled_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "ride_requests" ADD COLUMN "cancelled_by_role" varchar(30);--> statement-breakpoint
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;