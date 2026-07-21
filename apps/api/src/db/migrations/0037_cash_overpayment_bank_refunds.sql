-- RAPA GO Bloque A (puntos 12-16)
-- Devoluciones bancarias verificables por pago de más en efectivo.

CREATE TABLE IF NOT EXISTS "cash_overpayment_refund_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_ride_id" uuid NOT NULL,
  "owner_user_id" uuid NOT NULL,
  "requested_by_user_id" uuid NOT NULL,
  "bank_account_id" uuid NOT NULL,
  "status" varchar(40) DEFAULT 'pending_admin_review' NOT NULL,
  "fare_clp" integer NOT NULL,
  "paid_clp" integer NOT NULL,
  "requested_amount_clp" integer NOT NULL,
  "approved_amount_clp" integer,
  "request_reason" text,
  "admin_decision_reason" text,
  "bank_account_holder_name" varchar(150) NOT NULL,
  "bank_name" varchar(100) NOT NULL,
  "bank_account_type" varchar(50) NOT NULL,
  "bank_account_number_last4" varchar(4) NOT NULL,
  "bank_account_number_encrypted" text NOT NULL,
  "transfer_reference" varchar(180),
  "transfer_proof_url" text,
  "reviewed_by_user_id" uuid,
  "reviewed_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "cash_overpayment_refunds_source_ride_fk"
    FOREIGN KEY ("source_ride_id") REFERENCES "public"."ride_requests"("id")
    ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "cash_overpayment_refunds_owner_user_fk"
    FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id")
    ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "cash_overpayment_refunds_requested_by_user_fk"
    FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id")
    ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "cash_overpayment_refunds_bank_account_fk"
    FOREIGN KEY ("bank_account_id") REFERENCES "public"."user_bank_accounts"("id")
    ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "cash_overpayment_refunds_reviewed_by_user_fk"
    FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id")
    ON DELETE set null ON UPDATE no action,
  CONSTRAINT "cash_overpayment_refunds_amounts_check"
    CHECK (
      "fare_clp" >= 0
      AND "paid_clp" > "fare_clp"
      AND "requested_amount_clp" = "paid_clp" - "fare_clp"
      AND (
        "approved_amount_clp" IS NULL
        OR (
          "approved_amount_clp" > 0
          AND "approved_amount_clp" <= "requested_amount_clp"
        )
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS "cash_overpayment_refunds_source_ride_uidx"
  ON "cash_overpayment_refund_requests" USING btree ("source_ride_id");

CREATE INDEX IF NOT EXISTS "cash_overpayment_refunds_owner_status_idx"
  ON "cash_overpayment_refund_requests" USING btree ("owner_user_id", "status");

CREATE INDEX IF NOT EXISTS "cash_overpayment_refunds_status_created_idx"
  ON "cash_overpayment_refund_requests" USING btree ("status", "created_at");

CREATE OR REPLACE FUNCTION "prevent_duplicate_cash_overpayment_resolution"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'cash_overpayment_benefits' THEN
    IF EXISTS (
      SELECT 1
      FROM "cash_overpayment_refund_requests"
      WHERE "source_ride_id" = NEW."source_ride_id"
    ) THEN
      RAISE EXCEPTION 'El viaje ya tiene una devolución bancaria registrada.'
        USING ERRCODE = '23505';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1
      FROM "cash_overpayment_benefits"
      WHERE "source_ride_id" = NEW."source_ride_id"
    ) THEN
      RAISE EXCEPTION 'El viaje ya tiene un Beneficio registrado.'
        USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "cash_overpayment_benefit_exclusive_resolution"
  ON "cash_overpayment_benefits";
CREATE TRIGGER "cash_overpayment_benefit_exclusive_resolution"
BEFORE INSERT OR UPDATE OF "source_ride_id"
ON "cash_overpayment_benefits"
FOR EACH ROW
EXECUTE FUNCTION "prevent_duplicate_cash_overpayment_resolution"();

DROP TRIGGER IF EXISTS "cash_overpayment_refund_exclusive_resolution"
  ON "cash_overpayment_refund_requests";
CREATE TRIGGER "cash_overpayment_refund_exclusive_resolution"
BEFORE INSERT OR UPDATE OF "source_ride_id"
ON "cash_overpayment_refund_requests"
FOR EACH ROW
EXECUTE FUNCTION "prevent_duplicate_cash_overpayment_resolution"();
