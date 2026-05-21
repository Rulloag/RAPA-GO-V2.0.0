ALTER TABLE "ride_requests" ADD COLUMN "is_offline_booking" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ride_requests" ADD COLUMN "offline_passenger_name" varchar(120);--> statement-breakpoint
ALTER TABLE "ride_requests" ADD COLUMN "offline_passenger_phone" varchar(30);--> statement-breakpoint
ALTER TABLE "ride_requests" ADD COLUMN "offline_passenger_email" varchar(200);--> statement-breakpoint
ALTER TABLE "offline_bookings" ADD COLUMN "passenger_email" text;