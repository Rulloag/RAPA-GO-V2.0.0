-- Categoría del vehículo en postulación de conductor (validación admin).
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS vehicle_category varchar(30);

COMMENT ON COLUMN applications.vehicle_category IS
  'Categoría declarada del vehículo principal: standard | xl | extra_luggage.';
