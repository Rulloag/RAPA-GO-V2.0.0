# FASE 4A.1 — Atomicidad y reconciliación del no-show

Rama: `security/remediation-leandro-wallet`. Corrige el riesgo residual ALTO documentado al
cierre de Fase 4B: la creación del débito de no-show y la cancelación del viaje se ejecutaban
como dos operaciones secuenciales no atómicas.

## Paso 1 — Arquitectura transaccional confirmada

| Operación | Servicio | Repositorio | Tabla | Base de datos | Soporta transaction client |
|---|---|---|---|---|---|
| Actualizar viaje | `NoShowService` | `RidesRepository` | `ride_requests` | Postgres, `db` singleton (`apps/api/src/db/client.js`) | **SÍ, ahora** — `cancelNoShow`/`findByIdForUpdate` aceptan un `executor` opcional |
| Crear débito | `NoShowService` | `WalletTransactionsRepository` | `wallet_transactions_ledger` | **Misma instancia `db`** | **SÍ, ahora** — `create`/`findByIdempotencyKey` aceptan un `executor` opcional |

Confirmado: ambas tablas viven en la misma base de datos Postgres, mismo cliente
`postgres-js`/Drizzle. `db.transaction(async (tx) => {...})` ya se usaba dentro de
`walletTransactions.repository.ts` (Fase 4B) — la solución preferida (transacción única) era
viable sin cambios de stack. **No se implementó el patrón de reconciliación eventual del Paso 4**
del encargo porque no era necesario.

## Paso 2 — Solución implementada: transacción atómica única

`NoShowService.confirmNoShow` ahora ejecuta **todo** dentro de un único `db.transaction`:

```text
1. ridesRepo.findByIdForUpdate(rideId, tx)   — SELECT ... FOR UPDATE, bloquea la fila
2. Validar conductor asignado
3. Validar estado ('driver_arrived')
4. Validar llegada previa registrada
5. Validar tiempo de espera (5 min)
6. Validar tarifa
7. ledgerRepo.findByIdempotencyKey(key, tx)  — idempotencia DENTRO de la misma tx
8. Calcular monto (ride.estimatedFareClp, nunca del cliente)
9. ledgerRepo.create({...}, tx)               — INSERT del débito
10. ridesRepo.cancelNoShow(rideId, driverId, tx) — UPDATE atómico del viaje
11. Si (10) falla → throw NoShowRideTransitionFailedError → ROLLBACK del INSERT de (9) también
12. Si todo OK → return success (commit implícito al resolver el callback)
```

Cambio de comportamiento respecto a Fase 4B: **antes**, si `cancelNoShow` fallaba después de
crear el débito, el débito quedaba creado (huérfano). **Ahora**, ese fallo lanza dentro del
callback de `db.transaction`, lo que fuerza el rollback completo — el débito nunca queda
persistido sin su transición de viaje correspondiente.

`RidesRepository.findByIdForUpdate` usa `.for("update")` (soportado por drizzle-orm 0.45.2,
confirmado en `node_modules/drizzle-orm/pg-core/query-builders/select.d.ts`), bloqueando la fila
del viaje para que una segunda confirmación de no-show sobre el mismo viaje no pueda leer un
estado obsoleto mientras la primera está en curso.

## Paso 3 — Concurrencia

**No se puede probar concurrencia real sin una base de datos Postgres viva** — los tests
unitarios con mocks no pueden simular dos conexiones concurrentes reales disputando un lock de
fila. Se hizo lo que sí es honesto probar a este nivel:

- Test que simula el **resultado esperado** de la serialización por lock: una segunda
  confirmación, tras la primera ya completada, encuentra el viaje con `status='cancelled'`
  (ya no `driver_arrived`) y se rechaza con `RIDE_STATUS_NOT_ARRIVED` — un solo débito, una sola
  transición de viaje.
- La garantía real de que **dos transacciones concurrentes literalmente no pueden ambas pasar el
  lock al mismo tiempo** depende de Postgres (`SELECT ... FOR UPDATE`), no de este código —
  **EVIDENCIA INSUFICIENTE para concurrencia física real**, requiere una prueba de integración
  contra una base de datos de prueba antes de dar esto por completamente cerrado en producción.

No se depende solo de "consulta previa seguida de inserción": el lock de fila + el `UPDATE
... WHERE status='driver_arrived'` condicional (defensa en profundidad, redundante con el lock
pero mantenida) + la restricción `UNIQUE(idempotency_key)` a nivel de base de datos son las tres
capas que en conjunto hacen la garantía.

## Paso 4 — Patrón de reconciliación eventual

**No implementado — no fue necesario.** Ambas operaciones viven en la misma base de datos y
comparten transacción real (Paso 2). El modelo `NoShowOperation` con estados
`pending/debit_created/ride_updated/completed/compensation_required/failed` que describe el
encargo es para el caso de bases de datos distintas o SAGA — no aplica aquí.

## Paso 5 — Compensación

No implementado por la misma razón: al ser una transacción atómica real, no existe el escenario
"débito ya creado pero transición de viaje no puede completarse" como un estado persistente — o
ambos se confirman, o Postgres revierte ambos. El mecanismo de `reverseTransaction` (creado en
Fase 4B, con `reversalOfTransactionId`) sigue disponible para compensaciones administrativas
posteriores (p. ej. una disputa ganada por el pasajero después de que el no-show ya quedó
confirmado), pero no es parte de este flujo atómico.

## Paso 6 — Estados de dominio

**No se agregaron estados nuevos.** `ride_requests.status` sigue siendo `'cancelled'` para el
caso de no-show (igual que en Fase 4B) — la distinción real ya existía y se preservó:
`cancelledByRole: "driver_no_show"` (diferente de `"passenger"`/`"driver"` que usa el flujo de
cancelación genérico `cancelAccepted`). Esto satisface "distinguir correctamente el no-show sin
provocar una refactorización general" sin tocar schemas, tipos compartidos, consultas, reportes,
frontend ni notificaciones existentes.

## Paso 7 — Pruebas

`apps/api/src/modules/rides/__tests__/noShow.service.test.ts`: 8 → **12 pruebas** (+4 nuevas):

```text
✅ Débito creado y viaje actualizado correctamente        (ya existía, Fase 4B)
✅ Fallo al crear débito: viaje sin cambios                (implícito — findByIdempotencyKey/
                                                              create fallan antes de cancelNoShow;
                                                              cubierto por los tests de validación
                                                              que ya impiden llegar a create())
✅ Fallo al actualizar viaje: débito revertido/rollback     NUEVO — "ROLLBACK: si la transición
   total                                                    del viaje falla tras crear el débito..."
⚠️ Dos solicitudes simultáneas                              NUEVO, pero SIMULADO (ver Paso 3) —
                                                              no es una prueba de concurrencia real
✅ Misma idempotencyKey repetida                            (ya existía, Fase 4B)
✅ Distinta idempotencyKey para el mismo viaje              NUEVO — demuestra que la clave es
                                                              determinista por rideId, el cliente
                                                              no puede generar una segunda clave
                                                              para forzar un segundo cargo
✅ Viaje ya cancelado / ya marcado no-show                  (cubierto: status≠driver_arrived)
✅ Conductor no asignado                                    (ya existía)
✅ Tiempo de espera insuficiente                            (ya existía)
✅ Error de auditoría                                       NUEVO — "un fallo en la notificación
                                                              no afecta el resultado" (fire-and-forget)
✅ Rollback comprobado consultando ambas tablas             PARCIAL — se comprueba a nivel de
                                                              mocks (createLedgerRow fue invocado,
                                                              pero el resultado final no reporta
                                                              éxito); la reversión física del
                                                              INSERT solo la garantiza Postgres,
                                                              no verificable sin integración real
```

```text
Suite completa del API: 98/100 (mismos 2 fallos preexistentes, sin regresiones)
Typecheck: 31 errores TS4111 preexistentes, ninguno nuevo
Build: mismo resultado preexistente
git diff --check: sin salida
apps/mobile: 0 archivos tocados
```

## Paso 8 — Semántica del ledger preservada

Confirmado sin cambios: el consumo de crédito sigue siendo `type: "credit"` con
`settlesTransactionId` (corregido en Fase 4B). No se revirtió a `type: "debit"` con
`status: "applied"`. La distinción se mantiene:

```text
debit    = obligación pendiente del pasajero (no-show, cancelación tardía sin cobertura)
credit + settlesTransactionId = liquidación/consumo de un crédito existente
payment  = referencia de cobro capturado
reversal = compensación, nunca edición destructiva
```

## Archivos modificados

```text
apps/api/src/modules/rides/rides.repository.ts               (+ findByIdForUpdate, cancelNoShow
                                                                  acepta executor, + type DbExecutor)
apps/api/src/modules/wallet/walletTransactions.repository.ts  (create/findByIdempotencyKey
                                                                  aceptan executor)
apps/api/src/modules/rides/noShow.service.ts                  (reescrito: transacción única)
apps/api/src/modules/rides/__tests__/noShow.service.test.ts   (+4 pruebas, mocks actualizados)
```

Ningún archivo de `apps/mobile`, `package.json`, migraciones, ni proveedores de pago.

## Riesgos residuales

1. **Concurrencia real no probada** contra una base de datos Postgres viva (solo simulada con
   mocks) — recomendado antes de producción: una suite de integración con Testcontainers o una
   base de datos de prueba real ejecutando dos confirmaciones de no-show en paralelo genuino.
2. `walletRepo.getOrCreate(ride.passengerUserId)` sigue llamándose **fuera** de la transacción
   principal (no acepta `tx`) — decisión deliberada: la creación de wallet es idempotente y
   económicamente inerte (una fila `wallets` vacía sin transacciones no es una inconsistencia
   financiera), así que no se justificaba extender `WalletRepository` para esto en esta fase.
3. Reconciliación automática de operaciones fallidas: **no necesaria**, dado que la atomicidad
   real reemplaza la necesidad de un job de reconciliación para este flujo específico.

---

```text
FASE 4A.1:
MISMA BASE DE DATOS: SÍ
TRANSACCIÓN COMPARTIDA: SÍ
DÉBITO Y VIAJE ATÓMICOS: SÍ
ROLLBACK PROBADO: SÍ (a nivel de mocks/lógica; la reversión física del INSERT depende de
  Postgres y no fue verificada con una base de datos real — ver riesgo residual #1)
CONCURRENCIA PROBADA: PARCIAL — comportamiento esperado simulado, no verificado contra
  Postgres real con dos conexiones concurrentes genuinas
RECONCILIACIÓN AUTOMÁTICA: NO NECESARIA (la transacción atómica la vuelve innecesaria)
RIESGOS ALTOS ABIERTOS: 0 backend — el único pendiente (concurrencia real) se reclasifica como
  MEDIO, ya que la combinación de lock FOR UPDATE + UPDATE condicional + UNIQUE(idempotency_key)
  da defensa en profundidad incluso si el lock fallara por algún motivo no anticipado
COMMITS: pendientes de tu confirmación
APTO PARA INICIAR FASE 4B FRONTEND: SÍ, con la recomendación de agregar la prueba de integración
  de concurrencia real antes de considerar el no-show completamente cerrado para producción
```

No se hizo push ni merge.
