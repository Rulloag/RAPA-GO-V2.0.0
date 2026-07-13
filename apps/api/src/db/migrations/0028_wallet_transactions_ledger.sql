-- Fase 4: Ledger autoritativo de créditos de Wallet (reemplaza rapago_wallet_benefits_v1 de localStorage)

CREATE TABLE IF NOT EXISTS wallet_transactions_ledger (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  wallet_id          UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  ride_id            UUID REFERENCES ride_requests(id),
  payment_id         UUID REFERENCES payments(id),
  applied_to_ride_id UUID REFERENCES ride_requests(id),

  type               TEXT NOT NULL,
  source             TEXT NOT NULL,

  amount_clp         INTEGER NOT NULL CHECK (amount_clp > 0),
  currency           TEXT NOT NULL DEFAULT 'CLP',

  status             TEXT NOT NULL DEFAULT 'pending',
  approval_status    TEXT NOT NULL DEFAULT 'not_required',

  idempotency_key    TEXT NOT NULL UNIQUE,

  created_by         UUID REFERENCES users(id),
  approved_by        UUID REFERENCES users(id),

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at        TIMESTAMPTZ,
  applied_at         TIMESTAMPTZ,
  expires_at         TIMESTAMPTZ,
  reversed_at        TIMESTAMPTZ,

  metadata           JSONB
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_ledger_user_id ON wallet_transactions_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_ledger_wallet_id ON wallet_transactions_ledger(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_ledger_status ON wallet_transactions_ledger(status);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_ledger_ride_id ON wallet_transactions_ledger(ride_id);
