ALTER TABLE "auth_identities"
  ADD COLUMN IF NOT EXISTS "provider_is_private_email" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "auth_identities"
  ADD COLUMN IF NOT EXISTS "encrypted_refresh_token" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_identities_apple_user_idx"
  ON "auth_identities" ("user_id")
  WHERE "provider" = 'apple' AND "revoked_at" IS NULL;
