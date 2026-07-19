-- ── WhatsApp Business Cloud API — base tables ──────────────────────────────
-- Adds:
--   1. phone_e164 to passenger_profiles (E.164 normalised, used for WA lookup)
--   2. whatsapp_messages  — audit log of every sent/received WA message
-- No breaking changes to existing tables.

-- 1. phone_e164 on passenger_profiles ------------------------------------------
ALTER TABLE passenger_profiles
  ADD COLUMN IF NOT EXISTS phone_e164 VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_passenger_profiles_phone_e164
  ON passenger_profiles (phone_e164)
  WHERE phone_e164 IS NOT NULL;

-- 2. whatsapp_messages ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        REFERENCES users(id) ON DELETE SET NULL,
  ride_id             UUID        REFERENCES ride_requests(id) ON DELETE SET NULL,
  phone_e164          VARCHAR(20) NOT NULL,
  direction           VARCHAR(10) NOT NULL
    CHECK (direction IN ('incoming', 'outgoing')),
  message_type        VARCHAR(20) NOT NULL
    CHECK (message_type IN ('text', 'template', 'interactive', 'location', 'status')),
  provider_message_id VARCHAR(255),
  template_name       VARCHAR(100),
  body_preview        VARCHAR(300),
  status              VARCHAR(20) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed', 'received')),
  payload_json        JSONB,
  error_code          VARCHAR(50),
  error_message       VARCHAR(500),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_phone
  ON whatsapp_messages (phone_e164);

CREATE INDEX IF NOT EXISTS idx_wa_messages_user
  ON whatsapp_messages (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wa_messages_ride
  ON whatsapp_messages (ride_id)
  WHERE ride_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wa_messages_provider_id
  ON whatsapp_messages (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wa_messages_status
  ON whatsapp_messages (status);

CREATE INDEX IF NOT EXISTS idx_wa_messages_created_at
  ON whatsapp_messages (created_at DESC);
