-- FASE 6 — Reconciliación de columnas legacy de `payments`.
--
-- Contexto: la base de desarrollo real (`rapago`) tiene una versión de `payments` anterior a un
-- renombre que sí se aplicó en `payments.schema.ts` y en todo el código (payments.repository.ts,
-- payments.service.ts, providers de MercadoPago/ProntoPaga) pero nunca se migró en la base real:
--   external_id     (legacy, DB real) == provider_payment_id (código y migración 0017)
--   webhook_payload (legacy, DB real) == raw_provider_payload (código y migración 0017)
-- Confirmado por lectura de código: extractMercadoPagoPaymentId(), markSuccess(),
-- markRejected(), markRefunded() y getStoredRefundStatus() en payments.service.ts /
-- payments.repository.ts usan EXCLUSIVAMENTE providerPaymentId/rawProviderPayload — ningún
-- código lee ni escribe una columna llamada external_id/webhook_payload directamente.
--
-- Esta migración es IDEMPOTENTE y segura tanto para:
--   (a) un entorno fresco creado por 0017_next_natasha_romanoff.sql (ya tiene
--       provider_payment_id/raw_provider_payload, nunca tuvo external_id/webhook_payload), y
--   (b) un entorno legacy tipo `rapago` (tiene external_id/webhook_payload, no tiene las
--       columnas nuevas).
-- No elimina ninguna columna legacy ni pierde datos históricos — ver Paso 4 del informe de Fase 6
-- para el plan de retiro futuro de external_id/webhook_payload.

-- 1) Agrega las columnas canónicas si no existen (no-op en un entorno ya creado por 0017).
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_payment_id VARCHAR(160);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS raw_provider_payload JSONB;
--> statement-breakpoint

-- 2) Backfill condicional: solo si las columnas legacy existen en este entorno (rama que nunca
--    se ejecuta en un entorno creado desde cero por 0017, porque ahí external_id no existe).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'external_id'
  ) THEN
    UPDATE payments
    SET provider_payment_id = external_id
    WHERE provider_payment_id IS NULL AND external_id IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'webhook_payload'
  ) THEN
    UPDATE payments
    SET raw_provider_payload = webhook_payload
    WHERE raw_provider_payload IS NULL AND webhook_payload IS NOT NULL;
  END IF;
END $$;
--> statement-breakpoint

-- 3) Índice/constraint de negocio detectado en la base real pero ausente de schema.ts: evita más
--    de un pago activo (pending/processing) simultáneo por viaje. Se versiona aquí porque no es
--    expresable con el helper `index()` estándar de Drizzle (índice único parcial con WHERE).
CREATE UNIQUE INDEX IF NOT EXISTS payments_ride_active_idx
  ON payments (ride_request_id)
  WHERE status IN ('pending', 'processing');
--> statement-breakpoint

-- 4) Índice de lectura para markSuccess/extractMercadoPagoPaymentId (búsqueda por ID del
--    proveedor durante conciliación y refunds).
CREATE INDEX IF NOT EXISTS payments_provider_payment_id_idx ON payments (provider_payment_id);