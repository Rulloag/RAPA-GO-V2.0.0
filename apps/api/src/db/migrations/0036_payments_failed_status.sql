-- Migration: 0029_payments_failed_status
-- Adds failed_at column to payments and updates the active-payment partial index
-- to exclude 'failed' so passengers can retry after a provider error.

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "failed_at" timestamp with time zone;

-- Recreate the partial index to exclude failed payments, allowing retries
DROP INDEX IF EXISTS "payments_ride_active_idx";

CREATE UNIQUE INDEX "payments_ride_active_idx"
  ON "payments" ("ride_request_id")
  WHERE status IN ('pending', 'processing');
-- Note: 'failed' is intentionally excluded so a new payment can be created after failure.
