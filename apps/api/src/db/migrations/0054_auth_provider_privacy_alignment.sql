-- RAPA GO - Cierre final de proveedores de autenticacion y privacidad
-- Preparada el 08-08-2026.
--
-- IMPORTANTE:
-- - No modifica ni ejecuta 0052_klap_deferred_capture.sql.
-- - No vuelve a ejecutar 0053_lock_profile_identity.sql.
-- - Conserva documentos historicos y sus aceptaciones.
-- - Publica nuevas versiones solo para documentos materialmente modificados.
-- - Ejecutar manualmente en Supabase solo despues de validar este commit.

BEGIN;

-- 1. Terminos: partir de la version 3.0 publicada el 29-07-2026 y
-- crear 3.1 sin reescribir la version historica aceptada.
DO $terms$
DECLARE
  source_content text;
  aligned_content text;
  existing_id uuid;
BEGIN
  SELECT content
  INTO source_content
  FROM legal_documents
  WHERE type = 'terms_and_conditions'
    AND version = '3.0'
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  IF source_content IS NULL THEN
    RAISE EXCEPTION
      'No existe terms_and_conditions 3.0. No se puede publicar 3.1 de forma segura.';
  END IF;

  aligned_content := source_content;

  aligned_content := replace(
    aligned_content,
    '• Proveedor de pagos: Mercado Pago, Itaú Klap u otro proveedor autorizado utilizado para procesar pagos.',
    '• Proveedor de pagos: Klap u otro proveedor electrónico que Rapa Go informe como habilitado antes del pago.'
  );

  aligned_content := replace(
    aligned_content,
    'La cuenta podrá crearse o autenticarse mediante correo electrónico y contraseña, Facebook y, en iOS, Sign in with Apple, cuando dichos mecanismos estén habilitados. Google Login no forma parte de la primera versión. Las identidades se vincularán a una única cuenta y no se fusionarán automáticamente solo por coincidencia de correo.',
    'La cuenta podrá crearse o autenticarse mediante correo electrónico y contraseña, Google y, en iOS, Sign in with Apple, cuando dichos mecanismos estén habilitados. Facebook no se encuentra habilitado como método de acceso. Las identidades externas se vinculan a una única cuenta interna. Cuando Google corresponde a una cuenta Rapa Go existente, la vinculación exige verificación de la cuenta y conserva el mismo identificador interno del usuario.'
  );

  aligned_content := replace(
    aligned_content,
    'Los servicios podrán pagarse mediante Mercado Pago u otros medios electrónicos habilitados y, cuando se ofrezca, en efectivo.',
    'Los servicios podrán pagarse mediante Klap u otros medios electrónicos habilitados e informados antes del pago y, cuando se ofrezca, en efectivo.'
  );

  aligned_content := replace(
    aligned_content,
    'Mercado Pago o Itaú Klap emite un comprobante del procesamiento, que no reemplaza el documento tributario de Haka Taiko SpA.',
    'Klap o el proveedor electrónico habilitado emite un comprobante del procesamiento, que no reemplaza el documento tributario de Haka Taiko SpA.'
  );

  aligned_content := replace(
    aligned_content,
    'La App integra, según sistema operativo y versión, Facebook Login, Sign in with Apple, Google Maps o MapKit, servicios de ubicación, Mercado Pago, Hostinger, Supabase, correo Gmail/SMTP y WhatsApp. Google Login, Firebase, Sentry, Google Analytics y Crashlytics no se encuentran activos en la primera versión.',
    'La App integra, según sistema operativo y versión, Google Sign-In, Sign in with Apple, Google Maps o MapKit, servicios de ubicación, Klap, Hostinger, Supabase, correo Gmail/SMTP y WhatsApp. Facebook Login no se encuentra habilitado. Sentry puede habilitarse para diagnóstico cuando exista configuración de producción y debe operar con minimización de datos. Firebase, Google Analytics y Crashlytics no se declaran como funciones activas salvo que una compilación posterior los incorpore y se actualicen los documentos correspondientes.'
  );

  SELECT id
  INTO existing_id
  FROM legal_documents
  WHERE type = 'terms_and_conditions'
    AND version = '3.1'
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  UPDATE legal_documents
  SET is_active = false, updated_at = NOW()
  WHERE type = 'terms_and_conditions'
    AND is_active = true;

  IF existing_id IS NULL THEN
    INSERT INTO legal_documents (
      type,
      version,
      title,
      content,
      effective_date,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      'terms_and_conditions',
      '3.1',
      'Términos y Condiciones Generales de Uso',
      aligned_content,
      '2026-08-08',
      true,
      NOW(),
      NOW()
    );
  ELSE
    UPDATE legal_documents
    SET
      title = 'Términos y Condiciones Generales de Uso',
      content = aligned_content,
      effective_date = '2026-08-08',
      is_active = true,
      updated_at = NOW()
    WHERE id = existing_id;
  END IF;
END
$terms$;

-- 2. Politica de Privacidad: publicar 2.2 desde la 2.1 de cierre.
DO $privacy$
DECLARE
  source_content text;
  aligned_content text;
  existing_id uuid;
BEGIN
  SELECT content
  INTO source_content
  FROM legal_documents
  WHERE type = 'privacy_policy'
    AND version = '2.1'
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  IF source_content IS NULL THEN
    RAISE EXCEPTION
      'No existe privacy_policy 2.1. No se puede publicar 2.2 de forma segura.';
  END IF;

  aligned_content := source_content;

  aligned_content := replace(
    aligned_content,
    'Se utilizan, según la función habilitada, Hostinger, Supabase/PostgreSQL, Google Maps, Mercado Pago, Apple, Meta/Facebook, correo y notificaciones. RAPA GO no vende datos personales.',
    'Se utilizan, según la función habilitada, Hostinger, Supabase/PostgreSQL, Google Maps, Klap, Google Sign-In, Sign in with Apple, correo y notificaciones. Facebook Login no se encuentra habilitado. RAPA GO no vende datos personales.'
  );

  SELECT id
  INTO existing_id
  FROM legal_documents
  WHERE type = 'privacy_policy'
    AND version = '2.2'
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  UPDATE legal_documents
  SET is_active = false, updated_at = NOW()
  WHERE type = 'privacy_policy'
    AND is_active = true;

  IF existing_id IS NULL THEN
    INSERT INTO legal_documents (
      type,
      version,
      title,
      content,
      effective_date,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      'privacy_policy',
      '2.2',
      'Política de Privacidad',
      aligned_content,
      '2026-08-08',
      true,
      NOW(),
      NOW()
    );
  ELSE
    UPDATE legal_documents
    SET
      title = 'Política de Privacidad',
      content = aligned_content,
      effective_date = '2026-08-08',
      is_active = true,
      updated_at = NOW()
    WHERE id = existing_id;
  END IF;
END
$privacy$;

-- 3. Condiciones de conductores: el documento 2.0 publicado el 29-07-2026
-- aun nombra Facebook/Google antiguo. Crear 3.0, preservando 2.0.
DO $drivers$
DECLARE
  source_content text;
  aligned_content text;
  existing_id uuid;
BEGIN
  SELECT content
  INTO source_content
  FROM legal_documents
  WHERE type = 'driver_conditions'
    AND version = '2.0'
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  IF source_content IS NULL THEN
    RAISE EXCEPTION
      'No existe driver_conditions 2.0. No se puede publicar 3.0 de forma segura.';
  END IF;

  aligned_content := source_content;

  aligned_content := replace(
    aligned_content,
    'La cuenta es personal e intransferible. El acceso podrá realizarse mediante correo y contraseña, Facebook y, en iOS, Sign in with Apple, cuando se encuentren habilitados. Google Login no forma parte de la primera versión.',
    'La cuenta es personal e intransferible. El acceso podrá realizarse mediante correo y contraseña, Google y, en iOS, Sign in with Apple, cuando se encuentren habilitados. Facebook Login no se encuentra habilitado.'
  );

  SELECT id
  INTO existing_id
  FROM legal_documents
  WHERE type = 'driver_conditions'
    AND version = '3.0'
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  UPDATE legal_documents
  SET is_active = false, updated_at = NOW()
  WHERE type = 'driver_conditions'
    AND is_active = true;

  IF existing_id IS NULL THEN
    INSERT INTO legal_documents (
      type,
      version,
      title,
      content,
      effective_date,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      'driver_conditions',
      '3.0',
      'Condiciones para Conductores',
      aligned_content,
      '2026-08-08',
      true,
      NOW(),
      NOW()
    );
  ELSE
    UPDATE legal_documents
    SET
      title = 'Condiciones para Conductores',
      content = aligned_content,
      effective_date = '2026-08-08',
      is_active = true,
      updated_at = NOW()
    WHERE id = existing_id;
  END IF;
END
$drivers$;

COMMIT;

-- Verificacion sugerida despues de ejecutar manualmente:
-- SELECT type, version, title, effective_date, is_active
-- FROM legal_documents
-- WHERE type IN ('terms_and_conditions', 'privacy_policy', 'driver_conditions')
-- ORDER BY type, created_at DESC;
