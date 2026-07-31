-- RAPA GO - Google OAuth provider
-- Permite Apple, Facebook y Google.
-- Idempotente para bases locales y Supabase.

DO $$
BEGIN
  IF to_regclass('public.oauth_identities') IS NULL THEN
    RAISE EXCEPTION 'No existe public.oauth_identities';
  END IF;

  ALTER TABLE public.oauth_identities
    DROP CONSTRAINT IF EXISTS chk_oauth_identities_provider;

  ALTER TABLE public.oauth_identities
    ADD CONSTRAINT chk_oauth_identities_provider
    CHECK (
      provider IN ('apple', 'facebook', 'google')
    ) NOT VALID;

  ALTER TABLE public.oauth_identities
    VALIDATE CONSTRAINT chk_oauth_identities_provider;
END
$$;