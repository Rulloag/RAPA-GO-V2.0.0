#!/usr/bin/env bash
# Verifica la migración 0019_reconcile_legacy_payments_columns.sql contra una base que simula el
# estado legacy real de `payments` (columnas external_id/webhook_payload, sin
# provider_payment_id/raw_provider_payload) — el mismo patrón detectado en la base de desarrollo
# real durante la Fase 6 de remediación de seguridad.
#
# Uso: ./scripts/verify-legacy-payments-migration.sh (ejecutar desde apps/api/)
# No toca DATABASE_URL de ningún entorno real — usa siempre una base desechable con nombre único.

set -euo pipefail

TEST_DB_NAME="rapago_ci_legacy_payments_check_$$"
PSQL_USER="${PGUSER:-$(whoami)}"
PSQL_HOST="${PGHOST:-localhost}"
PSQL_PORT="${PGPORT:-5432}"
MIGRATIONS_DIR="src/db/migrations"

cleanup() {
  psql -U "$PSQL_USER" -h "$PSQL_HOST" -p "$PSQL_PORT" -d postgres \
    -c "DROP DATABASE IF EXISTS ${TEST_DB_NAME};" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Creando base de pruebas desechable: ${TEST_DB_NAME}"
psql -U "$PSQL_USER" -h "$PSQL_HOST" -p "$PSQL_PORT" -d postgres \
  -c "CREATE DATABASE ${TEST_DB_NAME};" >/dev/null

echo "==> Reconstruyendo baseline 0000-0016 (estado pre-Fase-5)"
for f in "$MIGRATIONS_DIR"/0000*.sql "$MIGRATIONS_DIR"/0001*.sql "$MIGRATIONS_DIR"/0002*.sql \
         "$MIGRATIONS_DIR"/0003*.sql "$MIGRATIONS_DIR"/0004*.sql "$MIGRATIONS_DIR"/0005*.sql \
         "$MIGRATIONS_DIR"/0006*.sql "$MIGRATIONS_DIR"/0007*.sql "$MIGRATIONS_DIR"/0008*.sql \
         "$MIGRATIONS_DIR"/0009*.sql "$MIGRATIONS_DIR"/0010*.sql "$MIGRATIONS_DIR"/0011*.sql \
         "$MIGRATIONS_DIR"/0012*.sql "$MIGRATIONS_DIR"/0013*.sql "$MIGRATIONS_DIR"/0014*.sql \
         "$MIGRATIONS_DIR"/0015*.sql "$MIGRATIONS_DIR"/0016_rare_garia.sql; do
  psql -U "$PSQL_USER" -h "$PSQL_HOST" -p "$PSQL_PORT" -d "$TEST_DB_NAME" \
    -v ON_ERROR_STOP=1 -f "$f" >/dev/null
done

echo "==> Creando payments legacy (external_id / webhook_payload) + datos de ejemplo"
psql -U "$PSQL_USER" -h "$PSQL_HOST" -p "$PSQL_PORT" -d "$TEST_DB_NAME" <<'SQL'
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_request_id UUID NOT NULL REFERENCES ride_requests(id) ON DELETE CASCADE,
  passenger_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(30) NOT NULL DEFAULT 'prontopaga',
  provider_order_id VARCHAR(100),
  external_id VARCHAR(100),
  amount_clp INTEGER NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  url_pay TEXT,
  webhook_payload JSONB,
  paid_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  failed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX payments_ride_active_idx ON payments (ride_request_id)
  WHERE status IN ('pending','processing');

INSERT INTO users (id, email, name, role, status, is_verified)
VALUES ('99999999-9999-9999-9999-999999999999','existing@rapago.cl','Existing User','passenger','active',true);
INSERT INTO ride_requests (id, passenger_user_id, origin_text, destination_text, status, estimated_fare_clp)
VALUES ('88888888-8888-8888-8888-888888888888','99999999-9999-9999-9999-999999999999','Hanga Roa','Ovahe','completed',4000);
INSERT INTO payments (id, ride_request_id, passenger_user_id, amount_clp, status, provider,
  provider_order_id, external_id, webhook_payload, paid_at)
VALUES ('77777777-7777-7777-7777-777777777777','88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999',4000,'success','mercadopago',
  'mp-order-123','mp-payment-999','{"id":"mp-payment-999","status":"approved"}'::jsonb, now());
SQL

echo "==> Aplicando baseline de tracking hasta 0017 (payments legacy ya existe)"
HASH17=$(shasum -a 256 "$MIGRATIONS_DIR/0017_next_natasha_romanoff.sql" | awk '{print $1}')
WHEN17=$(python3 -c "
import json
d = json.load(open('$MIGRATIONS_DIR/meta/_journal.json'))
for e in d['entries']:
    if e['tag'] == '0017_next_natasha_romanoff':
        print(e['when'])
")
psql -U "$PSQL_USER" -h "$PSQL_HOST" -p "$PSQL_PORT" -d "$TEST_DB_NAME" <<SQL
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('${HASH17}', ${WHEN17});
SQL

echo "==> Ejecutando npm run db:migrate (debe aplicar solo 0018 + 0019)"
DATABASE_URL="postgresql://${PSQL_USER}@${PSQL_HOST}:${PSQL_PORT}/${TEST_DB_NAME}" npm run db:migrate

echo "==> Verificando backfill de columnas canónicas"
BACKFILLED=$(psql -U "$PSQL_USER" -h "$PSQL_HOST" -p "$PSQL_PORT" -d "$TEST_DB_NAME" \
  -tAc "SELECT provider_payment_id = external_id AND raw_provider_payload = webhook_payload FROM payments WHERE id='77777777-7777-7777-7777-777777777777';")
if [ "$BACKFILLED" != "t" ]; then
  echo "❌ FALLO: backfill de provider_payment_id/raw_provider_payload incorrecto"
  exit 1
fi
echo "✅ Backfill correcto (provider_payment_id/raw_provider_payload == external_id/webhook_payload)"

echo "==> Verificando que no se perdieron datos"
ROW_COUNT=$(psql -U "$PSQL_USER" -h "$PSQL_HOST" -p "$PSQL_PORT" -d "$TEST_DB_NAME" -tAc "SELECT count(*) FROM payments;")
if [ "$ROW_COUNT" != "1" ]; then
  echo "❌ FALLO: se esperaba 1 fila en payments, hay ${ROW_COUNT}"
  exit 1
fi
echo "✅ Sin pérdida de datos (1 fila preservada)"

echo "==> Verificando índice único parcial payments_ride_active_idx"
IDX_EXISTS=$(psql -U "$PSQL_USER" -h "$PSQL_HOST" -p "$PSQL_PORT" -d "$TEST_DB_NAME" \
  -tAc "SELECT count(*) FROM pg_indexes WHERE indexname='payments_ride_active_idx';")
if [ "$IDX_EXISTS" != "1" ]; then
  echo "❌ FALLO: falta payments_ride_active_idx"
  exit 1
fi
echo "✅ Índice único parcial presente"

echo "==> Verificando segunda ejecución (idempotencia, sin duplicados ni pérdida)"
DATABASE_URL="postgresql://${PSQL_USER}@${PSQL_HOST}:${PSQL_PORT}/${TEST_DB_NAME}" npm run db:migrate
ROW_COUNT_2=$(psql -U "$PSQL_USER" -h "$PSQL_HOST" -p "$PSQL_PORT" -d "$TEST_DB_NAME" -tAc "SELECT count(*) FROM payments;")
if [ "$ROW_COUNT_2" != "1" ]; then
  echo "❌ FALLO: segunda ejecución duplicó o perdió datos (${ROW_COUNT_2} filas)"
  exit 1
fi

echo "==> OK: migración legacy de payments validada (backfill, sin pérdida, idempotente)"
