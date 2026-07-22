CREATE TABLE IF NOT EXISTS "account_deletion_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "requester_role" varchar(30) NOT NULL,
  "reason" varchar(500) NOT NULL,
  "comment" text,
  "requester_snapshot" jsonb,
  "status" varchar(30) DEFAULT 'pending' NOT NULL,
  "reviewed_by_user_id" uuid,
  "admin_note" text,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reviewed_at" timestamp with time zone,
  "processing_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  "failure_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "account_deletion_requests"
    ADD CONSTRAINT "account_deletion_requests_user_id_users_id_fk"
    FOREIGN KEY ("user_id")
    REFERENCES "public"."users"("id")
    ON DELETE set null
    ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "account_deletion_requests"
    ADD CONSTRAINT "account_deletion_requests_reviewed_by_user_id_users_id_fk"
    FOREIGN KEY ("reviewed_by_user_id")
    REFERENCES "public"."users"("id")
    ON DELETE set null
    ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS
  "account_deletion_requests_user_requested_idx"
ON "account_deletion_requests" ("user_id", "requested_at");

CREATE INDEX IF NOT EXISTS
  "account_deletion_requests_status_requested_idx"
ON "account_deletion_requests" ("status", "requested_at");

CREATE UNIQUE INDEX IF NOT EXISTS
  "account_deletion_requests_one_open_per_user_uidx"
ON "account_deletion_requests" ("user_id")
WHERE "status" IN ('pending', 'approved', 'processing');
