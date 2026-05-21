-- Migration: 0018_payments_base
-- Wallets, payment methods, transactions, payment orders

CREATE TABLE IF NOT EXISTS "wallets" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    UUID NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "balance"    INTEGER NOT NULL DEFAULT 0,
  "currency"   TEXT NOT NULL DEFAULT 'CLP',
  "status"     TEXT NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "payment_methods" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"        UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type"           TEXT NOT NULL,
  "provider"       TEXT,
  "provider_token" TEXT,
  "last_four"      TEXT,
  "expiry_month"   INTEGER,
  "expiry_year"    INTEGER,
  "is_default"     BOOLEAN NOT NULL DEFAULT FALSE,
  "status"         TEXT NOT NULL DEFAULT 'active',
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "transactions" (
  "id"                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "wallet_id"               UUID NOT NULL REFERENCES "wallets"("id"),
  "user_id"                 UUID NOT NULL REFERENCES "users"("id"),
  "ride_id"                 UUID REFERENCES "ride_requests"("id"),
  "type"                    TEXT NOT NULL,
  "amount"                  INTEGER NOT NULL,
  "currency"                TEXT NOT NULL DEFAULT 'CLP',
  "status"                  TEXT NOT NULL DEFAULT 'pending',
  "provider"                TEXT,
  "provider_transaction_id" TEXT,
  "description"             TEXT,
  "metadata"                JSONB,
  "created_at"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "payment_orders" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"          UUID NOT NULL REFERENCES "users"("id"),
  "ride_id"          UUID REFERENCES "ride_requests"("id"),
  "amount"           INTEGER NOT NULL,
  "currency"         TEXT NOT NULL DEFAULT 'CLP',
  "status"           TEXT NOT NULL DEFAULT 'pending',
  "provider"         TEXT,
  "provider_order_id" TEXT,
  "payment_url"      TEXT,
  "expires_at"       TIMESTAMPTZ,
  "completed_at"     TIMESTAMPTZ,
  "metadata"         JSONB,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
