-- Categorías de vehículo: informan/advierten, no restringen.
-- requested_vehicle_category: lo que pidió el pasajero (tarifa sigue esta).
-- assigned_vehicle_category: snapshot del vehículo del conductor al aceptar.
-- driver_profiles.vehicle_category: categoría registrada del vehículo.

ALTER TABLE ride_requests
  ADD COLUMN IF NOT EXISTS requested_vehicle_category varchar(30) NOT NULL DEFAULT 'standard';

ALTER TABLE ride_requests
  ADD COLUMN IF NOT EXISTS assigned_vehicle_category varchar(30);

ALTER TABLE driver_profiles
  ADD COLUMN IF NOT EXISTS vehicle_category varchar(30) NOT NULL DEFAULT 'standard';

COMMENT ON COLUMN ride_requests.requested_vehicle_category IS
  'Categoría solicitada por el pasajero: standard | xl | extra_luggage. No filtra visibilidad.';

COMMENT ON COLUMN ride_requests.assigned_vehicle_category IS
  'Snapshot de la categoría del vehículo del conductor al aceptar. No se recalcula luego.';

COMMENT ON COLUMN driver_profiles.vehicle_category IS
  'Categoría registrada del vehículo del conductor: standard | xl | extra_luggage.';
