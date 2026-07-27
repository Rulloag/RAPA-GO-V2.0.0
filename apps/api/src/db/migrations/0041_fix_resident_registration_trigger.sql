-- RAPA GO
-- Reparación idempotente del registro RAPA NUI / RESIDENTE RAPA NUI.
--
-- Corrige dos problemas:
-- 1. El trigger anterior dependía de ON CONFLICT (user_id), que falla si
--    el ambiente productivo no tiene una restricción única utilizable.
-- 2. El trigger anterior cambiaba una acreditación pendiente a tarifa
--    chilena. La regla vigente de RAPA GO es:
--      uploaded/pending/approved -> resident
--      rejected -> conservar clasificación chilena/extranjera del admin
--      withdrawn -> conservar la categoría no residente elegida
--
-- Puede ejecutarse más de una vez.

BEGIN;

CREATE OR REPLACE FUNCTION
  public.rapago_sync_passenger_fare_from_residence_document()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  normalized_status text;
  current_requested_fare text;
  current_effective_fare text;
  next_requested_fare text;
  next_effective_fare text;
  next_verification_status text;
BEGIN
  IF NEW."document_type" <> 'rapa_nui_residence' THEN
    RETURN NEW;
  END IF;

  normalized_status := lower(coalesce(NEW."status", ''));

  SELECT
    "requested_fare_type",
    "effective_fare_type"
  INTO
    current_requested_fare,
    current_effective_fare
  FROM public."passenger_profiles"
  WHERE "user_id" = NEW."user_id"
  ORDER BY "updated_at" DESC, "created_at" DESC
  LIMIT 1;

  next_requested_fare :=
    CASE
      WHEN normalized_status = 'withdrawn' THEN
        CASE
          WHEN current_requested_fare IN ('chilean', 'foreigner')
            THEN current_requested_fare
          ELSE 'chilean'
        END
      ELSE 'resident'
    END;

  next_effective_fare :=
    CASE
      WHEN normalized_status IN ('rejected', 'withdrawn') THEN
        CASE
          WHEN current_effective_fare IN ('chilean', 'foreigner')
            THEN current_effective_fare
          ELSE 'chilean'
        END
      ELSE 'resident'
    END;

  next_verification_status :=
    CASE
      WHEN normalized_status = 'approved' THEN 'approved'
      WHEN normalized_status = 'rejected' THEN 'rejected'
      WHEN normalized_status = 'withdrawn' THEN 'not_required'
      ELSE 'pending'
    END;

  UPDATE public."passenger_profiles"
  SET
    "requested_fare_type" = next_requested_fare,
    "effective_fare_type" = next_effective_fare,
    "residence_verification_status" =
      next_verification_status,
    "residence_requested_at" =
      CASE
        WHEN next_requested_fare = 'resident' THEN
          coalesce(
            "residence_requested_at",
            NEW."uploaded_at",
            NEW."created_at",
            now()
          )
        ELSE NULL
      END,
    "residence_reviewed_at" =
      CASE
        WHEN next_verification_status IN ('approved', 'rejected')
          THEN NEW."reviewed_at"
        ELSE NULL
      END,
    "residence_rejection_reason" =
      CASE
        WHEN next_verification_status = 'rejected'
          THEN NEW."rejection_reason"
        ELSE NULL
      END,
    "updated_at" = now()
  WHERE "user_id" = NEW."user_id";

  -- No depende de ON CONFLICT. Solo inserta cuando todavía no existe perfil.
  IF NOT FOUND THEN
    INSERT INTO public."passenger_profiles" (
      "user_id",
      "requested_fare_type",
      "effective_fare_type",
      "residence_verification_status",
      "residence_requested_at",
      "residence_reviewed_at",
      "residence_rejection_reason",
      "created_at",
      "updated_at"
    )
    VALUES (
      NEW."user_id",
      next_requested_fare,
      next_effective_fare,
      next_verification_status,
      CASE
        WHEN next_requested_fare = 'resident' THEN
          coalesce(
            NEW."uploaded_at",
            NEW."created_at",
            now()
          )
        ELSE NULL
      END,
      CASE
        WHEN next_verification_status IN ('approved', 'rejected')
          THEN NEW."reviewed_at"
        ELSE NULL
      END,
      CASE
        WHEN next_verification_status = 'rejected'
          THEN NEW."rejection_reason"
        ELSE NULL
      END,
      now(),
      now()
    );
  END IF;

  UPDATE public."users"
  SET
    "status" = 'active',
    "updated_at" = now()
  WHERE "id" = NEW."user_id"
    AND "role" = 'passenger'
    AND "status" = 'pending';

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS
  "trg_rapago_sync_passenger_fare_from_residence"
ON public."user_documents";

CREATE TRIGGER
  "trg_rapago_sync_passenger_fare_from_residence"
AFTER INSERT OR UPDATE OF
  "status",
  "rejection_reason",
  "reviewed_at",
  "updated_at"
ON public."user_documents"
FOR EACH ROW
EXECUTE FUNCTION
  public.rapago_sync_passenger_fare_from_residence_document();

COMMIT;

-- Verificación de solo lectura.
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name =
    'trg_rapago_sync_passenger_fare_from_residence'
ORDER BY event_manipulation;
