CREATE TABLE IF NOT EXISTS "auth_identities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" varchar(30) NOT NULL,
  "provider_subject" varchar(255) NOT NULL,
  "provider_email" varchar(255),
  "email_verified" boolean NOT NULL DEFAULT false,
  "linked_at" timestamp with time zone NOT NULL DEFAULT now(),
  "last_login_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "auth_identities_provider_subject_uidx"
  ON "auth_identities" ("provider", "provider_subject");

CREATE UNIQUE INDEX IF NOT EXISTS "auth_identities_user_provider_uidx"
  ON "auth_identities" ("user_id", "provider");

CREATE INDEX IF NOT EXISTS "auth_identities_user_idx"
  ON "auth_identities" ("user_id");

ALTER TABLE "facebook_login_exchanges"
  ADD COLUMN IF NOT EXISTS "purpose" varchar(20) NOT NULL DEFAULT 'login';

CREATE INDEX IF NOT EXISTS "facebook_login_exchanges_purpose_idx"
  ON "facebook_login_exchanges" ("purpose", "expires_at");

ALTER TABLE "account_deletion_requests"
  ADD COLUMN IF NOT EXISTS "deadline_at" timestamp with time zone;

ALTER TABLE "account_deletion_requests"
  ADD COLUMN IF NOT EXISTS "deferred_until" timestamp with time zone;

ALTER TABLE "account_deletion_requests"
  ADD COLUMN IF NOT EXISTS "decision_reason_code" varchar(60);

ALTER TABLE "account_deletion_requests"
  ADD COLUMN IF NOT EXISTS "retention_summary" text;

UPDATE "account_deletion_requests"
SET "deadline_at" = "requested_at" + interval '30 days'
WHERE "deadline_at" IS NULL;

ALTER TABLE "account_deletion_requests"
  ALTER COLUMN "deadline_at" SET DEFAULT (now() + interval '30 days');

ALTER TABLE "account_deletion_requests"
  ALTER COLUMN "deadline_at" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "account_deletion_requests_deadline_idx"
  ON "account_deletion_requests" ("status", "deadline_at");
