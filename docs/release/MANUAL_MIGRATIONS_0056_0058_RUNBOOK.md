# Runbook — cadena manual 0056 → 0057 → 0058 (sin ejecutar producción aquí)

## Diagnóstico (por qué no basta drizzle-kit)

`apps/api/src/db/migrations/meta/_journal.json` termina en:

`0047_ride_requests_perf_indexes`

Existen en disco (y **no** están en el journal) entre otras:

- `0044`–`0046` (saltadas también antes de 0047)
- `0048`–`0055` (legales, KLAP, receipts, OAuth, …)
- `0056`–`0058` (categorías / Confort / capabilities)

`npm run db:migrate` / `migrate:prod` solo ejecuta entradas del journal vía `drizzle-kit migrate`. Por tanto **0057/0058 nunca se aplicaban** con el flujo oficial.

Evidencia de modelo híbrido histórico:

- Runbook SQL Editor para 0042: `docs/release/SUPABASE_MIGRATION_0042_RUNBOOK.md`
- Scripts de certificación local con `psql` (p. ej. `cert-migration-0058-local.sh`)
- Comentarios en Quality Gate: el journal no cubre todos los `.sql` del directorio

**No** se editó `_journal.json` a mano para “meter” 0057/0058: eso forzaría a drizzle a intentar 0048–0056 en cascada (o a mentir sobre el historial) y choca con migraciones legales no idempotentes / frágiles (0049/0054/0055).

## Solución elegida

Runner explícito post-journal:

1. Tabla de registro `rapago_manual_migrations` (id, file_name, checksum_sha256, applied_at)
2. Manifest ordenado: **0056 → 0057 → 0058**
3. Transacción por archivo + checksum SHA-256
4. Segunda ejecución = skip si checksum coincide; **fail** si el archivo cambió tras aplicar
5. `migrate:prod` ejecuta drizzle y **después** esta cadena
6. Script: `npm run db:migrate:manual --workspace=apps/api`

Los huérfanos 0044–0046 y 0048–0055 quedan documentados en el manifest (`KNOWN_ORPHAN_SQL_OUTSIDE_CHAIN`) y **no** se auto-aplican.

## Precondiciones de 0057 / 0058

| Migración | Requiere | Idempotencia |
|-----------|----------|--------------|
| 0056 | `ride_requests`, `driver_profiles` | `ADD COLUMN IF NOT EXISTS` |
| 0057 | columnas de 0056 + `fare_settings` UNIQUE `(type, effective_from)` (creado en journal `0016_rare_garia`) | `ON CONFLICT DO NOTHING` + COMMENT |
| 0058 | `vehicle_category` (0056) | `ADD COLUMN IF NOT EXISTS` + backfill seguro |

Legacy backfill 0058: `xl`, `extra_luggage`/`luggage`, `comfort`/`confort`.

## Procedimiento de producción (NO ejecutar en esta fase)

### 0. Autorización + backup

- Confirmar ventana de mantenimiento / responsable.
- Snapshot / PITR verificado.

### 1. PRECHECK read-only (solo SELECT)

Sin imprimir URLs ni secrets. Ejemplo de consultas (sanitizar host en reportes):

```sql
-- ¿Journal drizzle hasta dónde?
SELECT id, hash, created_at
FROM drizzle.__drizzle_migrations
ORDER BY created_at DESC
LIMIT 20;
-- (el schema/nombre exacto de la tabla puede variar; listar schemas si hace falta)

-- ¿Ya existe la cadena vehicle?
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('driver_profiles', 'ride_requests')
  AND column_name IN (
    'vehicle_category',
    'requested_vehicle_category',
    'assigned_vehicle_category',
    'capability_xl',
    'capability_extra_luggage',
    'capability_comfort',
    'assigned_vehicle_plate'
  )
ORDER BY table_name, column_name;

-- ¿Constraint ON CONFLICT de 0057?
SELECT conname
FROM pg_constraint
WHERE conrelid = 'public.fare_settings'::regclass
  AND contype = 'u';

-- ¿Seeds Confort?
SELECT type, value, currency, effective_from
FROM fare_settings
WHERE type IN ('comfort_fare_multiplier_bps', 'comfort_min_vehicle_year');

-- ¿Registro manual previo?
SELECT * FROM rapago_manual_migrations ORDER BY id;
-- (puede no existir aún)
```

Interpretación:

- Si faltan columnas de 0056 → aplicar cadena completa.
- Si 0056 presente y faltan capabilities → el runner aplicará solo pendientes.
- Si todo presente y tabla de registro ausente → el runner aplicará SQL idempotente y **creará** el registro (seguro).

### 2. Aplicar

Con `DATABASE_URL` / `DIRECT_URL` de producción ya configuradas en el entorno autorizado (no pegarlas en chats):

```bash
cd apps/api
# Opción A — flujo completo (drizzle + manual + seed mínimo):
npm run migrate:prod

# Opción B — solo cadena manual (si drizzle ya está al día):
npm run db:migrate:manual
```

### 3. Verificar

```sql
SELECT id, left(checksum_sha256, 12) AS checksum_prefix, applied_at
FROM rapago_manual_migrations
ORDER BY id;

SELECT type, value FROM fare_settings
WHERE type IN ('comfort_fare_multiplier_bps', 'comfort_min_vehicle_year');

SELECT
  count(*) AS drivers,
  count(*) FILTER (WHERE capability_xl) AS xl,
  count(*) FILTER (WHERE capability_extra_luggage) AS extra,
  count(*) FILTER (WHERE capability_comfort) AS comfort
FROM driver_profiles;
```

### 4. Deploy backend + smoke

- Deploy API con el código que consume `capability_*`.
- Smoke: solicitar categoría XL/Confort, accept, snapshot de patente/categoría.

### 5. Rollback

- **No** DROP de columnas en caliente tras escribir aplicación.
- Rollback = revertir deploy de API al build anterior; columnas nuevas son backward-compatible (defaults `false` / NULL).
- Seeds `fare_settings`: se pueden desactivar (`is_active = false`) si hiciera falta; no borrar si ya hay lecturas.
- No restaurar backup salvo corrupción confirmada.

## Certificación local

```bash
# Postgres local, sin secrets remotos
bash apps/api/scripts/cert-migration-0056-0058-local.sh
```
