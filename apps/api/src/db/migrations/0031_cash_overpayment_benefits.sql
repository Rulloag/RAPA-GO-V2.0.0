-- RAPA GO Bloque 05
-- Beneficios por pago de más en efectivo y devoluciones de tarjeta idempotentes.

ALTER TABLE "ride_requests"
  ADD COLUMN IF NOT EXISTS "payment_method" varchar(30),
  ADD COLUMN IF NOT EXISTS "payment_provider" varchar(40),
  ADD COLUMN IF NOT EXISTS "wallet_benefit_requested" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "wallet_benefit_applied_clp" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "wallet_benefit_reversed_clp" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "wallet_benefit_reversed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "fare_before_wallet_benefit_clp" integer;

-- Compatibilidad con viajes antiguos mientras la app migra a columnas reales.
UPDATE "ride_requests"
SET "payment_method" = CASE
  WHEN lower(coalesce("notes", '')) LIKE '%paymentmethod: card%'
    OR lower(coalesce("notes", '')) LIKE '%mercadopago%'
    OR lower(coalesce("notes", '')) LIKE '%mercado pago%'
    OR lower(coalesce("notes", '')) LIKE '%tarjeta%'
    THEN 'card'
  WHEN lower(coalesce("notes", '')) LIKE '%paymentmethod: cash%'
    OR lower(coalesce("notes", '')) LIKE '%efectivo%'
    THEN 'cash'
  ELSE NULL
END
WHERE "payment_method" IS NULL;

UPDATE "ride_requests"
SET "fare_before_wallet_benefit_clp" = "estimated_fare_clp"
WHERE "fare_before_wallet_benefit_clp" IS NULL;

CREATE TABLE IF NOT EXISTS "cash_overpayment_benefits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_ride_id" uuid NOT NULL,
  "owner_user_id" uuid NOT NULL,
  "requested_by_user_id" uuid NOT NULL,
  "status" varchar(40) DEFAULT 'pending_admin_review' NOT NULL,
  "fare_clp" integer NOT NULL,
  "paid_clp" integer NOT NULL,
  "requested_amount_clp" integer NOT NULL,
  "approved_amount_clp" integer,
  "request_reason" text,
  "admin_decision_reason" text,
  "reviewed_by_user_id" uuid,
  "reviewed_at" timestamp with time zone,
  "wallet_transaction_id" uuid,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "cash_overpayment_benefits_source_ride_id_ride_requests_id_fk"
    FOREIGN KEY ("source_ride_id") REFERENCES "public"."ride_requests"("id")
    ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "cash_overpayment_benefits_owner_user_id_users_id_fk"
    FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id")
    ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "cash_overpayment_benefits_requested_by_user_id_users_id_fk"
    FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id")
    ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "cash_overpayment_benefits_reviewed_by_user_id_users_id_fk"
    FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id")
    ON DELETE set null ON UPDATE no action,
  CONSTRAINT "cash_overpayment_benefits_wallet_transaction_id_transactions_id_fk"
    FOREIGN KEY ("wallet_transaction_id") REFERENCES "public"."transactions"("id")
    ON DELETE set null ON UPDATE no action,
  CONSTRAINT "cash_overpayment_benefits_amounts_check"
    CHECK (
      "fare_clp" >= 0
      AND "paid_clp" > "fare_clp"
      AND "requested_amount_clp" = "paid_clp" - "fare_clp"
      AND ("approved_amount_clp" IS NULL OR (
        "approved_amount_clp" >= 0
        AND "approved_amount_clp" <= "requested_amount_clp"
      ))
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS "cash_overpayment_benefits_source_ride_uidx"
  ON "cash_overpayment_benefits" USING btree ("source_ride_id");

CREATE UNIQUE INDEX IF NOT EXISTS "cash_overpayment_benefits_wallet_transaction_uidx"
  ON "cash_overpayment_benefits" USING btree ("wallet_transaction_id")
  WHERE "wallet_transaction_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "cash_overpayment_benefits_owner_status_idx"
  ON "cash_overpayment_benefits" USING btree ("owner_user_id", "status");

CREATE INDEX IF NOT EXISTS "cash_overpayment_benefits_status_created_idx"
  ON "cash_overpayment_benefits" USING btree ("status", "created_at");

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "refund_status" varchar(32),
  ADD COLUMN IF NOT EXISTS "refund_provider_id" varchar(160),
  ADD COLUMN IF NOT EXISTS "refund_idempotency_key" varchar(160),
  ADD COLUMN IF NOT EXISTS "refund_requested_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "refunded_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "refund_failed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "refund_failure_reason" text;

CREATE INDEX IF NOT EXISTS "payments_refund_status_idx"
  ON "payments" USING btree ("refund_status");

CREATE UNIQUE INDEX IF NOT EXISTS "payments_refund_idempotency_key_uidx"
  ON "payments" USING btree ("refund_idempotency_key")
  WHERE "refund_idempotency_key" IS NOT NULL;
