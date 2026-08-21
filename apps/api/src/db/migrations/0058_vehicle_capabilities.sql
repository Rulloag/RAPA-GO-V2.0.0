-- Capacidades de vehículo no excluyentes (XL / Extra Maletas / Confort).
-- Backward-compatible: conserva driver_profiles.vehicle_category como etiqueta legacy.

ALTER TABLE driver_profiles
  ADD COLUMN IF NOT EXISTS capability_xl boolean NOT NULL DEFAULT false;

ALTER TABLE driver_profiles
  ADD COLUMN IF NOT EXISTS capability_extra_luggage boolean NOT NULL DEFAULT false;

ALTER TABLE driver_profiles
  ADD COLUMN IF NOT EXISTS capability_comfort boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN driver_profiles.capability_xl IS
  'Capacidad XL aprobada por administración. Independiente de Extra Maletas y Confort.';

COMMENT ON COLUMN driver_profiles.capability_extra_luggage IS
  'Capacidad Extra Maletas aprobada. Independiente de XL y Confort.';

COMMENT ON COLUMN driver_profiles.capability_comfort IS
  'Capacidad Confort aprobada por administración. El año mínimo se revalida en cada accept.';

COMMENT ON COLUMN driver_profiles.vehicle_category IS
  'Etiqueta primaria legacy (display/compat). Capacidades reales: capability_*.';

-- Backfill desde categoría única previa (sin pérdida).
UPDATE driver_profiles
SET
  capability_xl = CASE
    WHEN lower(coalesce(vehicle_category, '')) IN ('xl') THEN true
    ELSE capability_xl
  END,
  capability_extra_luggage = CASE
    WHEN lower(coalesce(vehicle_category, '')) IN ('extra_luggage', 'luggage') THEN true
    ELSE capability_extra_luggage
  END,
  capability_comfort = CASE
    WHEN lower(coalesce(vehicle_category, '')) IN ('comfort', 'confort') THEN true
    ELSE capability_comfort
  END
WHERE true;

-- Snapshot de patente al aceptar (demostrabilidad histórica).
ALTER TABLE ride_requests
  ADD COLUMN IF NOT EXISTS assigned_vehicle_plate varchar(30);

COMMENT ON COLUMN ride_requests.assigned_vehicle_plate IS
  'Patente del vehículo del conductor al aceptar (snapshot).';
