-- RAPA GO
-- Persistencia de fotografías/documentos de postulación y traspaso automático
-- al perfil del conductor aprobado.

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS vehicle_photo_url text,
  ADD COLUMN IF NOT EXISTS vehicles jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS vehicle_photo_url text;

-- Vincula postulaciones aprobadas antiguas con su cuenta existente.
UPDATE public.applications AS application
SET
  user_id = account.id,
  updated_at = now()
FROM public.users AS account
WHERE application.user_id IS NULL
  AND lower(account.email) = lower(application.email)
  AND application.type = 'driver'
  AND application.status = 'approved';

-- Recupera automáticamente los datos básicos del vehículo y perfil para
-- postulaciones que ya estaban aprobadas antes de esta migración.
INSERT INTO public.driver_profiles (
  user_id,
  phone,
  vehicle_brand,
  vehicle_model,
  vehicle_year,
  vehicle_plate,
  vehicle_color,
  license_number,
  license_expiry,
  profile_photo_url,
  vehicle_photo_url,
  created_at,
  updated_at
)
SELECT
  account.id,
  application.phone,
  application.vehicle_brand,
  application.vehicle_model,
  application.vehicle_year,
  application.vehicle_plate,
  application.vehicle_color,
  application.license_number,
  CASE
    WHEN application.license_expiry ~ '^\d{4}-\d{2}-\d{2}$'
      THEN application.license_expiry::date
    ELSE NULL
  END,
  application.profile_photo_url,
  application.vehicle_photo_url,
  now(),
  now()
FROM public.applications AS application
JOIN public.users AS account
  ON lower(account.email) = lower(application.email)
WHERE application.type = 'driver'
  AND application.status = 'approved'
ON CONFLICT (user_id) DO UPDATE
SET
  phone = COALESCE(EXCLUDED.phone, public.driver_profiles.phone),
  vehicle_brand = COALESCE(EXCLUDED.vehicle_brand, public.driver_profiles.vehicle_brand),
  vehicle_model = COALESCE(EXCLUDED.vehicle_model, public.driver_profiles.vehicle_model),
  vehicle_year = COALESCE(EXCLUDED.vehicle_year, public.driver_profiles.vehicle_year),
  vehicle_plate = COALESCE(EXCLUDED.vehicle_plate, public.driver_profiles.vehicle_plate),
  vehicle_color = COALESCE(EXCLUDED.vehicle_color, public.driver_profiles.vehicle_color),
  license_number = COALESCE(EXCLUDED.license_number, public.driver_profiles.license_number),
  license_expiry = COALESCE(EXCLUDED.license_expiry, public.driver_profiles.license_expiry),
  profile_photo_url = COALESCE(EXCLUDED.profile_photo_url, public.driver_profiles.profile_photo_url),
  vehicle_photo_url = COALESCE(EXCLUDED.vehicle_photo_url, public.driver_profiles.vehicle_photo_url),
  updated_at = now();

-- Buckets utilizados por el backend para las nuevas postulaciones.
-- Los documentos de identidad/licencia permanecen privados; las fotos de
-- perfil y vehículo son públicas porque deben mostrarse en la app.
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES
  (
    'driver-application-documents',
    'driver-application-documents',
    false,
    650000,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  ),
  (
    'driver-profile-assets',
    'driver-profile-assets',
    true,
    650000,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  )
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Si una postulación aprobada antigua ya tenía URLs válidas, las vincula al
-- expediente del conductor. No inventa fotografías que nunca fueron guardadas.
INSERT INTO public.user_documents (
  user_id,
  document_type,
  status,
  file_url,
  uploaded_at,
  reviewed_at,
  created_at,
  updated_at
)
SELECT
  application.user_id,
  document.document_type,
  'approved',
  document.file_url,
  COALESCE(application.created_at, now()),
  COALESCE(application.reviewed_at, now()),
  now(),
  now()
FROM public.applications AS application
CROSS JOIN LATERAL (
  VALUES
    ('identity_document_front', application.id_front_url),
    ('identity_document_back', application.id_back_url),
    ('driver_license_front', application.license_front_url),
    ('driver_license_back', application.license_back_url),
    ('profile_photo', application.profile_photo_url),
    ('vehicle_photo', application.vehicle_photo_url)
) AS document(document_type, file_url)
WHERE application.type = 'driver'
  AND application.status = 'approved'
  AND application.user_id IS NOT NULL
  AND document.file_url IS NOT NULL
  AND btrim(document.file_url) <> ''
ON CONFLICT (user_id, document_type) DO UPDATE
SET
  status = 'approved',
  file_url = EXCLUDED.file_url,
  rejection_reason = NULL,
  uploaded_at = EXCLUDED.uploaded_at,
  reviewed_at = EXCLUDED.reviewed_at,
  updated_at = now();
