ALTER TABLE "payments"
ADD COLUMN IF NOT EXISTS "payment_purpose" varchar(32) NOT NULL DEFAULT 'ride';

UPDATE "payments"
SET "payment_purpose" = 'ride'
WHERE "payment_purpose" IS NULL OR btrim("payment_purpose") = '';

CREATE INDEX IF NOT EXISTS "payments_ride_purpose_status_idx"
ON "payments" ("ride_request_id", "payment_purpose", "status");