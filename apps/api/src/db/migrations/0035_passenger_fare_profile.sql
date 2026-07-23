BEGIN;

ALTER TABLE "passenger_profiles"
  ADD COLUMN IF NOT EXISTS "requested_fare_type"
    text NOT NULL DEFAULT 'chilean';

ALTER TABLE "passenger_profiles"
  ADD COLUMN IF NOT EXISTS "effective_fare_type"
    text NOT NULL DEFAULT 'chilean';

ALTER TABLE "passenger_profiles"
  ADD COLUMN IF NOT EXISTS "residence_verification_status"
    text NOT NULL DEFAULT 'not_required';

ALTER TABLE "passenger_profiles"
  ADD COLUMN IF NOT EXISTS "residence_requested_at"
    timestamp with time zone;

ALTER TABLE "passenger_profiles"
  ADD COLUMN IF NOT EXISTS "residence_reviewed_at"
    timestamp with time zone;

ALTER TABLE "passenger_profiles"
  ADD COLUMN IF NOT EXISTS "residence_reviewed_by"
    uuid;

ALTER TABLE "passenger_profiles"
  ADD COLUMN IF NOT EXISTS "residence_rejection_reason"
    text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'passenger_profiles_requested_fare_type_check'
      AND conrelid = 'public.passenger_profiles'::regclass
  ) THEN
    ALTER TABLE "passenger_profiles"
      ADD CONSTRAINT
        "passenger_profiles_requested_fare_type_check"
      CHECK (
        "requested_fare_type" IN (
          'resident',
          'chilean',
          'foreigner'
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'passenger_profiles_effective_fare_type_check'
      AND conrelid = 'public.passenger_profiles'::regclass
  ) THEN
    ALTER TABLE "passenger_profiles"
      ADD CONSTRAINT
        "passenger_profiles_effective_fare_type_check"
      CHECK (
        "effective_fare_type" IN (
          'resident',
          'chilean',
          'foreigner'
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'passenger_profiles_residence_status_check'
      AND conrelid = 'public.passenger_profiles'::regclass
  ) THEN
    ALTER TABLE "passenger_profiles"
      ADD CONSTRAINT
        "passenger_profiles_residence_status_check"
      CHECK (
        "residence_verification_status" IN (
          'not_required',
          'pending',
          'approved',
          'rejected'
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'passenger_profiles_residence_reviewed_by_users_fk'
      AND conrelid = 'public.passenger_profiles'::regclass
  ) THEN
    ALTER TABLE "passenger_profiles"
      ADD CONSTRAINT
        "passenger_profiles_residence_reviewed_by_users_fk"
      FOREIGN KEY ("residence_reviewed_by")
      REFERENCES "public"."users"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS
  "passenger_profiles_effective_fare_type_idx"
ON "passenger_profiles" ("effective_fare_type");

CREATE INDEX IF NOT EXISTS
  "passenger_profiles_residence_status_idx"
ON "passenger_profiles" ("residence_verification_status");

-- Remove the old rule that automatically classified every driver
-- as Rapanui/resident.
DROP TRIGGER IF EXISTS
  "trg_rapago_user_driver_resident"
ON "public"."users";

DROP TRIGGER IF EXISTS
  "trg_rapago_user_driver_rapanui_normal"
ON "public"."users";

DO $$
BEGIN
  IF to_regclass('public.applications') IS NOT NULL THEN
    EXECUTE
      'DROP TRIGGER IF EXISTS
        "trg_rapago_driver_application_approved"
       ON "public"."applications"';

    EXECUTE
      'DROP TRIGGER IF EXISTS
        "trg_rapago_driver_application_approved_rapanui_normal"
       ON "public"."applications"';
  END IF;
END
$$;

DROP FUNCTION IF EXISTS
  public.rapago_when_user_becomes_driver_rapanui_normal();

DROP FUNCTION IF EXISTS
  public.rapago_when_driver_application_approved_rapanui_normal();

DROP FUNCTION IF EXISTS
  public.rapago_set_passenger_profile_rapanui_normal(uuid);

-- Create a profile for passenger and driver accounts that do not have one.
INSERT INTO "passenger_profiles" ("user_id")
SELECT "id"
FROM "users"
WHERE "role" IN ('passenger', 'driver')
ON CONFLICT ("user_id") DO NOTHING;

-- Import compatible values from the previous passenger_fare_type column
-- when that legacy column exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'passenger_profiles'
      AND column_name = 'passenger_fare_type'
  ) THEN
    EXECUTE $legacy$
      UPDATE "passenger_profiles"
      SET
        "requested_fare_type" =
          CASE
            WHEN lower(coalesce("passenger_fare_type", '')) =
              'foreigner'
              THEN 'foreigner'
            WHEN lower(coalesce("passenger_fare_type", '')) IN (
              'resident',
              'rapanui',
              'rapanui_normal'
            )
              THEN 'resident'
            ELSE 'chilean'
          END,
        "effective_fare_type" =
          CASE
            WHEN lower(coalesce("passenger_fare_type", '')) =
              'foreigner'
              THEN 'foreigner'
            ELSE 'chilean'
          END,
        "residence_verification_status" =
          CASE
            WHEN lower(coalesce("passenger_fare_type", '')) IN (
              'resident',
              'rapanui',
              'rapanui_normal'
            )
              THEN 'pending'
            ELSE 'not_required'
          END,
        "updated_at" = now()
    $legacy$;
  END IF;
END
$$;

-- Use the latest real residence document as the source of truth.
WITH latest_residence_document AS (
  SELECT DISTINCT ON ("user_id")
    "user_id",
    lower(coalesce("status", '')) AS "document_status",
    "rejection_reason",
    "uploaded_at",
    "reviewed_at",
    "created_at",
    "updated_at"
  FROM "user_documents"
  WHERE "document_type" = 'rapa_nui_residence'
  ORDER BY
    "user_id",
    coalesce(
      "updated_at",
      "reviewed_at",
      "uploaded_at",
      "created_at"
    ) DESC
)
UPDATE "passenger_profiles" AS profile
SET
  "requested_fare_type" =
    CASE
      WHEN document."document_status" = 'withdrawn'
        THEN 'chilean'
      ELSE 'resident'
    END,
  "effective_fare_type" =
    CASE
      WHEN document."document_status" = 'approved'
        THEN 'resident'
      ELSE 'chilean'
    END,
  "residence_verification_status" =
    CASE
      WHEN document."document_status" = 'approved'
        THEN 'approved'
      WHEN document."document_status" = 'rejected'
        THEN 'rejected'
      WHEN document."document_status" = 'withdrawn'
        THEN 'not_required'
      ELSE 'pending'
    END,
  "residence_requested_at" =
    coalesce(
      document."uploaded_at",
      document."created_at",
      profile."residence_requested_at",
      now()
    ),
  "residence_reviewed_at" =
    CASE
      WHEN document."document_status" IN (
        'approved',
        'rejected'
      )
        THEN document."reviewed_at"
      ELSE NULL
    END,
  "residence_rejection_reason" =
    CASE
      WHEN document."document_status" = 'rejected'
        THEN document."rejection_reason"
      ELSE NULL
    END,
  "updated_at" = now()
FROM latest_residence_document AS document
WHERE profile."user_id" = document."user_id";

-- A residence review must not leave a passenger account blocked.
UPDATE "users" AS user_account
SET
  "status" = 'active',
  "updated_at" = now()
FROM "passenger_profiles" AS profile
WHERE user_account."id" = profile."user_id"
  AND user_account."role" = 'passenger'
  AND user_account."status" = 'pending'
  AND profile."residence_verification_status" IN (
    'pending',
    'approved',
    'rejected'
  );

CREATE OR REPLACE FUNCTION
  public.rapago_sync_passenger_fare_from_residence_document()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  normalized_status text;
  requested_fare text;
  effective_fare text;
  verification_status text;
BEGIN
  IF NEW."document_type" <> 'rapa_nui_residence' THEN
    RETURN NEW;
  END IF;

  normalized_status := lower(coalesce(NEW."status", ''));

  requested_fare :=
    CASE
      WHEN normalized_status = 'withdrawn'
        THEN 'chilean'
      ELSE 'resident'
    END;

  effective_fare :=
    CASE
      WHEN normalized_status = 'approved'
        THEN 'resident'
      ELSE 'chilean'
    END;

  verification_status :=
    CASE
      WHEN normalized_status = 'approved'
        THEN 'approved'
      WHEN normalized_status = 'rejected'
        THEN 'rejected'
      WHEN normalized_status = 'withdrawn'
        THEN 'not_required'
      ELSE 'pending'
    END;

  INSERT INTO "passenger_profiles" (
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
    requested_fare,
    effective_fare,
    verification_status,
    coalesce(NEW."uploaded_at", NEW."created_at", now()),
    CASE
      WHEN verification_status IN ('approved', 'rejected')
        THEN NEW."reviewed_at"
      ELSE NULL
    END,
    CASE
      WHEN verification_status = 'rejected'
        THEN NEW."rejection_reason"
      ELSE NULL
    END,
    now(),
    now()
  )
  ON CONFLICT ("user_id")
  DO UPDATE SET
    "requested_fare_type" = EXCLUDED."requested_fare_type",
    "effective_fare_type" = EXCLUDED."effective_fare_type",
    "residence_verification_status" =
      EXCLUDED."residence_verification_status",
    "residence_requested_at" =
      EXCLUDED."residence_requested_at",
    "residence_reviewed_at" =
      EXCLUDED."residence_reviewed_at",
    "residence_rejection_reason" =
      EXCLUDED."residence_rejection_reason",
    "updated_at" = now();

  UPDATE "users"
  SET
    "status" = 'active',
    "updated_at" = now()
  WHERE "id" = NEW."user_id"
    AND "role" = 'passenger'
    AND "status" = 'pending';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  "trg_rapago_sync_passenger_fare_from_residence"
ON "public"."user_documents";

CREATE TRIGGER
  "trg_rapago_sync_passenger_fare_from_residence"
AFTER INSERT OR UPDATE OF
  "status",
  "rejection_reason",
  "reviewed_at",
  "updated_at"
ON "public"."user_documents"
FOR EACH ROW
EXECUTE FUNCTION
  public.rapago_sync_passenger_fare_from_residence_document();

COMMIT;