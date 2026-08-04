-- RAPA GO 0050: confiabilidad de webhooks Klap.
-- Idempotente: puede ejecutarse aunque 0038 ya haya sido aplicada.

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(32) NOT NULL,
  event_key varchar(128) NOT NULL,
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  provider_payment_id varchar(160),
  request_id varchar(160),
  action varchar(100),
  payload_hash varchar(64) NOT NULL,
  payload jsonb NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'processing',
  error_message text,
  received_at timestamp with time zone NOT NULL DEFAULT NOW(),
  processed_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_webhook_events_provider_key_uidx
  ON payment_webhook_events(provider, event_key);

CREATE INDEX IF NOT EXISTS payment_webhook_events_payment_idx
  ON payment_webhook_events(payment_id, received_at);

CREATE INDEX IF NOT EXISTS payment_webhook_events_status_idx
  ON payment_webhook_events(status, received_at);
