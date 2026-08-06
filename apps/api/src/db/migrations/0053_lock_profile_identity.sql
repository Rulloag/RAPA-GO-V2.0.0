-- Persist immutable identity fields used by passenger and driver applications.
-- These values are captured at registration/first verified application and
-- can no longer be edited from the self-service profile.

ALTER TABLE passenger_profiles
  ADD COLUMN IF NOT EXISTS rut varchar(20);

ALTER TABLE passenger_profiles
  ADD COLUMN IF NOT EXISTS birth_date text;

-- Backfill existing accounts from their most recent application when possible.
UPDATE passenger_profiles AS profile
SET rut = latest.rut
FROM (
  SELECT DISTINCT ON (user_id)
    user_id,
    rut
  FROM applications
  WHERE user_id IS NOT NULL
    AND NULLIF(BTRIM(rut), '') IS NOT NULL
  ORDER BY user_id, created_at DESC
) AS latest
WHERE profile.user_id = latest.user_id
  AND NULLIF(BTRIM(profile.rut), '') IS NULL;

UPDATE passenger_profiles AS profile
SET birth_date = latest.birth_date
FROM (
  SELECT DISTINCT ON (user_id)
    user_id,
    birth_date
  FROM applications
  WHERE user_id IS NOT NULL
    AND birth_date IS NOT NULL
  ORDER BY user_id, created_at DESC
) AS latest
WHERE profile.user_id = latest.user_id
  AND profile.birth_date IS NULL;

UPDATE passenger_profiles AS profile
SET phone = latest.phone
FROM (
  SELECT DISTINCT ON (user_id)
    user_id,
    phone
  FROM applications
  WHERE user_id IS NOT NULL
    AND NULLIF(BTRIM(phone), '') IS NOT NULL
  ORDER BY user_id, created_at DESC
) AS latest
WHERE profile.user_id = latest.user_id
  AND NULLIF(BTRIM(profile.phone), '') IS NULL;
