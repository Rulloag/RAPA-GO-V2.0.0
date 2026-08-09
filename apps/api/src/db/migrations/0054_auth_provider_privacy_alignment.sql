-- RAPA GO - Alineacion final de autenticacion, privacidad y eliminacion de cuenta
-- Corregida el 08-08-2026 contra el estado real de Supabase.
--
-- ESTADO FINAL ESPERADO:
-- - terms_and_conditions 2.2 activa: motivo de eliminacion obligatorio.
-- - privacy_policy 2.2 activa: Klap + Google Sign-In + Apple; Facebook deshabilitado.
-- - driver_conditions 2.1 permanece activa y sin cambios materiales.
--
-- SEGURIDAD:
-- - No modifica ni ejecuta 0052_klap_deferred_capture.sql.
-- - No vuelve a ejecutar 0053_lock_profile_identity.sql.
-- - Conserva versiones historicas y aceptaciones.
-- - Es idempotente respecto de 2.2 ya publicada manualmente en produccion.

BEGIN;

DO $terms$
DECLARE
  source_content text;
  final_content text;
  target_id uuid;
  old_text constant text :=
    'El motivo es opcional. RAPA GO verifica la identidad y procesa la solicitud dentro de treinta días desde esa verificación.';
  new_text constant text :=
    'La solicitud debe indicar obligatoriamente el motivo de eliminación. RAPA GO verifica la identidad y procesa la solicitud dentro de treinta días desde esa verificación.';
BEGIN
  SELECT id, content
  INTO target_id, final_content
  FROM legal_documents
  WHERE type = 'terms_and_conditions'
    AND version = '2.2'
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  IF target_id IS NULL THEN
    SELECT content
    INTO source_content
    FROM legal_documents
    WHERE type = 'terms_and_conditions'
      AND version = '2.1'
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    IF source_content IS NULL THEN
      RAISE EXCEPTION
        'No existe terms_and_conditions 2.1 ni 2.2. Operacion cancelada.';
    END IF;

    IF position(old_text IN source_content) = 0 THEN
      RAISE EXCEPTION
        'terms_and_conditions 2.1 no contiene el texto esperado sobre eliminacion. Operacion cancelada.';
    END IF;

    final_content := replace(source_content, old_text, new_text);

    INSERT INTO legal_documents (
      type, version, title, content, effective_date, is_active, created_at, updated_at
    )
    VALUES (
      'terms_and_conditions', '2.2', 'Términos y Condiciones',
      final_content, DATE '2026-08-08', true, NOW(), NOW()
    )
    RETURNING id INTO target_id;
  ELSE
    IF position(new_text IN final_content) = 0 THEN
      RAISE EXCEPTION
        'terms_and_conditions 2.2 existe pero no contiene la clausula final de motivo obligatorio.';
    END IF;
  END IF;

  UPDATE legal_documents
  SET is_active = (id = target_id),
      updated_at = CASE WHEN id = target_id OR is_active = true THEN NOW() ELSE updated_at END
  WHERE type = 'terms_and_conditions'
    AND (is_active = true OR id = target_id);
END
$terms$;

DO $privacy$
DECLARE
  source_content text;
  final_content text;
  target_id uuid;
  old_text constant text :=
    'Se utilizan, según la función habilitada, Hostinger, Supabase/PostgreSQL, Google Maps, Mercado Pago, Apple, Meta/Facebook, correo y notificaciones. RAPA GO no vende datos personales.';
  new_text constant text :=
    'Se utilizan, según la función habilitada, Hostinger, Supabase/PostgreSQL, Google Maps, Klap, Google Sign-In, Sign in with Apple, correo y notificaciones. Facebook Login no se encuentra habilitado. RAPA GO no vende datos personales.';
BEGIN
  SELECT id, content
  INTO target_id, final_content
  FROM legal_documents
  WHERE type = 'privacy_policy'
    AND version = '2.2'
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  IF target_id IS NULL THEN
    SELECT content
    INTO source_content
    FROM legal_documents
    WHERE type = 'privacy_policy'
      AND version = '2.1'
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    IF source_content IS NULL THEN
      RAISE EXCEPTION
        'No existe privacy_policy 2.1 ni 2.2. Operacion cancelada.';
    END IF;

    IF position(old_text IN source_content) = 0 THEN
      RAISE EXCEPTION
        'privacy_policy 2.1 no contiene el texto esperado de proveedores. Operacion cancelada.';
    END IF;

    final_content := replace(source_content, old_text, new_text);

    INSERT INTO legal_documents (
      type, version, title, content, effective_date, is_active, created_at, updated_at
    )
    VALUES (
      'privacy_policy', '2.2', 'Política de Privacidad',
      final_content, DATE '2026-08-08', true, NOW(), NOW()
    )
    RETURNING id INTO target_id;
  ELSE
    IF position('Klap' IN final_content) = 0
       OR position('Google Sign-In' IN final_content) = 0
       OR position('Sign in with Apple' IN final_content) = 0
       OR position('Facebook Login no se encuentra habilitado' IN final_content) = 0
       OR position('Mercado Pago' IN final_content) > 0 THEN
      RAISE EXCEPTION
        'privacy_policy 2.2 existe pero no coincide con el cierre final de proveedores.';
    END IF;
  END IF;

  UPDATE legal_documents
  SET is_active = (id = target_id),
      updated_at = CASE WHEN id = target_id OR is_active = true THEN NOW() ELSE updated_at END
  WHERE type = 'privacy_policy'
    AND (is_active = true OR id = target_id);
END
$privacy$;

DO $drivers$
DECLARE
  active_count integer;
BEGIN
  SELECT COUNT(*)
  INTO active_count
  FROM legal_documents
  WHERE type = 'driver_conditions'
    AND version = '2.1'
    AND is_active = true;

  IF active_count <> 1 THEN
    RAISE EXCEPTION
      'Se esperaba exactamente una driver_conditions 2.1 activa; encontradas: %', active_count;
  END IF;
END
$drivers$;

COMMIT;

-- Verificacion manual recomendada:
-- SELECT type, version, title, effective_date, is_active
-- FROM legal_documents
-- WHERE type IN ('terms_and_conditions', 'privacy_policy', 'driver_conditions')
-- ORDER BY type, created_at DESC, id DESC;
