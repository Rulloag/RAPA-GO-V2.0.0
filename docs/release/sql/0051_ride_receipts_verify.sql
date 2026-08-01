-- Verificación posterior a 0051_ride_receipts_and_driver_approval_email.sql

SELECT
  to_regclass('public.ride_receipts') IS NOT NULL AS ride_receipts_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'applications'
      AND column_name = 'approval_delivery_status'
  ) AS approval_delivery_status_exists;

SELECT
  conname,
  pg_get_constraintdef(oid) AS definition,
  convalidated
FROM pg_constraint
WHERE conrelid = 'public.ride_receipts'::regclass
ORDER BY conname;

SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'ride_receipts'
ORDER BY indexname;
