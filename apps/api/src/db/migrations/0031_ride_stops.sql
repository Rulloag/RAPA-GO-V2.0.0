-- Parte 23: Viajes multi-destino — estructura base
-- Agrega current_stop_order a ride_requests y crea tabla ride_stops

-- 1. Agregar columna current_stop_order a ride_requests
ALTER TABLE ride_requests
  ADD COLUMN IF NOT EXISTS current_stop_order INTEGER NOT NULL DEFAULT 1;

-- 2. Crear tabla ride_stops
CREATE TABLE IF NOT EXISTS ride_stops (
  id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_request_id          UUID         NOT NULL REFERENCES ride_requests(id) ON DELETE CASCADE,
  stop_order               INTEGER      NOT NULL,
  label                    TEXT         NOT NULL,
  lat                      DOUBLE PRECISION NOT NULL,
  lng                      DOUBLE PRECISION NOT NULL,
  segment_distance_meters  INTEGER,
  segment_duration_seconds INTEGER,
  segment_fare_clp         INTEGER,
  arrived_at               TIMESTAMPTZ,
  completed_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT chk_ride_stops_stop_order_positive
    CHECK (stop_order >= 1),
  CONSTRAINT chk_ride_stops_segment_distance
    CHECK (segment_distance_meters IS NULL OR segment_distance_meters >= 0),
  CONSTRAINT chk_ride_stops_segment_duration
    CHECK (segment_duration_seconds IS NULL OR segment_duration_seconds >= 0),
  CONSTRAINT chk_ride_stops_segment_fare
    CHECK (segment_fare_clp IS NULL OR segment_fare_clp >= 0),
  CONSTRAINT uq_ride_stops_ride_order
    UNIQUE (ride_request_id, stop_order)
);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_ride_stops_ride_request_id
  ON ride_stops (ride_request_id);

CREATE INDEX IF NOT EXISTS idx_ride_stops_ride_order
  ON ride_stops (ride_request_id, stop_order);

-- 4. Insertar fare setting extra_stop_fee (inactivo por ahora)
INSERT INTO fare_settings (type, name, value, currency, description, is_active, effective_from)
VALUES (
  'extra_stop_fee',
  'Recargo parada adicional',
  1000,
  'CLP',
  'Cargo opcional por destino adicional en viajes multi-destino',
  false,
  '2026-06-01'
)
ON CONFLICT (type, effective_from) DO NOTHING;
