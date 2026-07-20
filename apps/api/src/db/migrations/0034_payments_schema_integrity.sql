-- RAPA GO Bloque 08-A1
-- Reparación idempotente para instalaciones existentes y futuras.

-- ---------------------------------------------------------------------------
-- Bloque 08-A1: base idempotente de pagos para instalaciones nuevas y antiguas.
-- Debe aparecer antes del primer ALTER TABLE "payments".
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "wallets" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    UUID NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "balance"    INTEGER NOT NULL DEFAULT 0,
  "currency"   TEXT NOT NULL DEFAULT 'CLP',
  "status"     TEXT NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "payment_methods" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"        UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type"           TEXT NOT NULL,
  "provider"       TEXT,
  "provider_token" TEXT,
  "last_four"      TEXT,
  "expiry_month"   INTEGER,
  "expiry_year"    INTEGER,
  "is_default"     BOOLEAN NOT NULL DEFAULT FALSE,
  "status"         TEXT NOT NULL DEFAULT 'active',
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "transactions" (
  "id"                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "wallet_id"               UUID NOT NULL REFERENCES "wallets"("id"),
  "user_id"                 UUID NOT NULL REFERENCES "users"("id"),
  "ride_id"                 UUID REFERENCES "ride_requests"("id"),
  "type"                    TEXT NOT NULL,
  "amount"                  INTEGER NOT NULL,
  "currency"                TEXT NOT NULL DEFAULT 'CLP',
  "status"                  TEXT NOT NULL DEFAULT 'pending',
  "provider"                TEXT,
  "provider_transaction_id" TEXT,
  "description"             TEXT,
  "metadata"                JSONB,
  "created_at"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "payment_orders" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"           UUID NOT NULL REFERENCES "users"("id"),
  "ride_id"           UUID REFERENCES "ride_requests"("id"),
  "amount"            INTEGER NOT NULL,
  "currency"          TEXT NOT NULL DEFAULT 'CLP',
  "status"            TEXT NOT NULL DEFAULT 'pending',
  "provider"          TEXT,
  "provider_order_id" TEXT,
  "payment_url"       TEXT,
  "expires_at"        TIMESTAMPTZ,
  "completed_at"      TIMESTAMPTZ,
  "metadata"          JSONB,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "payments" (
  "id"                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ride_request_id"        UUID NOT NULL REFERENCES "ride_requests"("id") ON DELETE CASCADE,
  "passenger_user_id"      UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount_clp"             INTEGER NOT NULL,
  "payment_purpose"        VARCHAR(32) NOT NULL DEFAULT 'ride',
  "status"                 VARCHAR(32) NOT NULL DEFAULT 'pending',
  "provider"               VARCHAR(32) NOT NULL,
  "provider_order_id"      VARCHAR(160),
  "provider_payment_id"    VARCHAR(160),
  "url_pay"                TEXT,
  "raw_provider_payload"   JSONB,
  "refund_status"          VARCHAR(32),
  "refund_provider_id"     VARCHAR(160),
  "refund_idempotency_key" VARCHAR(160),
  "refund_requested_at"    TIMESTAMPTZ,
  "refunded_at"            TIMESTAMPTZ,
  "refund_failed_at"       TIMESTAMPTZ,
  "refund_failure_reason"  TEXT,
  "created_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "paid_at"                TIMESTAMPTZ,
  "rejected_at"            TIMESTAMPTZ,
  "failed_at"              TIMESTAMPTZ
);

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "ride_request_id" uuid,
  ADD COLUMN IF NOT EXISTS "passenger_user_id" uuid,
  ADD COLUMN IF NOT EXISTS "amount_clp" integer,
  ADD COLUMN IF NOT EXISTS "payment_purpose" varchar(32) NOT NULL DEFAULT 'ride',
  ADD COLUMN IF NOT EXISTS "status" varchar(32) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "provider" varchar(32),
  ADD COLUMN IF NOT EXISTS "provider_order_id" varchar(160),
  ADD COLUMN IF NOT EXISTS "provider_payment_id" varchar(160),
  ADD COLUMN IF NOT EXISTS "url_pay" text,
  ADD COLUMN IF NOT EXISTS "raw_provider_payload" jsonb,
  ADD COLUMN IF NOT EXISTS "refund_status" varchar(32),
  ADD COLUMN IF NOT EXISTS "refund_provider_id" varchar(160),
  ADD COLUMN IF NOT EXISTS "refund_idempotency_key" varchar(160),
  ADD COLUMN IF NOT EXISTS "refund_requested_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "refunded_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "refund_failed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "refund_failure_reason" text,
  ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "paid_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "rejected_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "failed_at" timestamp with time zone;

UPDATE "payments"
SET "payment_purpose" = 'ride'
WHERE "payment_purpose" IS NULL OR btrim("payment_purpose") = '';

UPDATE "payments"
SET "status" = 'pending'
WHERE "status" IS NULL OR btrim("status") = '';

CREATE INDEX IF NOT EXISTS "payments_ride_request_id_idx"
  ON "payments" ("ride_request_id");

CREATE INDEX IF NOT EXISTS "payments_passenger_user_id_idx"
  ON "payments" ("passenger_user_id");

CREATE INDEX IF NOT EXISTS "payments_status_idx"
  ON "payments" ("status");

CREATE INDEX IF NOT EXISTS "payments_provider_order_id_idx"
  ON "payments" ("provider_order_id");

CREATE INDEX IF NOT EXISTS "payments_ride_purpose_status_idx"
  ON "payments" ("ride_request_id", "payment_purpose", "status");

CREATE INDEX IF NOT EXISTS "transactions_user_created_idx"
  ON "transactions" ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "transactions_ride_id_idx"
  ON "transactions" ("ride_id");

CREATE INDEX IF NOT EXISTS "transactions_provider_transaction_id_idx"
  ON "transactions" ("provider_transaction_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payments_ride_request_id_ride_requests_id_fk'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_ride_request_id_ride_requests_id_fk"
      FOREIGN KEY ("ride_request_id")
      REFERENCES "public"."ride_requests"("id")
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payments_passenger_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_passenger_user_id_users_id_fk"
      FOREIGN KEY ("passenger_user_id")
      REFERENCES "public"."users"("id")
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "payments_refund_status_idx"
  ON "payments" ("refund_status");

CREATE UNIQUE INDEX IF NOT EXISTS "payments_refund_idempotency_key_uidx"
  ON "payments" ("refund_idempotency_key")
  WHERE "refund_idempotency_key" IS NOT NULL;
