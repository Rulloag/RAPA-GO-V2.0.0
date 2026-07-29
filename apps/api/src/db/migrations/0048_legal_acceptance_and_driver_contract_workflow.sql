-- RAPA GO V34
-- Evidencia legal versionada y flujo contractual separado para conductores.

ALTER TABLE user_acceptances
  ADD COLUMN IF NOT EXISTS document_type TEXT,
  ADD COLUMN IF NOT EXISTS document_title TEXT,
  ADD COLUMN IF NOT EXISTS document_hash TEXT,
  ADD COLUMN IF NOT EXISTS authentication_method TEXT,
  ADD COLUMN IF NOT EXISTS acceptance_status TEXT NOT NULL DEFAULT 'accepted';

UPDATE user_acceptances AS acceptance
SET
  document_type = document.type,
  document_title = document.title
FROM legal_documents AS document
WHERE acceptance.legal_document_id = document.id
  AND (
    acceptance.document_type IS NULL OR
    acceptance.document_title IS NULL
  );

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS driver_contract_document_id UUID,
  ADD COLUMN IF NOT EXISTS driver_contract_version TEXT,
  ADD COLUMN IF NOT EXISTS driver_contract_accepted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS driver_contract_acceptance JSONB,
  ADD COLUMN IF NOT EXISTS rest_window_start TEXT,
  ADD COLUMN IF NOT EXISTS rest_window_end TEXT,
  ADD COLUMN IF NOT EXISTS document_review_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS training_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS review_checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS contract_delivery_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS contract_delivered_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS contract_delivery_error TEXT;

CREATE INDEX IF NOT EXISTS idx_applications_driver_contract_document
  ON applications(driver_contract_document_id);

CREATE INDEX IF NOT EXISTS idx_applications_document_review_status
  ON applications(document_review_status);

CREATE INDEX IF NOT EXISTS idx_applications_training_status
  ON applications(training_status);

CREATE INDEX IF NOT EXISTS idx_applications_contract_delivery_status
  ON applications(contract_delivery_status);
