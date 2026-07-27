-- Parte 16: viajes programados prioritarios
-- Agrega campos de programación a ride_requests y registra el recargo en fare_settings

ALTER TABLE ride_requests
  ADD COLUMN IF NOT EXISTS ride_type             VARCHAR(20)  NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS scheduled_pickup_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority_fee_clp      INTEGER,
  ADD COLUMN IF NOT EXISTS flight_number         VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_ride_requests_scheduled
  ON ride_requests (scheduled_pickup_at ASC)
  WHERE ride_type = 'scheduled'
    AND status NOT IN ('completed', 'cancelled');

INSERT INTO fare_settings (type, name, value, currency, description, is_active, effective_from)
VALUES (
  'priority_surcharge',
  'Recargo reserva prioritaria',
  2000,
  'CLP',
  'Cargo fijo por viaje programado con prioridad',
  true,
  '2026-06-01'
)
ON CONFLICT (type, effective_from) DO NOTHING;
