-- RAPA GO · Verificación posterior a migración 0042
-- Ejecutar en Supabase SQL Editor después de 0042.
-- No modifica datos.

SELECT
  current_database() AS database_name,
  now() AS verified_at;

SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'account_deletion_requests' AND column_name IN (
      'reason',
      'verified_at',
      'apple_revocation_status',
      'apple_revocation_attempted_at',
      'apple_revoked_at',
      'apple_revocation_error'
    ))
    OR (table_name IN ('oauth_identities', 'auth_identities')
      AND column_name = 'provider_client_id')
    OR (table_name = 'cash_overpayment_refund_requests'
      AND column_name IN (
        'bank_account_number_encrypted',
        'sensitive_data_purged_at'
      ))
  )
ORDER BY table_name, column_name;

SELECT
  count(*) FILTER (WHERE status = 'rejected') AS legacy_rejected_remaining,
  count(*) FILTER (
    WHERE deadline_at <> verified_at + interval '30 days'
  ) AS invalid_deadlines,
  count(*) FILTER (
    WHERE reason IS NULL
  ) AS requests_without_optional_reason
FROM public.account_deletion_requests;

SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'account_deletion_requests_one_open_per_user_uidx',
    'account_deletion_requests_verified_deadline_idx',
    'account_deletion_requests_apple_revocation_idx'
  )
ORDER BY indexname;

SELECT
  type,
  version,
  title,
  effective_date,
  is_active
FROM public.legal_documents
WHERE type IN (
  'terms_and_conditions',
  'user_conditions',
  'driver_conditions',
  'privacy_policy'
)
ORDER BY type, is_active DESC, created_at DESC;
