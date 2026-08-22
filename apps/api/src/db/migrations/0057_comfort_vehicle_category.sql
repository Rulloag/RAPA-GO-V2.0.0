-- Categoría Confort (comfort) + configuración administrable.
-- Backward-compatible: columnas ya son varchar(30); no se alteran datos existentes.
-- Multiplicador y año mínimo viven en fare_settings (enteros).

COMMENT ON COLUMN ride_requests.requested_vehicle_category IS
  'Categoría solicitada por el pasajero: standard | xl | extra_luggage | comfort. El backend filtra ofertas incompatibles y revalida elegibilidad al accept (XL / Extra Maletas / Confort).';

COMMENT ON COLUMN ride_requests.assigned_vehicle_category IS
  'Snapshot de la categoría del vehículo del conductor al aceptar. No se recalcula luego. Nunca se falsifica como comfort si el perfil no es comfort.';

COMMENT ON COLUMN driver_profiles.vehicle_category IS
  'Categoría registrada/aprobada del vehículo: standard | xl | extra_luggage | comfort. Solo administración puede asignar comfort.';

-- Multiplicador Confort en basis points (15000 = 1.50x). Administración puede cambiarlo.
-- Valor de arranque técnico (13500 = 1.35x), no política comercial definitiva.
INSERT INTO fare_settings (type, name, value, currency, effective_from, description)
VALUES (
  'comfort_fare_multiplier_bps',
  'Multiplicador tarifa Confort (basis points)',
  13500,
  'BPS',
  '2026-01-01',
  'Valor / 10000 = multiplicador. Ej: 13500 → 1.35x. Editable por administración.'
)
ON CONFLICT (type, effective_from) DO NOTHING;

-- Año mínimo del vehículo para aprobar categoría Confort.
INSERT INTO fare_settings (type, name, value, currency, effective_from, description)
VALUES (
  'comfort_min_vehicle_year',
  'Año mínimo vehículo Confort',
  2020,
  'YEAR',
  '2026-01-01',
  'Año de fabricación mínimo para que administración habilite Confort. Editable.'
)
ON CONFLICT (type, effective_from) DO NOTHING;
