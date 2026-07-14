#!/usr/bin/env bash
# Verifica que `npm run db:migrate` reconstruye el schema completo desde una base de datos vacía.
# Uso: ./scripts/verify-migration-chain.sh (ejecutar desde apps/api/, requiere un servidor
# PostgreSQL local accesible con el usuario del sistema, sin contraseña, en localhost:5432).
#
# Pensado para CI: crea una base desechable, migra, verifica tablas críticas, y la elimina.
# No toca DATABASE_URL ni ninguna base real — usa siempre TEST_DB_NAME.

set -euo pipefail

TEST_DB_NAME="rapago_ci_migration_check_$$"
PSQL_USER="${PGUSER:-$(whoami)}"
PSQL_HOST="${PGHOST:-localhost}"
PSQL_PORT="${PGPORT:-5432}"

cleanup() {
  psql -U "$PSQL_USER" -h "$PSQL_HOST" -p "$PSQL_PORT" -d postgres \
    -c "DROP DATABASE IF EXISTS ${TEST_DB_NAME};" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Creando base de pruebas desechable: ${TEST_DB_NAME}"
psql -U "$PSQL_USER" -h "$PSQL_HOST" -p "$PSQL_PORT" -d postgres \
  -c "CREATE DATABASE ${TEST_DB_NAME};" >/dev/null

echo "==> Ejecutando npm run db:migrate contra la base vacía"
DATABASE_URL="postgresql://${PSQL_USER}@${PSQL_HOST}:${PSQL_PORT}/${TEST_DB_NAME}" \
  npm run db:migrate

echo "==> Verificando tablas críticas"
REQUIRED_TABLES=(payments wallets wallet_transactions_ledger ride_requests users)
MISSING=0

for table in "${REQUIRED_TABLES[@]}"; do
  EXISTS=$(psql -U "$PSQL_USER" -h "$PSQL_HOST" -p "$PSQL_PORT" -d "$TEST_DB_NAME" \
    -tAc "SELECT to_regclass('${table}') IS NOT NULL;")
  if [ "$EXISTS" != "t" ]; then
    echo "❌ Tabla crítica faltante: ${table}"
    MISSING=1
  else
    echo "✅ ${table}"
  fi
done

if [ "$MISSING" -ne 0 ]; then
  echo "==> FALLO: faltan tablas críticas tras db:migrate"
  exit 1
fi

echo "==> Verificando que una segunda ejecución no cambia el número de tablas"
TABLES_BEFORE=$(psql -U "$PSQL_USER" -h "$PSQL_HOST" -p "$PSQL_PORT" -d "$TEST_DB_NAME" \
  -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='public';")

DATABASE_URL="postgresql://${PSQL_USER}@${PSQL_HOST}:${PSQL_PORT}/${TEST_DB_NAME}" \
  npm run db:migrate

TABLES_AFTER=$(psql -U "$PSQL_USER" -h "$PSQL_HOST" -p "$PSQL_PORT" -d "$TEST_DB_NAME" \
  -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='public';")

if [ "$TABLES_BEFORE" != "$TABLES_AFTER" ]; then
  echo "❌ FALLO: la segunda ejecución de db:migrate cambió el número de tablas (${TABLES_BEFORE} -> ${TABLES_AFTER})"
  exit 1
fi

echo "==> OK: cadena de migraciones completa y estable (${TABLES_AFTER} tablas, segunda ejecución sin cambios)"
