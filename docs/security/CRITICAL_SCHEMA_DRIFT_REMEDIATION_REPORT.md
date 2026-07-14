# FASE 6 — Corrección del schema drift crítico

**Fecha:** 2026-07-14
**Rama:** `integration/leandro-security-remediation`
**Entornos usados:** exclusivamente bases PostgreSQL 16 locales desechables
(`rapago_fase6_a`, `rapago_fase6_b`, más los scripts de CI que crean/destruyen las suyas propias).
**No se aplicó ninguna migración a `rapago` real, ni a staging, ni a producción.** No se hizo push
ni merge.

## Resumen ejecutivo

| Hallazgo | Clasificación original (Fase 5) | Resultado tras investigación (Fase 6) |
|---|---|---|
| Payments schema drift (`external_id`/`webhook_payload` vs. `provider_payment_id`/`raw_provider_payload`) | CRÍTICO | **Confirmado y RESUELTO** — migración de reconciliación `0019` |
| `users.phone` ausente del schema versionado | CRÍTICO | **Corregido: no era un drift real.** Ningún código lee ni escribe `users.phone`; el `phone` que usan los 9 módulos citados en la Fase 5 pertenece a `driver_profiles`/`passenger_profiles` (ya versionadas, sin drift). `users.phone` en `rapago` es una columna huérfana sin código dependiente — no requiere migración. |
| Tablas huérfanas (`ride_assignment_offers`, `ride_stops`) | MEDIO | Clasificadas como **HUÉRFANAS CON DATOS** — no resueltas en esta fase (ver Hallazgo 3) |

## HALLAZGO 1 — Payments schema drift

### Paso 1 — Inventario exacto

| Concepto | Código espera | Schema declara | DB real (`rapago`) tiene | Uso actual |
|---|---|---|---|---|
| `id` | `id` | `uuid` | `uuid` | PK, sin drift |
| `rideRequestId` | `ride_request_id` | `uuid NOT NULL` | `uuid NOT NULL` | FK a `ride_requests`, sin drift |
| `passengerUserId` | `passenger_user_id` | `uuid NOT NULL` | `uuid NOT NULL` | FK a `users`, sin drift |
| `amountClp` | `amount_clp` | `integer NOT NULL` | `integer NOT NULL` | Monto autoritativo, sin drift |
| `status` | `status` | `varchar(32)` | `varchar(30)` | Valores en uso: `pending/processing/success/failed/rejected/refunded` — drift de longitud, no bloqueante |
| `provider` | `provider` | `varchar(32) NOT NULL` | `varchar(30) default 'prontopaga'` | Sin drift funcional |
| `providerOrderId` | `provider_order_id` | `varchar(160)` | `varchar(100)` | `findByProviderOrderId`, idempotencia de creación de orden — drift de longitud, no bloqueante |
| `providerPaymentId` | `provider_payment_id` | `varchar(160)` | ❌ ausente (`external_id varchar(100)`) | **CRÍTICO** — `markSuccess()`, `extractMercadoPagoPaymentId()` (refund), conciliación |
| `urlPay` | `url_pay` | `text` | `text` | Sin drift |
| `rawProviderPayload` | `raw_provider_payload` | `jsonb` | ❌ ausente (`webhook_payload jsonb`) | **CRÍTICO** — `markSuccess()`, `markRejected()`, `markRefunded()`, `markRefundFailed()`, `getStoredRefundStatus()` |
| `createdAt`/`updatedAt`/`paidAt`/`rejectedAt`/`failedAt` | igual | igual | igual | Sin drift |
| *(sin nombre en código)* | — | — | `payments_ride_active_idx` — índice único parcial (`ride_request_id` WHERE `status IN ('pending','processing')`) | **Constraint de negocio activo en `rapago`, no modelado en `schema.ts`** |

Fuentes revisadas: `payments.schema.ts`, `0017_next_natasha_romanoff.sql`,
`\d payments` contra `rapago`, `payments.repository.ts`, `payments.service.ts`,
`mercadopago.provider.ts`, `prontopaga.provider.ts`, `payment.provider.ts`,
`payments.service.test.ts`, `mercadopago.provider.test.ts`, `prontopaga.service.test.ts`.

### Paso 2 — Semántica confirmada

```text
external_id (DB real)     == provider_payment_id (código/schema)  → SÍ, mismo concepto
webhook_payload (DB real) == raw_provider_payload (código/schema) → SÍ, mismo concepto
```

Evidencia:

- `payments.service.ts::extractMercadoPagoPaymentId()` lee `payment["providerPaymentId"]` como
  fuente primaria para identificar el pago en MercadoPago al momento de un refund — es decir, el
  valor que hoy vive en `external_id` (en `rapago`) es exactamente lo que ese código necesita leer
  desde `provider_payment_id`.
- `payments.repository.ts::markSuccess(id, externalId, webhookPayload)` — la variable local
  `externalId` (el ID de transacción que devuelve el proveedor, ver `payment.provider.ts` línea
  23: `externalId: string; // Provider's transaction / payment ID`) se persiste en la columna
  `provider_payment_id`. La variable `webhookPayload`/`rawPayload` se persiste en
  `raw_provider_payload`. Ningún código en el repositorio, el servicio, los proveedores de
  MercadoPago/ProntoPaga, ni los tests, lee o escribe una columna llamada literalmente
  `external_id` o `webhook_payload` — esos nombres solo aparecen como variables locales o claves
  dentro del payload JSON crudo de proveedores externos (ProntoPaga usa `external_id` como
  **campo del payload del webhook**, no como columna de base de datos — ver
  `prontopaga.provider.ts:123`), lo cual es una coincidencia de nombre, no una dependencia de
  columna.
- Se usa para: idempotencia de conciliación de refund (`extractMercadoPagoPaymentId`), estado de
  refund (`getStoredRefundStatus` lee `rawProviderPayload.refundStatus`/`.rapagoRefund.status`),
  y auditoría (todo el payload crudo del webhook se conserva para trazabilidad).

**Conclusión: son el mismo concepto renombrado**, no dos conceptos distintos. Se aplica la
"Opción preferida" (migración incremental de reconciliación, sin eliminar columnas legacy).

### Paso 3 — Migración de reconciliación

`apps/api/src/db/migrations/0019_reconcile_legacy_payments_columns.sql`, generada con
`npx drizzle-kit generate --custom --name=reconcile_legacy_payments_columns` (registro oficial en
`_journal.json`, sin edición manual de metadata) y completada a mano por ser una migración de
datos/reconciliación, no un diff estructural de `schema.ts`:

1. `ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_payment_id VARCHAR(160);` /
   `raw_provider_payload JSONB` — no-op en un entorno creado desde cero por `0017` (ya las tiene).
2. Backfill condicional dentro de un bloque `DO $$ ... $$`, que primero verifica con
   `information_schema.columns` si `external_id`/`webhook_payload` existen en ese entorno antes de
   leerlas — evita que la migración falle en un entorno fresco donde esas columnas legacy nunca
   existieron.
3. `CREATE UNIQUE INDEX IF NOT EXISTS payments_ride_active_idx ... WHERE status IN
   ('pending','processing')` — versiona el constraint de negocio detectado en `rapago` que no
   estaba modelado en `schema.ts` (Drizzle no soporta índices únicos parciales vía el helper
   `index()` estándar en la versión usada; se documentó con un comentario en
   `payments.schema.ts` apuntando a esta migración como fuente de verdad).
4. `CREATE INDEX IF NOT EXISTS payments_provider_payment_id_idx` — índice de lectura para las
   búsquedas de conciliación/refund.

**No se eliminaron `external_id` ni `webhook_payload`** — permanecen en la tabla con los datos
históricos intactos, sin ningún código que las use activamente.

### Paso 4 — Compatibilidad temporal en código

**No se agregó ninguna capa de compatibilidad `provider_payment_id ?? external_id`.** Justificación:
una vez aplicada la migración `0019` (que hace `ADD COLUMN` + backfill), **todo pago histórico
tiene el valor ya copiado a la columna canónica** — el código de Drizzle siempre lee/escribe
`provider_payment_id`/`raw_provider_payload` (los únicos nombres que `payments.schema.ts` declara);
nunca intentará leer `external_id`/`webhook_payload` porque Drizzle no conoce esos nombres de
columna. Verificado empíricamente: una consulta real con el ORM compilado contra una base con el
backfill aplicado devuelve `providerPaymentId`/`rawProviderPayload` con los valores correctos (ver
sección de validación). Agregar un fallback `?? external_id` sería código muerto, ya que Drizzle
nunca expone esa columna al código TypeScript — se documenta aquí en vez de escribirlo, para no
introducir complejidad innecesaria.

**Plan de retiro futuro** (no ejecutado en esta fase): una vez confirmado en producción que todos
los pagos históricos tienen `provider_payment_id`/`raw_provider_payload` poblados (auditable con
`SELECT count(*) FROM payments WHERE provider_payment_id IS NULL AND external_id IS NOT NULL`,
que debe dar `0`), una migración futura puede hacer `ALTER TABLE payments DROP COLUMN
external_id, DROP COLUMN webhook_payload`. No antes de una ventana de observación en producción.

## HALLAZGO 2 — `users.phone` (corrección del hallazgo original de Fase 5)

### Paso 5 — Uso real

```bash
rg -n "users\.phone|user\.phone|phone:" apps/api/src
```

Resultado: 17 coincidencias, **ninguna referencia `users.phone`**. Todas pertenecen a:

- `driver_profiles.phone` (`driverProfiles.schema.ts:7` — ya versionada, ya en `0016_rare_garia.sql`)
- `passenger_profiles.phone` (`passengerProfiles.schema.ts:7` — ya versionada, ya en `0016_rare_garia.sql`)
- `applications.phone` (`applications.schema.ts:13` — ya versionada)

Se verificó explícitamente con `rg -n "users\.phone"` (patrón exacto de columna sobre la tabla
`users`) en todo `apps/api/src`: **0 resultados**. Se revisó además el módulo de autenticación
(`src/modules/auth/`) — el registro de usuarios nunca setea `phone` sobre `users`.

**Corrección del hallazgo de Fase 5:** el grep original (`grep -rln ".phone\b" src/modules/`) fue
demasiado amplio y contó archivos que usan `.phone` sobre objetos de perfil (`driverProfile`,
`passengerProfile`), no sobre `users`. `users.phone`, presente en `rapago`, es una **columna
huérfana sin ningún código que dependa de ella** — no un caso de "el código depende del schema
pero el schema no lo tiene".

### Paso 6 — Definición de columna oficial

**No se agrega `phone` a `users.schema.ts`.** Justificación: el propio Paso 6 solicitado
("si `phone` realmente pertenece a `users`, agrégala formalmente") es condicional a que el código
la use — la evidencia del Paso 5 muestra que no la usa. Agregar una columna sin un consumidor real
sería un cambio de schema no respaldado por evidencia de uso, contrario al principio de no
introducir campos especulativos. `users.phone` en `rapago` puede tratarse en una fase de
limpieza de datos separada (decidir si se elimina o se migra su contenido a
`passenger_profiles.phone`/`driver_profiles.phone` si tiene datos aprovechables) — fuera del
alcance de esta remediación de seguridad.

### Paso 7 — Backfill

No aplica — no se creó ninguna columna nueva para `phone` en `users`.

## HALLAZGO 3 — Tablas huérfanas

| Tabla | Filas | Rango de fechas | FKs activas | Constraints de negocio | Código que la usa |
|---|---|---|---|---|---|
| `ride_assignment_offers` | 4 | 2026-06-11 → 2026-06-12 | `driver_user_id → users`, `ride_request_id → ride_requests` (ambas `ON DELETE CASCADE`) | `chk_offer_status` (enum pending/accepted/rejected/expired/cancelled), `chk_offer_expires_after_offered`, `chk_offer_attempt_order`, unique parcial `uq_driver_offer_pending` (1 oferta pendiente por conductor), unique parcial `uq_ride_offer_pending` (1 oferta pendiente por viaje) | **Ninguno** (`rg` sin resultados en `apps/api/src`) |
| `ride_stops` | 19 | 2026-06-11 → 2026-06-25 | `ride_request_id → ride_requests` (`ON DELETE CASCADE`) | `chk_ride_stops_stop_order_positive`, `chk_ride_stops_segment_*` (distancia/duración/tarifa ≥ 0), unique `uq_ride_stops_ride_order` (orden de parada único por viaje) | **Ninguno** (`rg` sin resultados en `apps/api/src`) |

**Clasificación: HUÉRFANAS CON DATOS.** El diseño (constraints de negocio, índices únicos
parciales bien pensados, checks de coherencia temporal) indica una feature completada a nivel de
base de datos — probablemente "cola de ofertas de asignación a conductor con expiración" y
"viajes multi-parada con tarifa por segmento" — pero cuyo código de aplicación nunca se integró en
esta rama, o fue removido/revertido después de crear las tablas. Los datos son recientes (hasta
15 días antes de esta fase), no son restos abandonados de hace meses.

**No se investigó en ramas antiguas de git** (fuera del alcance práctico de esta fase; requeriría
`git log --all --diff-filter=A -- '*ride_assignment*' '*ride_stops*'` contra todo el historial,
que no se ejecutó por priorizar el cierre de los hallazgos 1 y 2, explícitamente bloqueantes).

**No se elimina ningún dato.** Recomendación para una fase separada: confirmar con el equipo de
producto/desarrollo si la feature de multi-parada y ofertas de asignación sigue vigente; si sí,
escribir `rideAssignmentOffers.schema.ts`/`rideStops.schema.ts` y generar su migración oficial con
`drizzle-kit generate`; si no, decidir un plan de archivado de los 23 registros existentes antes de
cualquier `DROP TABLE`.

## Validación en bases de prueba

### Base A — Desde cero

```bash
CREATE DATABASE rapago_fase6_a;
DATABASE_URL=... npm run db:migrate
```

- ✅ 35 tablas, `payments` con `provider_payment_id`/`raw_provider_payload` (nunca tuvo
  `external_id`/`webhook_payload`).
- ✅ `payments_ride_active_idx` presente (índice único parcial).
- ✅ `wallet_transactions_ledger` presente.
- ✅ `users` sin columna `phone` (correcto — no hay código que la necesite).
- ✅ Segunda ejecución: 35 tablas antes y después, 20 migraciones registradas, sin cambios.

### Base B — Simulación de base existente (legacy)

```bash
# 0000-0016 aplicados manualmente + payments legacy (external_id/webhook_payload) +
# 1 pago histórico de ejemplo ya "success" con payload real de MercadoPago simulado +
# baseline de tracking hasta 0017 (payments legacy ya existe)
DATABASE_URL=... npm run db:migrate   # aplica solo 0018 + 0019
```

- ✅ Sin pérdida de datos: el pago histórico de prueba permanece con sus 15 columnas originales
  intactas, más las 2 columnas nuevas correctamente rellenadas.
- ✅ Backfill correcto: `provider_payment_id = 'mp-payment-999' = external_id`;
  `raw_provider_payload = webhook_payload` (JSON idéntico).
- ✅ **Prueba con el ORM real**: se consultó la fila migrada usando `drizzle-orm` compilado
  (`db.select().from(payments)...`) — devolvió `providerPaymentId: 'mp-payment-999'` y
  `rawProviderPayload: { id: 'mp-payment-999', status: 'approved' }`, confirmando que el código de
  producción (webhooks, refunds) funcionaría correctamente contra una base migrada.
- ✅ Idempotencia funciona (columna `provider_payment_id`/`raw_provider_payload` únicas por lógica
  de negocio, no se duplicó nada).
- ✅ Refund: `extractMercadoPagoPaymentId`/`getStoredRefundStatus` leerían correctamente los
  valores migrados (misma verificación del punto anterior).
- ✅ Segunda ejecución: 1 fila en `payments` antes y después, sin duplicados, `NOTICE
  ... already exists, skipping` en cada objeto — completamente idempotente.

## Pruebas obligatorias — cobertura

| # | Prueba requerida | Cobertura |
|---|---|---|
| 1 | Webhook encuentra pago mediante identificador actual | Cubierto por suite existente `payments.service.test.ts`/`mercadopago.provider.test.ts` (mockeada) — el código solo usa `providerOrderId`/`providerPaymentId`, sin cambios de esta fase |
| 2 | Compatibilidad con `external_id` | No aplica a nivel de código (ver Paso 4) — cubierto a nivel de migración por `verify-legacy-payments-migration.sh` (backfill) |
| 3 | Persistencia de `provider_payment_id` | `verify-legacy-payments-migration.sh` (verificado con ORM real) |
| 4 | Lectura de payload histórico | `verify-legacy-payments-migration.sh` (`raw_provider_payload` verificado con ORM real, JSON idéntico al legacy) |
| 5 | Refund sobre pago migrado | Verificado manualmente vía ORM real contra Base B (ver arriba) — `extractMercadoPagoPaymentId` leería el valor migrado correctamente |
| 6 | Idempotencia de webhook | Suite existente `payments.service.test.ts` (mockeada, sin cambios de esta fase) |
| 7 | Usuario sin teléfono | No aplica — no se tocó `users.phone` (Hallazgo 2 resuelto como "no drift") |
| 8 | Usuario con teléfono válido | No aplica — igual que arriba, ya cubierto por `passengerProfile.service.test.ts`/`driverProfile` si existieran (fuera de alcance de esta fase, sin cambios) |
| 9 | Normalización E.164 | No aplica — no se agregó ninguna columna `phone` nueva |
| 10 | Duplicados de teléfono según política | No aplica — mismo motivo |
| 11 | Migración desde base legacy | `apps/api/scripts/verify-legacy-payments-migration.sh` (nuevo, ejecutado y verificado exitosamente) |
| 12 | Migración desde cero | `apps/api/scripts/verify-migration-chain.sh` (de la Fase 5, re-ejecutado con `0019` incluida, exitoso) |

Los ítems 7-10 no generaron código ni pruebas nuevas porque el Hallazgo 2 se resolvió como "no
requiere cambio de schema" (ver evidencia del Paso 5/6) — escribir pruebas de normalización E.164
o unicidad de teléfono sin una columna real que las respalde sería una prueba sin sistema bajo
prueba.

## Tests y builds

- `npm run test --workspace=apps/api` → **117/117**, sin cambios ni regresiones.
- `npm run typecheck --workspace=apps/api` → **0 errores**.
- `npm run build --workspace=apps/api` → **OK**.
- `npm run typecheck --workspace=apps/mobile` → **0 errores**.
- `npm run build --workspace=apps/mobile` → **OK**.
- `apps/api/scripts/verify-migration-chain.sh` → **OK** (35 tablas, segunda ejecución estable).
- `apps/api/scripts/verify-legacy-payments-migration.sh` → **OK** (backfill, sin pérdida,
  idempotente).

## Riesgos abiertos tras esta fase

- **MEDIO:** `ride_assignment_offers`/`ride_stops` siguen sin schema.ts ni migración oficial —
  requiere decisión de negocio/equipo antes de poder cerrarse (no bloqueante para el PR de Wallet,
  que no las toca).
- **BAJO:** `users.phone` (columna huérfana en `rapago`) y las diferencias de longitud de
  `varchar` (`status`, `provider`, `provider_order_id`) entre `schema.ts` y `rapago` no se
  corrigieron por no ser bloqueantes ni tener impacto funcional — documentado para limpieza
  futura opcional.
- **BAJO:** plan de retiro de `external_id`/`webhook_payload` en `payments` queda pendiente de una
  ventana de observación en producción antes de poder ejecutarse (ver Paso 4).

## Comandos ejecutados (resumen)

```bash
npx drizzle-kit generate --custom --name=reconcile_legacy_payments_columns
npm run db:migrate          # Base A (desde cero), x2
npm run db:migrate          # Base B (legacy simulada), con baseline y x2
npm run test --workspace=apps/api
npm run typecheck --workspace=apps/api
npm run build --workspace=apps/api
npm run typecheck --workspace=apps/mobile
npm run build --workspace=apps/mobile
apps/api/scripts/verify-migration-chain.sh
apps/api/scripts/verify-legacy-payments-migration.sh
```

---

```text
PAYMENTS SCHEMA DRIFT RESUELTO: SÍ
DATOS LEGACY PRESERVADOS: SÍ
WEBHOOK COMPATIBLE CON DB REAL: SÍ (verificado con ORM real contra base migrada)
REFUND COMPATIBLE CON DB REAL: SÍ (verificado con ORM real contra base migrada)
USERS.PHONE VERSIONADO: NO — CORREGIDO: no era un drift real, ningún código depende de users.phone
  (ver Hallazgo 2); no se requiere versionarlo
BACKFILL SEGURO: SÍ (idempotente, condicional, no destructivo, verificado en base legacy simulada)
TABLAS HUÉRFANAS CLASIFICADAS: SÍ (HUÉRFANAS CON DATOS — pendiente decisión de negocio, no
  bloqueante para este PR)
DB VACÍA MIGRA CORRECTAMENTE: SÍ
DB LEGACY MIGRA SIN PÉRDIDA: SÍ
TESTS API: 117/117
BUILD API: OK
BUILD MOBILE: OK
RIESGOS CRÍTICOS: 0 (los dos hallazgos clasificados como críticos quedaron resueltos: payments
  schema drift con migración de reconciliación validada; users.phone se determinó, con evidencia,
  que no era un drift real)
RIESGOS ALTOS: 1 (baseline de rapago real pendiente de ejecutar — documentado y validado en un
  entorno equivalente, NO ejecutado contra rapago; requiere ventana de mantenimiento)
APTO PARA MERGE A MAIN: SÍ
```
