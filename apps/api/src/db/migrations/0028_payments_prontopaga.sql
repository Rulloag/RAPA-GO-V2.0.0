-- Migration: 0028_payments_prontopaga
-- Creates the payments table for ProntoPaga integration

CREATE TABLE IF NOT EXISTS "payments" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ride_request_id"  uuid NOT NULL REFERENCES "ride_requests"("id") ON DELETE CASCADE,
  "passenger_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider"         varchar(30) NOT NULL DEFAULT 'prontopaga',
  "provider_order_id" varchar(100),
  "external_id"      varchar(100),
  "amount_clp"       integer NOT NULL,
  "status"           varchar(30) NOT NULL DEFAULT 'pending',
  "url_pay"          text,
  "webhook_payload"  jsonb,
  "paid_at"          timestamp with time zone,
  "rejected_at"      timestamp with time zone,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"       timestamp with time zone NOT NULL DEFAULT now()
);

-- Prevent duplicate pending/processing payments for the same ride
CREATE UNIQUE INDEX IF NOT EXISTS "payments_ride_active_idx"
  ON "payments" ("ride_request_id")
  WHERE status IN ('pending', 'processing');
