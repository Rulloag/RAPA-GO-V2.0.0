-- RAPA GO · Reparación idempotente de esquema en runtime
-- Corrige el desfase entre el backend desplegado y la base usada en producción.
BEGIN;

ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS estimated_fare_clp integer,
  ADD COLUMN IF NOT EXISTS origin_lat double precision,
  ADD COLUMN IF NOT EXISTS origin_lng double precision,
  ADD COLUMN IF NOT EXISTS destination_lat double precision,
  ADD COLUMN IF NOT EXISTS destination_lng double precision,
  ADD COLUMN IF NOT EXISTS distance_meters integer,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS fare_calculation_source varchar(30) NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS payment_method varchar(30),
  ADD COLUMN IF NOT EXISTS payment_provider varchar(40),
  ADD COLUMN IF NOT EXISTS wallet_benefit_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wallet_benefit_applied_clp integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wallet_benefit_reversed_clp integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wallet_benefit_reversed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS fare_before_wallet_benefit_clp integer,
  ADD COLUMN IF NOT EXISTS driver_user_id uuid,
  ADD COLUMN IF NOT EXISTS accepted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS en_route_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS arrived_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS started_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS cancelled_by_role varchar(30),
  ADD COLUMN IF NOT EXISTS is_offline_booking boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS offline_passenger_name varchar(120),
  ADD COLUMN IF NOT EXISTS offline_passenger_phone varchar(30),
  ADD COLUMN IF NOT EXISTS offline_passenger_email varchar(200),
  ADD COLUMN IF NOT EXISTS ride_type varchar(20) NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS scheduled_pickup_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS priority_fee_clp integer,
  ADD COLUMN IF NOT EXISTS flight_number varchar(20),
  ADD COLUMN IF NOT EXISTS current_stop_order integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS queued_offer_driver_id uuid,
  ADD COLUMN IF NOT EXISTS assignment_mode varchar(20) NOT NULL DEFAULT 'automatic',
  ADD COLUMN IF NOT EXISTS preferred_driver_gender varchar(10);

UPDATE public.ride_requests
SET fare_before_wallet_benefit_clp = estimated_fare_clp
WHERE fare_before_wallet_benefit_clp IS NULL;

CREATE INDEX IF NOT EXISTS idx_ride_requests_status ON public.ride_requests(status);
CREATE INDEX IF NOT EXISTS idx_ride_requests_scheduled
  ON public.ride_requests(scheduled_pickup_at)
  WHERE scheduled_pickup_at IS NOT NULL;

-- Las relaciones históricas no se recrean aquí para evitar bloquear la
-- reparación por datos antiguos. Las columnas nuevas son nullable.



ALTER TABLE public.account_deletion_requests ALTER COLUMN reason DROP NOT NULL;
ALTER TABLE public.account_deletion_requests
  ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS apple_revocation_status varchar(30) NOT NULL DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS apple_revocation_attempted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS apple_revoked_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS apple_revocation_error text;
UPDATE public.account_deletion_requests
SET verified_at = requested_at WHERE verified_at IS NULL;
ALTER TABLE public.account_deletion_requests ALTER COLUMN verified_at SET DEFAULT now();
ALTER TABLE public.account_deletion_requests ALTER COLUMN verified_at SET NOT NULL;
UPDATE public.account_deletion_requests
SET deadline_at = verified_at + interval '30 days'
WHERE deadline_at IS NULL OR deadline_at <> verified_at + interval '30 days';
ALTER TABLE IF EXISTS public.auth_identities ADD COLUMN IF NOT EXISTS provider_client_id varchar(255);
ALTER TABLE IF EXISTS public.oauth_identities ADD COLUMN IF NOT EXISTS provider_client_id varchar(255);

COMMIT;
