CREATE TABLE IF NOT EXISTS "ride_location_updates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ride_id" uuid NOT NULL,
  "driver_user_id" uuid NOT NULL,
  "latitude" double precision NOT NULL,
  "longitude" double precision NOT NULL,
  "accuracy_meters" real,
  "heading_degrees" real,
  "speed_meters_per_second" real,
  "altitude_meters" real,
  "captured_at" timestamp with time zone NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "source" varchar(30) DEFAULT 'foreground_native' NOT NULL,
  "app_state" varchar(20) DEFAULT 'foreground' NOT NULL,
  "sequence_number" integer,
  "is_mocked" boolean DEFAULT false NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "ride_location_updates"
    ADD CONSTRAINT "ride_location_updates_ride_id_ride_requests_id_fk"
    FOREIGN KEY ("ride_id")
    REFERENCES "public"."ride_requests"("id")
    ON DELETE cascade
    ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ride_location_updates"
    ADD CONSTRAINT "ride_location_updates_driver_user_id_users_id_fk"
    FOREIGN KEY ("driver_user_id")
    REFERENCES "public"."users"("id")
    ON DELETE restrict
    ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ride_location_updates_ride_captured_idx"
  ON "ride_location_updates" USING btree ("ride_id", "captured_at");

CREATE INDEX IF NOT EXISTS "ride_location_updates_driver_captured_idx"
  ON "ride_location_updates" USING btree ("driver_user_id", "captured_at");

CREATE INDEX IF NOT EXISTS "ride_location_updates_expires_idx"
  ON "ride_location_updates" USING btree ("expires_at");

CREATE UNIQUE INDEX IF NOT EXISTS "ride_location_updates_dedupe_uidx"
  ON "ride_location_updates" USING btree ("ride_id", "driver_user_id", "captured_at");
