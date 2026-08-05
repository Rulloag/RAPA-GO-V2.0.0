-- RAPA GO 0052: captura diferida de Klap Checkout (autorización + captura).
-- Idempotente: ALTER TABLE ... ADD COLUMN IF NOT EXISTS, seguro de re-ejecutar.
--
-- Estados financieros nuevos que puede tomar payments.status para provider = 'klap':
--   authorized        -> tarjeta autorizada, NO cobrada todavía.
--   capture_pending    -> el backend inició la captura (reclamada atómicamente).
--   capture_unknown    -> timeout/error de red/HTTP 5xx: no se sabe si Klap
--                         procesó la captura. Nunca se reintenta automáticamente.
--   capture_failed     -> Klap rechazó la captura definitivamente (HTTP 4xx).
-- "success" se mantiene como el único estado en que paidAt/capturedAt quedan
-- establecidos — es decir, dinero realmente cobrado.

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "transaction_type" varchar(32),
  ADD COLUMN IF NOT EXISTS "authorized_amount_clp" integer,
  ADD COLUMN IF NOT EXISTS "captured_amount_clp" integer,
  ADD COLUMN IF NOT EXISTS "authorized_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "capture_requested_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "captured_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "capture_failed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "capture_failure_reason" text,
  ADD COLUMN IF NOT EXISTS "capture_provider_payload" jsonb,
  ADD COLUMN IF NOT EXISTS "capture_attempt_key" varchar(160);
