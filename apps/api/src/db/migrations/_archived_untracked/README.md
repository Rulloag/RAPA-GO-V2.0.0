# Migraciones archivadas — no versionadas, no usar

**Fecha de archivo:** 2026-07-14
**Commit de la remediación:** ver `fix(db): replace untracked migrations with official drizzle migration`
y `docs(db): archive redundant untracked migration files` en la rama
`integration/leandro-security-remediation` (Fase 5 — Reparación del sistema de migraciones).

## ⚠️ ADVERTENCIA

**No ejecutes manualmente ninguno de estos archivos.** Ninguno está registrado en
`apps/api/src/db/migrations/meta/_journal.json`, por lo que `npm run db:migrate` /
`drizzle-kit migrate` **nunca los ha ejecutado ni los ejecutará** en ningún entorno. Se conservan
aquí únicamente como evidencia histórica, no como parte del pipeline de migraciones activo.

## Causa raíz

`0016_rare_garia.sql` (sí registrada en el journal, `idx 16`) es una migración consolidada que en
un único archivo crea 20 tablas — coincidiendo con el estado de `schema.ts` al momento en que fue
generada. Después de esa migración, alguien agregó manualmente 12 archivos `.sql` adicionales
(`0016_driver_profiles.sql` a `0027_referrals.sql`, con nombres por feature) usando
`CREATE TABLE IF NOT EXISTS`, sin pasar por `drizzle-kit generate` — por eso nunca se generó
snapshot ni entrada de journal para ellos. Al ejecutarse después de `0016_rare_garia` (si alguna
vez se hubieran ejecutado), habrían sido no-ops puros: **cada tabla que crean ya existe**. Se
verificó columna por columna que el conjunto de tablas de estos 12 archivos es idéntico al
conjunto de tablas de `0016_rare_garia.sql` (sin faltantes ni sobrantes).

Adicionalmente, `0028_wallet_transactions_ledger.sql` fue escrita a mano siguiendo el mismo patrón
(sin `drizzle-kit generate`), y dependía de una tabla `payments` que **ningún archivo de
migración creaba** — la tabla `payments` existe en la base de desarrollo real (`rapago`)
únicamente porque `payments.schema.ts` nunca estuvo exportado desde
`apps/api/src/db/schema/index.ts` (bug de origen, corregido en esta misma fase), lo que hizo que
`drizzle-kit generate` jamás la detectara ni la incluyera en ninguna migración oficial.

## Migración oficial de reemplazo

`apps/api/src/db/migrations/0017_mature_mastermind.sql` — generada con `drizzle-kit generate`
después de corregir el export faltante de `payments` en `schema/index.ts` y de declarar en
`walletTransactions.schema.ts` los 5 índices de rendimiento que `0028` tenía en SQL crudo pero que
no estaban reflejados en el schema TypeScript. Registrada correctamente en `_journal.json`
(`idx 17`, tag `0017_mature_mastermind`) con su snapshot correspondiente
(`meta/0017_snapshot.json`). Crea `payments` (15 columnas, 2 FKs, 4 índices) y
`wallet_transactions_ledger` (28 columnas, 9 FKs, 1 UNIQUE, 1 CHECK, 5 índices) — estructura
verificada como idéntica a la de los archivos archivados.

## Detalle por archivo

| Archivo original | Motivo del archivo | ¿Redundante? | Migración oficial que lo reemplaza | Evidencia de ausencia en journal |
|---|---|---|---|---|
| `0016_driver_profiles.sql` | Tabla `driver_profiles` ya creada por `0016_rare_garia.sql` (journal `idx 16`) | Sí, 100% | `0016_rare_garia.sql` (ya activa) | No aparece ningún tag `0016_driver_profiles` en `_journal.json` |
| `0017_passenger_profiles.sql` | Tabla `passenger_profiles` ya creada por `0016_rare_garia.sql` | Sí, 100% | `0016_rare_garia.sql` (ya activa) | No aparece en `_journal.json` |
| `0018_payments_base.sql` | Tablas `wallets`, `payment_methods`, `transactions`, `payment_orders` ya creadas por `0016_rare_garia.sql` (nombre del archivo es engañoso: **no** crea la tabla `payments`) | Sí, 100% | `0016_rare_garia.sql` (ya activa) | No aparece en `_journal.json` |
| `0019_tourist_services.sql` | Tablas `tourist_services`, `service_bookings` ya creadas por `0016_rare_garia.sql` | Sí, 100% | `0016_rare_garia.sql` (ya activa) | No aparece en `_journal.json` |
| `0020_rental_fleet.sql` | Tablas `rental_vehicles`, `rental_bookings` ya creadas por `0016_rare_garia.sql` | Sí, 100% | `0016_rare_garia.sql` (ya activa) | No aparece en `_journal.json` |
| `0021_tour_pricing_and_notifications.sql` | Tablas `service_pricing_tiers`, `notifications` ya creadas por `0016_rare_garia.sql` | Sí, 100% | `0016_rare_garia.sql` (ya activa) | No aparece en `_journal.json` |
| `0022_notifications_wa_me.sql` | `ALTER TABLE notifications` sobre una tabla ya definida en su forma final por `0016_rare_garia.sql` | Sí, 100% | `0016_rare_garia.sql` (ya activa) | No aparece en `_journal.json` |
| `0023_applications.sql` | Tabla `applications` ya creada por `0016_rare_garia.sql` | Sí, 100% | `0016_rare_garia.sql` (ya activa) | No aparece en `_journal.json` |
| `0024_event_tickets.sql` | Tabla `event_tickets` ya creada por `0016_rare_garia.sql` | Sí, 100% | `0016_rare_garia.sql` (ya activa) | No aparece en `_journal.json` |
| `0025_legal_documents.sql` | Tablas `legal_documents`, `user_acceptances` ya creadas por `0016_rare_garia.sql` | Sí, 100% | `0016_rare_garia.sql` (ya activa) | No aparece en `_journal.json` |
| `0026_fare_settings.sql` | Tablas `fare_settings`, `zone_fares` ya creadas por `0016_rare_garia.sql` | Sí, 100% | `0016_rare_garia.sql` (ya activa) | No aparece en `_journal.json` |
| `0027_referrals.sql` | Tablas `referral_codes`, `referral_uses` ya creadas por `0016_rare_garia.sql` | Sí, 100% | `0016_rare_garia.sql` (ya activa) | No aparece en `_journal.json` |
| `0028_wallet_transactions_ledger.sql` | Único con contenido genuinamente nuevo (`wallet_transactions_ledger`), pero dependía de una tabla `payments` sin migración de origen, y él mismo nunca fue registrado en journal | No — contenido único, pero mal formado (dependencia faltante) y no versionado oficialmente | `0017_mature_mastermind.sql` (crea `payments` + `wallet_transactions_ledger` juntas, en orden correcto, con estructura idéntica) | No aparece en `_journal.json` |

## Impacto en entornos externos

```text
IMPACTO EN ENTORNOS EXTERNOS: EVIDENCIA INSUFICIENTE
```

No se puede confirmar ni descartar, desde este repositorio y esta máquina local, si alguno de
estos 13 archivos fue alguna vez ejecutado manualmente (vía `psql -f`, un cliente SQL, o
`migrate:prod`/`scripts/migrate-prod.ts`) contra un entorno de staging o producción real. No
existe workflow de CI/CD en este repositorio (`.github/workflows` no existe) que los hubiera
ejecutado automáticamente, y ninguno de los 13 nombres de archivo aparece referenciado en
`DEPLOY_CHECKLIST.md`, `Dockerfile`, ni en ningún script del monorepo — pero la ausencia de
referencias en el repositorio no es prueba de que un operador no los haya aplicado manualmente en
el pasado. Si staging o producción ya tienen estas tablas por esta vía, no hay conflicto: todas
las sentencias `CREATE TABLE`/`CREATE INDEX` originales usaban `IF NOT EXISTS`, por lo que
`0017_mature_mastermind.sql` (sin `IF NOT EXISTS`, estilo estándar de `drizzle-kit generate`)
**fallaría con "already exists"** si se ejecuta contra un entorno donde `payments` o
`wallet_transactions_ledger` ya existen fuera del control del journal. Este escenario debe
verificarse explícitamente contra cada entorno externo antes de desplegar (`SELECT
to_regclass('payments')`, `SELECT to_regclass('wallet_transactions_ledger')`) — ver
`docs/security/MIGRATION_SYSTEM_REMEDIATION_REPORT.md`.
