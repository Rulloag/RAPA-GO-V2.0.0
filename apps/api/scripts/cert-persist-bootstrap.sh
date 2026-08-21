#!/usr/bin/env bash
# Bootstrap ephemeral Postgres schema for persistence certification tests.
set -euo pipefail
DB_NAME="${1:?db name required}"
HOST="${PGHOST:-127.0.0.1}"
PORT="${PGPORT:-5432}"
USER_NAME="${PGUSER:-$(whoami)}"

dropdb --if-exists -h "$HOST" -p "$PORT" -U "$USER_NAME" "$DB_NAME" >/dev/null 2>&1 || true
createdb -h "$HOST" -p "$PORT" -U "$USER_NAME" "$DB_NAME"

psql -h "$HOST" -p "$PORT" -U "$USER_NAME" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT 't',
  role text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  avatar_url text,
  is_verified boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE driver_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  phone text,
  vehicle_brand text,
  vehicle_model text,
  vehicle_year integer,
  vehicle_plate text,
  vehicle_color text,
  vehicle_category text NOT NULL DEFAULT 'standard',
  capability_xl boolean NOT NULL DEFAULT false,
  capability_extra_luggage boolean NOT NULL DEFAULT false,
  capability_comfort boolean NOT NULL DEFAULT false,
  license_number text,
  license_expiry date,
  profile_photo_url text,
  vehicle_photo_url text,
  bio text,
  languages text[],
  gender text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ride_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  origin_text varchar(150) NOT NULL DEFAULT 'A',
  destination_text varchar(150) NOT NULL DEFAULT 'B',
  origin_lat double precision,
  origin_lng double precision,
  destination_lat double precision,
  destination_lng double precision,
  distance_meters integer,
  duration_seconds integer,
  fare_calculation_source varchar(30) NOT NULL DEFAULT 'text',
  notes text,
  estimated_fare_clp integer,
  payment_method varchar(30),
  payment_provider varchar(40),
  wallet_benefit_requested boolean NOT NULL DEFAULT false,
  wallet_benefit_applied_clp integer NOT NULL DEFAULT 0,
  wallet_benefit_reversed_clp integer NOT NULL DEFAULT 0,
  wallet_benefit_reversed_at timestamptz,
  fare_before_wallet_benefit_clp integer,
  driver_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status varchar(30) NOT NULL DEFAULT 'requested',
  requested_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  en_route_at timestamptz,
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  cancelled_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  cancelled_by_role varchar(30),
  is_offline_booking boolean NOT NULL DEFAULT false,
  offline_passenger_name varchar(120),
  offline_passenger_phone varchar(30),
  offline_passenger_email varchar(200),
  ride_type varchar(20) NOT NULL DEFAULT 'immediate',
  scheduled_pickup_at timestamptz,
  priority_fee_clp integer,
  flight_number varchar(20),
  current_stop_order integer NOT NULL DEFAULT 1,
  queued_offer_driver_id uuid REFERENCES users(id) ON DELETE SET NULL,
  assignment_mode varchar(20) NOT NULL DEFAULT 'automatic',
  preferred_driver_gender varchar(10),
  requested_vehicle_category varchar(30) NOT NULL DEFAULT 'standard',
  assigned_vehicle_category varchar(30),
  assigned_vehicle_plate varchar(30),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ride_driver_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_request_id uuid NOT NULL REFERENCES ride_requests(id) ON DELETE CASCADE,
  driver_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  elapsed_seconds integer,
  outcome varchar(40) NOT NULL DEFAULT 'active',
  cancellation_reason text,
  cancelled_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  cancelled_by_role varchar(30),
  cancellation_event varchar(80),
  location_lat double precision,
  location_lng double precision,
  location_accuracy_meters double precision,
  location_captured_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ride_driver_assignments_ride_driver_accepted_unique
  ON ride_driver_assignments (ride_request_id, driver_user_id, accepted_at);
CREATE INDEX ride_driver_assignments_ride_outcome_idx
  ON ride_driver_assignments (ride_request_id, outcome);
CREATE INDEX ride_driver_assignments_driver_accepted_idx
  ON ride_driver_assignments (driver_user_id, accepted_at);

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
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (type, effective_from)
);

INSERT INTO fare_settings (type, name, value, is_active, effective_from)
VALUES ('comfort_min_vehicle_year', 'Comfort min year', 2020, true, '2020-01-01');

CREATE TABLE offline_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_name text NOT NULL,
  passenger_phone text NOT NULL,
  origin_text text NOT NULL,
  destination_text text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending_sync',
  synced_ride_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_request_id uuid REFERENCES ride_requests(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'created',
  amount_clp integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
SQL

echo "READY $DB_NAME"
