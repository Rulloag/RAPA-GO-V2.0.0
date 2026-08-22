#!/usr/bin/env bash
# Isolated local Postgres certification for migrations 0056 → 0057 → 0058.
# NEVER touches production / Supabase / Hostinger.
set -euo pipefail

DB_NAME="${RAPAGO_CERT_DB:-rapago_cert_vehicle_chain_$$}"
HOST="${PGHOST:-127.0.0.1}"
PORT="${PGPORT:-5432}"
USER_NAME="${PGUSER:-$(whoami)}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG="$ROOT/src/db/migrations"
REPO_ROOT="$(cd "$ROOT/../.." && pwd)"

echo "CERT_DB=$DB_NAME host=$HOST port=$PORT user=$USER_NAME"

dropdb --if-exists -h "$HOST" -p "$PORT" -U "$USER_NAME" "$DB_NAME" >/dev/null 2>&1 || true
createdb -h "$HOST" -p "$PORT" -U "$USER_NAME" "$DB_NAME"

# Minimal schema prior to 0056 (enough for 0056–0058 + fare_settings unique).
psql -h "$HOST" -p "$PORT" -U "$USER_NAME" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE driver_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id),
  vehicle_brand text,
  vehicle_model text,
  vehicle_year integer,
  vehicle_plate text,
  vehicle_color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ride_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE fare_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  name text NOT NULL,
  value integer NOT NULL,
  currency text NOT NULL DEFAULT 'CLP',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  effective_from text NOT NULL,
  effective_until text,
  created_by uuid,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT fare_settings_type_effective_from_unique UNIQUE (type, effective_from)
);

INSERT INTO users (id) VALUES
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333'),
  ('44444444-4444-4444-4444-444444444444'),
  ('55555555-5555-5555-5555-555555555555'),
  ('66666666-6666-6666-6666-666666666666');

-- After 0056 we will set vehicle_category; seed plates only for now.
INSERT INTO driver_profiles (user_id, vehicle_plate) VALUES
  ('11111111-1111-1111-1111-111111111111', 'ST-001'),
  ('22222222-2222-2222-2222-222222222222', 'XL-001'),
  ('33333333-3333-3333-3333-333333333333', 'EL-001'),
  ('44444444-4444-4444-4444-444444444444', 'LG-001'),
  ('55555555-5555-5555-5555-555555555555', 'CF-001'),
  ('66666666-6666-6666-6666-666666666666', 'CT-001');
SQL

echo "Applying 0056…"
psql -h "$HOST" -p "$PORT" -U "$USER_NAME" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$MIG/0056_vehicle_categories.sql"

# Set legacy categories AFTER 0056 created the column (mirrors production data).
psql -h "$HOST" -p "$PORT" -U "$USER_NAME" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
UPDATE driver_profiles SET vehicle_category = 'standard' WHERE vehicle_plate = 'ST-001';
UPDATE driver_profiles SET vehicle_category = 'xl' WHERE vehicle_plate = 'XL-001';
UPDATE driver_profiles SET vehicle_category = 'extra_luggage' WHERE vehicle_plate = 'EL-001';
UPDATE driver_profiles SET vehicle_category = 'luggage' WHERE vehicle_plate = 'LG-001';
UPDATE driver_profiles SET vehicle_category = 'comfort' WHERE vehicle_plate = 'CF-001';
UPDATE driver_profiles SET vehicle_category = 'confort' WHERE vehicle_plate = 'CT-001';
SQL

echo "Applying 0057…"
psql -h "$HOST" -p "$PORT" -U "$USER_NAME" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$MIG/0057_comfort_vehicle_category.sql"

echo "Applying 0058…"
psql -h "$HOST" -p "$PORT" -U "$USER_NAME" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$MIG/0058_vehicle_capabilities.sql"

echo "==== LEGACY MAPPING RESULT ===="
psql -h "$HOST" -p "$PORT" -U "$USER_NAME" -d "$DB_NAME" -c \
"SELECT vehicle_category AS legacy,
        capability_xl,
        capability_extra_luggage,
        capability_comfort
 FROM driver_profiles
 ORDER BY vehicle_plate;"

echo "==== FARE SETTINGS 0057 ===="
psql -h "$HOST" -p "$PORT" -U "$USER_NAME" -d "$DB_NAME" -c \
"SELECT type, value, currency FROM fare_settings
 WHERE type IN ('comfort_fare_multiplier_bps','comfort_min_vehicle_year')
 ORDER BY type;"

echo "Re-applying 0056→0058 (idempotency)…"
psql -h "$HOST" -p "$PORT" -U "$USER_NAME" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$MIG/0056_vehicle_categories.sql"
psql -h "$HOST" -p "$PORT" -U "$USER_NAME" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$MIG/0057_comfort_vehicle_category.sql"
psql -h "$HOST" -p "$PORT" -U "$USER_NAME" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$MIG/0058_vehicle_capabilities.sql"

echo "==== AFTER SECOND APPLY ===="
psql -h "$HOST" -p "$PORT" -U "$USER_NAME" -d "$DB_NAME" -c \
"SELECT count(*) AS rows,
        count(*) FILTER (WHERE capability_xl) AS xl,
        count(*) FILTER (WHERE capability_extra_luggage) AS extra,
        count(*) FILTER (WHERE capability_comfort) AS comfort
 FROM driver_profiles;"

psql -h "$HOST" -p "$PORT" -U "$USER_NAME" -d "$DB_NAME" -c \
"SELECT column_name FROM information_schema.columns
 WHERE table_name='ride_requests' AND column_name='assigned_vehicle_plate';"

echo "==== RUNNER (rapago_manual_migrations) ===="
export DATABASE_URL="postgresql://${USER_NAME}@${HOST}:${PORT}/${DB_NAME}"
# Local sockets often omit password; postgres.js needs a URL without secrets in logs.
cd "$ROOT"
npx tsx scripts/apply-manual-migrations.ts
npx tsx scripts/apply-manual-migrations.ts

psql -h "$HOST" -p "$PORT" -U "$USER_NAME" -d "$DB_NAME" -c \
"SELECT id, left(checksum_sha256,12) AS checksum_prefix, applied_at
 FROM rapago_manual_migrations ORDER BY id;"

dropdb -h "$HOST" -p "$PORT" -U "$USER_NAME" "$DB_NAME"
echo "MIGRATION_0056_0058_CERT=PASS (db dropped)"
