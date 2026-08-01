-- RAPA GO - Comprobantes PDF automáticos y correo de habilitación de conductor.
-- Idempotente para Supabase/PostgreSQL.

CREATE TABLE IF NOT EXISTS public.ride_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.ride_requests(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  policy_charge_id UUID REFERENCES public.ride_policy_charges(id) ON DELETE SET NULL,
  type VARCHAR(40) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  document_number VARCHAR(90) NOT NULL,
  email_to VARCHAR(255) NOT NULL,
  storage_bucket VARCHAR(120),
  storage_path TEXT,
  pdf_sha256 VARCHAR(64),
  map_provider VARCHAR(32),
  route_point_count INTEGER NOT NULL DEFAULT 0,
  legal_document_type VARCHAR(80),
  legal_document_version VARCHAR(40),
  legal_accepted_at TIMESTAMPTZ,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ride_receipts_ride_type_uidx
  ON public.ride_receipts(ride_id, type);

CREATE UNIQUE INDEX IF NOT EXISTS ride_receipts_document_number_uidx
  ON public.ride_receipts(document_number);

CREATE INDEX IF NOT EXISTS ride_receipts_owner_created_idx
  ON public.ride_receipts(owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ride_receipts_status_updated_idx
  ON public.ride_receipts(status, updated_at);

CREATE INDEX IF NOT EXISTS ride_receipts_policy_charge_idx
  ON public.ride_receipts(policy_charge_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_ride_receipts_type'
      AND conrelid = 'public.ride_receipts'::regclass
  ) THEN
    ALTER TABLE public.ride_receipts
      ADD CONSTRAINT chk_ride_receipts_type
      CHECK (type IN ('completed_ride', 'late_cancellation', 'no_show'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_ride_receipts_status'
      AND conrelid = 'public.ride_receipts'::regclass
  ) THEN
    ALTER TABLE public.ride_receipts
      ADD CONSTRAINT chk_ride_receipts_status
      CHECK (status IN ('pending', 'generating', 'generated', 'sent', 'failed'));
  END IF;
END
$$;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS approval_delivery_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approval_delivered_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS approval_delivery_error TEXT;

CREATE INDEX IF NOT EXISTS idx_applications_approval_delivery_status
  ON public.applications(approval_delivery_status);
