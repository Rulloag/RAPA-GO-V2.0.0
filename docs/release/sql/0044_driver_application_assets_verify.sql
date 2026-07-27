-- RAPA GO - Verificación de la migración 0044.
-- No modifica datos.

WITH expected(table_name, column_name) AS (
  VALUES
    ('applications', 'vehicle_photo_url'),
    ('applications', 'vehicles'),
    ('driver_profiles', 'vehicle_photo_url')
)
SELECT
  expected.table_name,
  expected.column_name AS columna_faltante
FROM expected
LEFT JOIN information_schema.columns AS actual
  ON actual.table_schema = 'public'
 AND actual.table_name = expected.table_name
 AND actual.column_name = expected.column_name
WHERE actual.column_name IS NULL
ORDER BY expected.table_name, expected.column_name;

SELECT
  id,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id IN (
  'driver-application-documents',
  'driver-profile-assets'
)
ORDER BY id;

SELECT
  application.id,
  application.email,
  application.status,
  application.user_id,
  application.vehicle_brand,
  application.vehicle_model,
  application.vehicle_plate,
  application.profile_photo_url,
  application.vehicle_photo_url,
  jsonb_array_length(application.vehicles) AS vehicles_count
FROM public.applications AS application
WHERE application.type = 'driver'
ORDER BY application.created_at DESC
LIMIT 20;

SELECT
  profile.user_id,
  profile.phone,
  profile.vehicle_brand,
  profile.vehicle_model,
  profile.vehicle_plate,
  profile.profile_photo_url,
  profile.vehicle_photo_url,
  profile.updated_at
FROM public.driver_profiles AS profile
ORDER BY profile.updated_at DESC
LIMIT 20;
