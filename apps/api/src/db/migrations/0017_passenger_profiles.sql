CREATE TABLE IF NOT EXISTS "passenger_profiles" (
  "id"                      uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"                 uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "phone"                   text,
  "preferred_language"      text NOT NULL DEFAULT 'es',
  "notification_enabled"    boolean NOT NULL DEFAULT true,
  "email_notifications"     boolean NOT NULL DEFAULT true,
  "sms_notifications"       boolean NOT NULL DEFAULT false,
  "emergency_contact_name"  text,
  "emergency_contact_phone" text,
  "created_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"              timestamp with time zone NOT NULL DEFAULT now()
);
