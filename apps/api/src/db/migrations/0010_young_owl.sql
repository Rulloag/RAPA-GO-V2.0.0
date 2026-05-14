CREATE TABLE "ride_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ride_request_id" uuid NOT NULL,
	"rater_user_id" uuid NOT NULL,
	"rated_user_id" uuid NOT NULL,
	"rater_role" varchar(30) NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_ride_rater" UNIQUE("ride_request_id","rater_user_id")
);
--> statement-breakpoint
ALTER TABLE "ride_ratings" ADD CONSTRAINT "ride_ratings_ride_request_id_ride_requests_id_fk" FOREIGN KEY ("ride_request_id") REFERENCES "public"."ride_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_ratings" ADD CONSTRAINT "ride_ratings_rater_user_id_users_id_fk" FOREIGN KEY ("rater_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_ratings" ADD CONSTRAINT "ride_ratings_rated_user_id_users_id_fk" FOREIGN KEY ("rated_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;