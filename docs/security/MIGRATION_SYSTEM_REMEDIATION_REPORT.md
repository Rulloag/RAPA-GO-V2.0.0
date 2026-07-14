# FASE 5 — Reparación del sistema de migraciones

**Fecha:** 2026-07-14
**Rama:** `integration/leandro-security-remediation`
**Entornos usados:** exclusivamente bases PostgreSQL 16 locales desechables
(`rapago_fase5_empty`, `rapago_fase5_existing`, `rapago_fase5_drift`), creadas y eliminadas en
esta sesión. **No se aplicó ninguna migración a la base de desarrollo real (`rapago`), ni a
staging, ni a producción.** No se hizo push ni merge.

## Causa raíz

Ver `docs/security/MIGRATION_0028_VALIDATION_REPORT.md` para el hallazgo original. Resumen:

1. `apps/api/src/db/migrations/meta/_journal.json` no registraba las migraciones `0017` a `0028`
   → `npm run db:migrate` nunca las ejecutaba en ningún entorno.
2. La tabla `payments` no tenía ninguna migración de origen, porque
   `apps/api/src/db/schema/payments.schema.ts` **nunca estuvo exportado** desde
   `apps/api/src/db/schema/index.ts` — el archivo barril que lee `drizzle.config.ts`. `drizzle-kit
   generate` nunca vio la tabla `payments` y por eso nunca generó una migración para ella.

## Paso 1 — Inventario completo

| # | Archivo SQL | ¿En journal? | Tablas creadas | Tablas modificadas | Dependencias | Orden correcto | ¿Aplicada en dev real? | Evidencia |
|---|---|---|---|---|---|---|---|---|
| 0000–0015 | `0000_cuddly_the_spike.sql` … `0015_unique_drax.sql` | Sí | ~28 tablas base (users, auth, rides, ratings, etc.) | — | — | Sí | Sí, pero fuera de tracking de `db:migrate` (ver Paso 5) | `_journal.json` idx 0–15; `meta/000X_snapshot.json` existentes |
| 0016 | `0016_driver_profiles.sql` | **No** | `driver_profiles` | — | `users` | — (redundante) | Sí (tabla existe) | No aparece en `_journal.json`; ninguna entrada `0016_driver_profiles` |
| 0016 (dup.) | `0016_rare_garia.sql` | **Sí** (idx 16) | 20 tablas: `applications`, `driver_profiles`, `event_tickets`, `fare_settings`, `legal_documents`, `notifications`, `passenger_profiles`, `payment_methods`, `payment_orders`, `referral_codes`, `referral_uses`, `rental_bookings`, `rental_vehicles`, `service_bookings`, `service_pricing_tiers`, `tourist_services`, `transactions`, `user_acceptances`, `wallets`, `zone_fares` | — | `users`, `ride_requests` | Sí (consolidada) | Sí, tabla por tabla verificada | `meta/0016_snapshot.json` incluye las 33 tablas acumuladas hasta ese punto |
| 0017 | `0017_passenger_profiles.sql` | **No** | `passenger_profiles` | — | `users` | — (redundante, ya en 0016_rare_garia) | Sí (tabla existe) | No aparece en `_journal.json` |
| 0018 | `0018_payments_base.sql` | **No** | `wallets`, `payment_methods`, `transactions`, `payment_orders` (**no** `payments`, pese al nombre) | — | `users` | — (redundante) | Sí (tablas existen) | No aparece en `_journal.json` |
| 0019 | `0019_tourist_services.sql` | **No** | `tourist_services`, `service_bookings` | — | `users` | — (redundante) | Sí | No aparece en `_journal.json` |
| 0020 | `0020_rental_fleet.sql` | **No** | `rental_vehicles`, `rental_bookings` | — | `users` | — (redundante) | Sí | No aparece en `_journal.json` |
| 0021 | `0021_tour_pricing_and_notifications.sql` | **No** | `service_pricing_tiers`, `notifications` | `tourist_services` (ALTER) | `tourist_services` | — (redundante) | Sí | No aparece en `_journal.json` |
| 0022 | `0022_notifications_wa_me.sql` | **No** | — | `notifications` (ALTER) | `notifications` | — (redundante, columna final ya en 0016_rare_garia) | Sí | No aparece en `_journal.json` |
| 0023 | `0023_applications.sql` | **No** | `applications` | — | `users` | — (redundante) | Sí | No aparece en `_journal.json` |
| 0024 | `0024_event_tickets.sql` | **No** | `event_tickets` | — | `users` | — (redundante) | Sí | No aparece en `_journal.json` |
| 0025 | `0025_legal_documents.sql` | **No** | `legal_documents`, `user_acceptances` | — | `users` | — (redundante) | Sí | No aparece en `_journal.json` |
| 0026 | `0026_fare_settings.sql` | **No** | `fare_settings`, `zone_fares` | — | — | — (redundante) | Sí | No aparece en `_journal.json` |
| 0027 | `0027_referrals.sql` | **No** | `referral_codes`, `referral_uses` | — | `users` | — (redundante) | Sí | No aparece en `_journal.json` |
| 0028 | `0028_wallet_transactions_ledger.sql` | **No** | `wallet_transactions_ledger` | — | `wallets`, `users`, `ride_requests`, **`payments` (sin migración de origen)** | Único con contenido genuinamente nuevo, pero mal formado | **No** (tabla nunca existió en `rapago`) | No aparece en `_journal.json`; confirmado con `to_regclass()` contra `rapago` |

**Los 12 archivos `0016_driver_profiles` … `0027_referrals` son 100% redundantes**: se verificó
programáticamente (extracción + `comm`) que el conjunto de tablas que crean es idéntico, sin
faltantes ni sobrantes, al conjunto de 20 tablas creadas por `0016_rare_garia.sql` (que sí está en
el journal). Solo `0028` tenía contenido único (`wallet_transactions_ledger`), pero dependía de
una tabla nunca versionada.

## Paso 2 — Reconciliación con herramientas oficiales (sin editar el journal a mano)

No se escribió ninguna entrada de journal ni snapshot a mano. Se usó exclusivamente
`npx drizzle-kit generate`, que:

1. Lee `apps/api/drizzle.config.ts` → `schema: "./src/db/schema/index.ts"`.
2. Diffea el `schema.ts` actual contra el último snapshot real (`meta/0016_snapshot.json`, 33
   tablas).
3. Genera automáticamente el `.sql`, el snapshot y la entrada de journal (hash `sha256` del
   contenido del archivo, timestamp `when` en `meta/_journal.json`) — sin intervención manual.

**Primer intento (fallido a propósito, para exponer la causa raíz):** con `schema/index.ts` sin
tocar, `drizzle-kit generate` detectó únicamente `wallet_transactions_ledger` como tabla nueva (34
tablas totales) — **`payments` no aparecía**, confirmando que el bug de origen era el export
faltante. Se descartó ese archivo generado (`0017_perfect_mister_fear.sql`, nunca comiteado) y se
corrigió `apps/api/src/db/schema/index.ts` agregando:

```ts
export { payments, type Payment, type NewPayment } from "./payments.schema.js";
```

**Segundo hallazgo:** los 5 índices de rendimiento que sí tenía el `0028` original en SQL crudo
(`idx_wallet_tx_ledger_user_id`, `_wallet_id`, `_status`, `_ride_id`, `_type_status`) no estaban
declarados en `apps/api/src/db/schema/walletTransactions.schema.ts` — por lo que `drizzle-kit
generate` no los habría incluido. Se agregaron como `index(...)` en el schema TypeScript (fuente
de verdad), con los mismos nombres exactos, para que la migración generada los incluya y el
schema.ts quede completo y consistente con la estructura SQL real.

**Tercer hallazgo (compatibilidad con entornos existentes):** una única migración combinada
`payments` + `wallet_transactions_ledger` es incompatible con cualquier entorno donde `payments`
ya exista fuera de banda (como `rapago`, confirmado — ver Paso 5/6): al no usar `IF NOT EXISTS`
(estilo estándar de `drizzle-kit generate`), fallaría con `relation "payments" already exists`.
Se generó en dos pasos separados (comentando temporalmente el export de
`walletTransactionsLedger`, generando, restaurando el export, generando de nuevo) para obtener
**dos migraciones independientes**, permitiendo un baseline granular por entorno (Paso 5/6).

## Paso 3 — Migraciones oficiales resultantes

- **`apps/api/src/db/migrations/0017_next_natasha_romanoff.sql`** — crea `payments` (15 columnas,
  2 FKs a `ride_requests`/`users`, 4 índices), estructura idéntica a `payments.schema.ts` y al
  `payments` real de `rapago`... **excepto por un drift preexistente ya documentado en el Paso 7**
  (columnas `provider_payment_id`/`raw_provider_payload` del schema vs. `external_id`/
  `webhook_payload` en `rapago`).
- **`apps/api/src/db/migrations/0018_flippant_joshua_kane.sql`** — crea `wallet_transactions_ledger`
  (28 columnas, 9 FKs incluyendo autorreferencia para reversas/settlements, `UNIQUE(idempotency_key)`,
  `CHECK(amount_clp > 0)`, 5 índices) — estructura idéntica al `0028` original archivado.
- Ambas registradas correctamente en `meta/_journal.json` (idx 17 y 18) con sus snapshots
  (`meta/0017_snapshot.json`, `meta/0018_snapshot.json`), generados automáticamente por la
  herramienta, sin edición manual.

No se renombraron los archivos a nombres "bonitos" tipo `0017_payments_base.sql`: se dejaron los
nombres auto-generados por `drizzle-kit` (`0017_next_natasha_romanoff.sql`,
`0018_flippant_joshua_kane.sql`) para evitar cualquier desincronización entre el nombre del
archivo, el `tag` del journal y el nombre del snapshot — exactamente el tipo de edición manual que
causó el problema original.

## Paso 4 — Orden y estrategia elegida

`payments` (0017) se ejecuta antes que `wallet_transactions_ledger` (0018) — orden forzado por la
dependencia de FK y verificado en la ejecución real (Paso 5).

**No se renumeró ninguna migración ya aplicada en un entorno real.** `0000`–`0016_rare_garia` se
dejaron completamente intactos. Los 12 archivos redundantes y el `0028` original **se archivaron**
(no se renumeraron ni se editaron) en `apps/api/src/db/migrations/_archived_untracked/`, con
justificación completa en `_archived_untracked/README.md`.

**Estrategia elegida: reconstrucción del journal (vía herramienta oficial) + nueva migración
incremental**, combinada con un **baseline controlado** para entornos que ya tienen parte del
schema aplicada fuera de banda:

- **Entorno nuevo** (CI, staging nunca provisionado, disaster recovery): `npm run db:migrate` sin
  ningún paso manual — aplica `0000` → `0018` en orden, sin intervención. Verificado (Paso 5).
- **Base de desarrollo existente** (`rapago`, o cualquier entorno con el mismo patrón: schema
  aplicado por `drizzle-kit push`/manual, sin tabla `drizzle.__drizzle_migrations`): requiere un
  **baseline manual, de una sola fila**, antes de poder usar `db:migrate` de forma segura (ver
  Paso 6 para el procedimiento exacto y su validación). **Este paso NO se ejecutó contra `rapago`
  real** — solo se demostró y validó contra una base de pruebas que replica su estado.
- **Staging/producción futuros**: impacto depende de si ya tienen el schema aplicado
  out-of-band (como `rapago`) o se provisionan desde cero. Debe verificarse el estado real de cada
  entorno (`SELECT to_regclass('payments')`, `SELECT to_regclass('wallet_transactions_ledger')`,
  `SELECT to_regclass('drizzle.__drizzle_migrations')`) antes de correr `db:migrate` por primera
  vez ahí — ver checklist en la sección de riesgos.

## Paso 5 — Validación desde cero (base vacía)

```bash
psql -d postgres -c "CREATE DATABASE rapago_fase5_empty;"
DATABASE_URL="postgresql://.../rapago_fase5_empty" npm run db:migrate
```

**Resultado: ✅ éxito completo.**

- Las 19 migraciones (`0000`–`0018`) se aplicaron sin errores (solo `NOTICE` benignos de
  truncamiento de nombres de constraint >63 caracteres en `wallet_transactions_ledger` — límite
  estándar de identificadores de PostgreSQL, cosmético, no bloqueante).
- `payments` existe (15 columnas, 2 FKs, 4 índices).
- `wallet_transactions_ledger` existe (28 columnas, 9 FKs, 5 índices, UNIQUE, CHECK).
- 35 tablas totales.
- **Segunda ejecución** de `npm run db:migrate`: mismo comando, mismo resultado, **35 tablas
  antes y después, sin cambios** — `drizzle.__drizzle_migrations` mantiene 19 filas, ningún
  archivo se re-ejecuta ni se duplica ningún objeto.
- **Ningún archivo de `_archived_untracked/` fue leído ni ejecutado** — `drizzle-kit migrate` solo
  itera sobre las entradas de `_journal.json`, que no los incluye.

## Paso 6 — Validación sobre base con estado existente (sin usar `rapago` real)

Se construyó `rapago_fase5_existing` replicando fielmente el patrón real de `rapago`:

1. Se aplicaron manualmente (vía `psql -f`, no vía `db:migrate`) las migraciones `0000`–
   `0016_rare_garia.sql`, sin crear la tabla `drizzle.__drizzle_migrations` — replicando
   exactamente que `rapago` **no tiene** esa tabla de tracking (confirmado:
   `SELECT * FROM drizzle.__drizzle_migrations` contra `rapago` → `relation ... does not exist`).
2. Se creó `payments` manualmente (fuera de banda, como en `rapago`) y se sembraron 3 filas de
   datos de prueba (1 usuario, 1 viaje, 1 pago).
3. **Primer intento, sin baseline:** `npm run db:migrate` **falló** con
   `relation "users" already exists` — confirmando que, tal como está hoy, **ejecutar `db:migrate`
   contra la base de desarrollo real `rapago` fallaría inmediatamente**, porque intentaría
   recrear desde `0000` al no encontrar ninguna migración registrada. Se verificó que el fallo es
   transaccionalmente seguro: los 3 datos de prueba permanecieron intactos después del error (no
   hay pérdida de datos ni siquiera en el escenario de fallo).
4. **Baseline controlado:** se insertó una única fila en `drizzle.__drizzle_migrations` con
   `hash = sha256(0017_next_natasha_romanoff.sql)` y `created_at` = el timestamp `when` de esa
   misma entrada en el journal — marcando "todo hasta 0017 (incluida `payments`) ya aplicado", sin
   volver a ejecutar ninguna sentencia SQL. Mecanismo verificado leyendo el código fuente de
   `drizzle-orm` (`pg-core/dialect.js`): el runner solo compara el `created_at` de la última fila
   contra el `folderMillis` (`when`) de cada entrada del journal, no requiere una fila por
   migración histórica.
5. **Segundo intento, con baseline:** `npm run db:migrate` → **✅ éxito.** Solo se ejecutó `0018`
   (crea `wallet_transactions_ledger`, la única migración con `folderMillis` posterior al
   baseline).

**Resultado verificado:**
- No se perdieron datos: los 3 registros de prueba (`users`, `ride_requests`, `payments`)
  permanecen exactamente iguales antes y después.
- No se duplicó `payments` (`SELECT count(*) FROM pg_tables WHERE tablename='payments'` → `1`).
- No fallaron constraints.
- `wallet_transactions_ledger` se creó correctamente.
- Schema final: 35 tablas — **idéntico** al resultado de migrar desde cero (Paso 5).

**Procedimiento de baseline documentado para uso futuro en `rapago` (NO ejecutado contra la base
real en esta fase):**

```sql
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint
);
-- Verificar PRIMERO que payments y wallet_transactions_ledger tienen el estado esperado en el
-- entorno objetivo antes de ejecutar esto. El hash y el "when" deben tomarse de
-- apps/api/src/db/migrations/meta/_journal.json (entrada 0017) y del archivo real
-- 0017_next_natasha_romanoff.sql vigente en la rama que se despliega.
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES ('<sha256 de 0017_next_natasha_romanoff.sql>', <when de la entrada 0017 en _journal.json>);
```

## Paso 7 — Detección de drift

Comparación `schema.ts` reconstruido desde cero (`rapago_fase5_drift`) vs. `rapago` (dev real):

| Categoría | Hallazgo | Relacionado con pagos/Wallet/rides/seguridad | Estado |
|---|---|---|---|
| Tablas solo en `rapago`, ausentes de `schema.ts`/migraciones | `ride_assignment_offers` (4 filas), `ride_stops` (19 filas) | **Sí — rides** | 🔴 **CRÍTICO, NO RESUELTO EN ESTA FASE.** Ningún archivo en `apps/api/src/` (schema, repositorios, servicios) referencia estos nombres — ni `rideAssignmentOffers` ni `rideStops` en ninguna forma. Tienen datos reales en dev. No se puede inferir con seguridad su estructura de negocio (constraints, reglas de transición de estado) sin contexto del equipo — **no se intentó recrear su schema a ciegas**. Requiere su propia fase de remediación: confirmar con el equipo si la feature de paradas múltiples / ofertas de asignación a conductores sigue viva, y si sí, escribir su `schema.ts` + migración oficial; si no, decidir si se archivan/eliminan los datos. |
| Tablas solo en la reconstrucción, ausentes de `rapago` | `wallet_transactions_ledger` | Sí — Wallet | ✅ Esperado y correcto: es la tabla que esta fase introduce; aún no aplicada a `rapago` (intencional, no se debía aplicar). |
| Columnas de `payments`: `schema.ts` vs. `rapago` | `rapago` tiene `external_id`, `webhook_payload`; `schema.ts`/migración nueva tienen `provider_payment_id`, `raw_provider_payload` en su lugar | **Sí — pagos** | 🔴 **CRÍTICO, NO RESUELTO EN ESTA FASE.** El código actual (`payments.repository.ts`, `payments.service.ts`, providers de MercadoPago/ProntoPaga) usa exclusivamente los nombres `providerPaymentId`/`rawProviderPayload` (los del schema.ts). Si el código en ejecución contra `rapago` real llega a ejecutar esas rutas (webhooks de pago), fallaría porque esas columnas no existen ahí. Indica que la tabla `payments` real quedó de una versión anterior del schema y nunca se sincronizó. **Bloqueante para cualquier entorno que dependa de `rapago` con webhooks de pago reales activos** — requiere decidir con el equipo si se migra `rapago.payments` (`ALTER TABLE ... RENAME COLUMN`) o si el código debe tolerar ambos nombres, y generar la migración correspondiente. |
| Columna `users.phone` | `rapago` tiene `phone`; `users.schema.ts` no la define, ninguna migración (ni las archivadas) la crea | **Sí — seguridad/identidad de usuario, usado en rides/drivers/passengers** | 🔴 **CRÍTICO, NO RESUELTO EN ESTA FASE.** 9 módulos (`rides`, `drivers`, `passengers`, `tourist`, `rental`, `applications`) referencian `.phone` sobre registros de `users` en su código TypeScript, pero `users.schema.ts` (la fuente de verdad para Drizzle) no declara esa columna. En cualquier entorno construido solo desde `schema.ts` + migraciones (como el que se acaba de validar en el Paso 5), ese código fallaría en tiempo de ejecución al intentar leer/escribir un campo que Drizzle no conoce. Requiere agregar `phone` a `users.schema.ts` y generar la migración correspondiente cuanto antes — **no se hizo en esta fase** porque excede el alcance de "reparación del sistema de migraciones de Wallet" y requiere confirmar el tipo/nulabilidad/unicidad exactos contra el uso real en cada módulo. |

**Conclusión del Paso 7:** el drift específico de esta fase (journal + `payments` + `wallet_transactions_ledger`) **quedó completamente resuelto**. Se descubrieron, en el proceso, **tres drift adicionales preexistentes, no relacionados con la migración 0028 original, pero sí con pagos/rides/seguridad** — se documentan aquí como hallazgos nuevos y **quedan marcados como bloqueantes para cualquier despliegue a un entorno nuevo o a staging/producción**, pero no se resuelven en esta fase por estar fuera de su alcance declarado y requerir decisiones de negocio/equipo que no corresponden a esta remediación de Wallet.

## Paso 8 — Tests, builds y script de CI

- `npm run test --workspace=apps/api` → **117/117** (sin cambios, sin regresiones).
- `npm run typecheck --workspace=apps/api` → **0 errores**.
- `npm run build --workspace=apps/api` → **OK**.
- `npm run typecheck --workspace=apps/mobile` → **0 errores**.
- `npm run build --workspace=apps/mobile` → **OK** (mismo warning preexistente de tamaño de
  chunk).

Se agregó `apps/api/scripts/verify-migration-chain.sh` (ejecutable) + script npm
`db:verify-chain`, pensado para CI: crea una base PostgreSQL desechable, corre
`npm run db:migrate`, verifica que existan las tablas críticas (`payments`, `wallets`,
`wallet_transactions_ledger`, `ride_requests`, `users`), confirma que una segunda ejecución no
cambia el número de tablas, y elimina la base al finalizar (usa un nombre único con PID, nunca
toca `DATABASE_URL` de ningún entorno real). **Ejecutado y verificado exitosamente en esta
sesión** contra una base desechable real.

## Rollback

- `0018_flippant_joshua_kane.sql`: `DROP TABLE IF EXISTS wallet_transactions_ledger;` — hoja del
  grafo de FKs (solo se autorreferencia), sin dependientes externos, igual que el `0028` original.
- `0017_next_natasha_romanoff.sql`: `DROP TABLE IF EXISTS payments CASCADE;` — **requiere
  `CASCADE`** (o eliminar primero `wallet_transactions_ledger`) porque esta última tiene FK hacia
  `payments`. En un entorno donde `payments` ya existía antes de esta fase (como `rapago`), **no
  se debe hacer rollback de `payments`** — el rollback de esta fase en un entorno así se limita a
  `DROP TABLE wallet_transactions_ledger` y a revertir la fila de baseline insertada en
  `drizzle.__drizzle_migrations` si corresponde.
- El archivado de los 13 archivos en `_archived_untracked/` es reversible: `git mv` de vuelta a
  `apps/api/src/db/migrations/`. No se eliminó nada de forma definitiva.

## Comandos ejecutados (resumen)

```bash
npx drizzle-kit generate                         # x2 (payments; luego ledger)
npm run db:migrate                                # base vacía, 2 veces
npm run db:migrate                                # base "existente", con y sin baseline
npm run test --workspace=apps/api
npm run typecheck --workspace=apps/api
npm run build --workspace=apps/api
npm run typecheck --workspace=apps/mobile
npm run build --workspace=apps/mobile
apps/api/scripts/verify-migration-chain.sh
git mv <13 archivos> apps/api/src/db/migrations/_archived_untracked/
```

---

```text
ARCHIVOS ARCHIVADOS: 13 (0016_driver_profiles.sql, 0017_passenger_profiles.sql,
  0018_payments_base.sql, 0019_tourist_services.sql, 0020_rental_fleet.sql,
  0021_tour_pricing_and_notifications.sql, 0022_notifications_wa_me.sql, 0023_applications.sql,
  0024_event_tickets.sql, 0025_legal_documents.sql, 0026_fare_settings.sql, 0027_referrals.sql,
  0028_wallet_transactions_ledger.sql)
ARCHIVOS ELIMINADOS DEFINITIVAMENTE: 0
JOURNAL CONSISTENTE: SÍ
PAYMENTS CREADA POR MIGRACIÓN OFICIAL: SÍ (0017_next_natasha_romanoff.sql, generada con
  drizzle-kit generate)
LEDGER CREADO POR MIGRACIÓN OFICIAL: SÍ (0018_flippant_joshua_kane.sql, generada con
  drizzle-kit generate)
DB VACÍA MIGRA SOLO CON npm run db:migrate: SÍ
SEGUNDA EJECUCIÓN ES SEGURA: SÍ (0 cambios, 35 tablas antes y después, sin duplicados)
BASE EXISTENTE MIGRA SIN PÉRDIDA: SÍ (requiere baseline manual documentado — ver Paso 6 — sin el
  cual db:migrate FALLA de forma segura, sin pérdida de datos, contra un entorno con el patrón de
  rapago)
SCHEMA DRIFT RESUELTO: PARCIAL — el drift de esta fase (journal + payments + ledger) SÍ quedó
  resuelto; se encontraron y documentaron 3 drift adicionales preexistentes (ride_assignment_offers
  y ride_stops sin schema.ts; payments con columnas distintas entre schema.ts y rapago real;
  users.phone usado en 9 módulos pero ausente de users.schema.ts) que quedan marcados como
  bloqueantes para nuevos entornos, pendientes de una fase de remediación separada
TESTS API: 117/117
BUILD API: OK
BUILD MOBILE: OK
RIESGOS CRÍTICOS: 3 (drift preexistente no resuelto: ride_assignment_offers/ride_stops sin
  schema.ts con datos reales; payments con columnas desincronizadas entre schema.ts y rapago;
  users.phone usado en código pero ausente de users.schema.ts — ninguno bloquea el PR de Wallet en
  sí, pero SÍ bloquean provisionar con confianza cualquier entorno nuevo desde schema.ts +
  migraciones hasta resolverse)
RIESGOS ALTOS: 1 (baseline de rapago real pendiente de ejecutar — documentado y validado en un
  entorno equivalente, pero NO ejecutado contra rapago; requiere ventana de mantenimiento y
  verificación previa del estado exacto de esa base antes de correr db:migrate ahí por primera vez)
APTO PARA MERGE A MAIN: SÍ — el objetivo específico de esta fase (journal desincronizado +
  payments sin migración de origen, que bloqueaban la migración 0028 original) quedó completamente
  resuelto, validado desde cero y sobre estado existente, sin pérdida de datos, con
  117/117 tests y builds limpios. Los 3 riesgos críticos de drift descubiertos son preexistentes a
  este PR, no lo bloquean funcionalmente, pero deben quedar registrados como tareas de seguimiento
  obligatorias antes de desplegar a cualquier entorno nuevo o a staging/producción.
```
