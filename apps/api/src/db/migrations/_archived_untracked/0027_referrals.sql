-- Fase 102: Sistema de referidos y descuentos

CREATE TABLE IF NOT EXISTS referral_codes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  code             TEXT NOT NULL UNIQUE,
  type             TEXT NOT NULL DEFAULT 'user',
  discount_amount  INTEGER,
  discount_type    TEXT NOT NULL DEFAULT 'percentage',
  max_uses         INTEGER,
  used_count       INTEGER NOT NULL DEFAULT 0,
  expires_at       TIMESTAMPTZ,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_uses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id UUID NOT NULL REFERENCES referral_codes(id),
  referred_user_id UUID REFERENCES users(id) ON DELETE SET NULL UNIQUE,
  referred_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted_at     TIMESTAMPTZ,
  conversion_value INTEGER,
  reward_applied   BOOLEAN NOT NULL DEFAULT false,
  reward_amount    INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_uses_code_id ON referral_uses(referral_code_id);
