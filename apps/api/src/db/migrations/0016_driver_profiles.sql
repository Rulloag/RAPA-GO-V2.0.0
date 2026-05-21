ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "driver_profiles" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"           uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "phone"             text,
  "vehicle_brand"     text,
  "vehicle_model"     text,
  "vehicle_year"      integer,
  "vehicle_plate"     text,
  "vehicle_color"     text,
  "license_number"    text,
  "license_expiry"    date,
  "profile_photo_url" text,
  "bio"               text,
  "languages"         text[],
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now()
);
