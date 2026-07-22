CREATE TABLE IF NOT EXISTS "facebook_login_exchanges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "code_hash" varchar(64) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "fb_login_exchange_user_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_fb_login_exchange_code_hash"
  ON "facebook_login_exchanges" USING btree ("code_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_fb_login_exchange_user"
  ON "facebook_login_exchanges" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_fb_login_exchange_expires"
  ON "facebook_login_exchanges" USING btree ("expires_at");
