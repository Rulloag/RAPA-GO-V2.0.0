#!/usr/bin/env bash
# Isolated local Postgres certification for migration 0058.
# NEVER touches production / Supabase / Hostinger.
set -euo pipefail

DB_NAME="${RAPAGO_CERT_DB:-rapago_cert_vehicle_caps_$$}"
HOST="${PGHOST:-127.0.0.1}"
PORT="${PGPORT:-5432}"
USER_NAME="${PGUSER:-$(whoami)}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG="$ROOT/src/db/migrations"

echo "CERT_DB=$DB_NAME host=$HOST port=$PORT user=$USER_NAME"

dropdb --if-exists -h "$HOST" -p "$PORT" -U "$USER_NAME" "$DB_NAME" >/dev/null 2>&1 || true
createdb -h "$HOST" -p "$PORT" -U "$USER_NAME" "$DB_NAME"

psql -h "$HOST" -p "$PORT" -U "$USER_NAME" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE driver_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  vehicle_brand text,
  vehicle_model text,
  vehicle_year integer,
  vehicle_plate text,
  vehicle_color text,
  vehicle_category text NOT NULL DEFAULT 'standard',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ride_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_vehicle_category varchar(30) NOT NULL DEFAULT 'standard',
  assigned_vehicle_category varchar(30),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO driver_profiles (user_id, vehicle_category) VALUES
  ('11111111-1111-1111-1111-111111111111', 'standard'),
  ('22222222-2222-2222-2222-222222222222', 'xl'),
  ('33333333-3333-3333-3333-333333333333', 'extra_luggage'),
  ('44444444-4444-4444-4444-444444444444', 'luggage'),
  ('55555555-5555-5555-5555-555555555555', 'comfort');
SQL

echo "Applying 0058..."
psql -h "$HOST" -p "$PORT" -U "$USER_NAME" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$MIG/0058_vehicle_capabilities.sql"

echo "==== LEGACY MAPPING RESULT ===="
psql -h "$HOST" -p "$PORT" -U "$USER_NAME" -d "$DB_NAME" -c \
"SELECT vehicle_category AS legacy,
        capability_xl,
        capability_extra_luggage,
        capability_comfort
 FROM driver_profiles
 ORDER BY vehicle_category;"

echo "Re-applying 0058 (idempotency)..."
psql -h "$HOST" -p "$PORT" -U "$USER_NAME" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$MIG/0058_vehicle_capabilities.sql"

echo "==== AFTER SECOND APPLY ===="
psql -h "$HOST" -p "$PORT" -U "$USER_NAME" -d "$DB_NAME" -c \
"SELECT count(*) AS rows,
        count(*) FILTER (WHERE capability_xl OR capability_extra_luggage OR capability_comfort) AS with_caps
 FROM driver_profiles;"

# Verify column exists on ride_requests
psql -h "$HOST" -p "$PORT" -U "$USER_NAME" -d "$DB_NAME" -c \
"SELECT column_name FROM information_schema.columns
 WHERE table_name='ride_requests' AND column_name='assigned_vehicle_plate';"

dropdb -h "$HOST" -p "$PORT" -U "$USER_NAME" "$DB_NAME"
echo "MIGRATION_0058_CERT=PASS (db dropped)"
