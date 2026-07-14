# FASE 4B (backend) — Ledger de débitos + no-show autoritativo

Rama: `security/remediation-leandro-wallet`. Implementa el diseño aprobado en
`LEANDRO_PHASE_4B_LEDGER_DESIGN_AND_PLAN.md`, sobre la política aprobada en
`LEANDRO_PHASE_4B_CANCELLATION_POLICY_PROPOSAL.md`. **No se modificó ningún archivo de
`apps/mobile` en esta fase** (confirmado: `git status --short | grep apps/mobile` → vacío).

## 1. Confirmación: `0028` era segura para editar in-place

```text
0028 fue modificada antes de su primera aplicación.
No existen bases de datos que dependan de la versión anterior.
```

Evidencia verificada antes de editar: sin entrada en `meta/_journal.json` (se detiene en
`0016`), sin migraciones `0029+` que dependieran de su estructura, el commit que la creó
(`5de9d50`) solo existe en la rama local `security/remediation-leandro-wallet`, y toda la rama
está sin pushear a `origin`. Se editó `0028_wallet_transactions_ledger.sql` y
`walletTransactions.schema.ts` in-place, sin crear `0029`. **La migración sigue sin aplicarse a
ninguna base de datos real** — eso requiere una decisión y ejecución separadas.

## 2. Ledger extendido — créditos y débitos

Columnas nuevas en `wallet_transactions_ledger`: `policy_version`, `actor_role`,
`collection_method`, `reversal_of_transaction_id`, `settles_transaction_id`, `paid_at`,
`cancelled_at`. `type` ahora incluye `payment`; `status` ahora incluye `paid` y `cancelled`.

**Regla "no reutilizar `available` para deuda" implementada y probada**: `markDebitPaid` y
`cancelDebit` solo transicionan filas `WHERE type='debit' AND status='pending'` — nunca leen ni
escriben `status='available'` para un débito. Test explícito:
*"no reutiliza 'available' para un débito"* en `walletTransactions.service.test.ts`.

**Nota de diseño resuelta durante la implementación**: la fila de "consumo de crédito" que ya
existía en Fase 4 (creada al aplicar un crédito) usaba `type: "debit"` — esto colisionaba con la
nueva semántica de `debit` = "obligación del pasajero". Se corrigió a `type: "credit"` (con
`settlesTransactionId` apuntando al crédito original) y se renombró el campo de retorno de
`debit` a `consumptionRecord` en el repositorio y el servicio, para no mezclar dos conceptos bajo
el mismo nombre.

Saldo separado (`getWalletBalanceSummary`, expuesto en `GET /wallets/me/credits`):
`availableCreditClp`, `pendingCreditClp`, `pendingDebitClp`, `paidAmountClp`,
`refundedAmountClp`, `reversedAmountClp` — cada uno una proyección `SUM()` independiente, nunca
un número almacenado.

## 3. Endpoint backend de no-show (`POST /rides/:id/no-show`)

Nuevo módulo separado: `apps/api/src/modules/rides/noShow.{service,schemas,controller}.ts`,
registrado en `rides.routes.ts` (no se mezcló con `ridesController` existente).

Validaciones implementadas, en orden:

```text
✅ usuario autenticado           (authenticate() — JWT + sesión válida)
✅ rol conductor                 (auth.role !== "driver" → 403)
✅ conductor asignado al viaje   (ride.driverUserId !== auth.userId → 403)
✅ estado actual válido          (ride.status !== "driver_arrived" → 409)
✅ llegada previa registrada     (!ride.arrivedAt → 409)
✅ tiempo mínimo de espera       (5 min, Date.now() - arrivedAt < 5min → 409)
✅ viaje no cancelado previamente (implícito: cancelNoShow solo transiciona desde driver_arrived,
                                    un viaje ya cancelado no puede estar en ese estado)
✅ no-show no registrado antes   (idempotencyKey determinista `no_show:{rideId}`, UNIQUE en DB)
✅ idempotencia                  (findByIdempotencyKey antes de crear; replay devuelve el mismo debit)
✅ transición de estado válida   (ridesRepo.cancelNoShow: UPDATE atómico WHERE status='driver_arrived'
                                    AND driver_user_id=$driverId — prevención de doble cargo a nivel DB)
✅ monto calculado en servidor   (amountClp = ride.estimatedFareClp, nunca del request)
✅ versión de política           (policyVersion: CURRENT_LEDGER_POLICY_VERSION)
✅ creación atómica del débito   (ledgerRepo.create — inserción única, ver residual #1 más abajo)
✅ auditoría actor/fecha/motivo  (createdBy=driverId, createdAt automático, metadata.driverNotes)
✅ prevención doble cargo        (idempotencyKey UNIQUE + UPDATE condicional del ride)
✅ notificación al pasajero      (notifyAsync, fire-and-forget, no bloquea la respuesta)
```

**Campos que el cliente NUNCA envía como autoritativos** (confirmado con test que envía un
payload forjado con todos estos campos y verifica que `confirmNoShowSchema.parse()` los
descarta): `noShowFee`, `amount`, `percentage`, `minimumFare`, `waitingMinutes`, `walletDebit`.
El único campo aceptado es `notes` (string opcional, máx. 500 caracteres, evidencia descriptiva).

**Regla de seguridad respetada**: el débito nace `status=pending`. Ningún cobro real se ejecuta
en esta fase — `collectionMethod` queda `null` hasta que un admin lo mueva a `paid` vía
`mark-paid` (único método habilitado: `admin_review`).

## 4. Endpoints `mark-paid`, `cancel`, `reverse`

```text
POST /admin/wallet-transactions/:id/mark-paid   (debit pending → paid, requiere admin)
POST /admin/wallet-transactions/:id/cancel      (debit pending → cancelled, motivo obligatorio)
POST /admin/wallet-transactions/:id/reverse     (cualquier estado resuelto → reversed + nueva
                                                   fila type=reversal; imposibilidad de
                                                   autoaprobar extendida: ni el creador NI el
                                                   admin que aprobó/pagó puede revertir)
```

## 5. Pruebas (Paso 7 del plan)

```text
apps/api/src/modules/rides/__tests__/noShow.service.test.ts       8 pruebas (nuevo)
apps/api/src/modules/wallet/__tests__/walletTransactions.service.test.ts  +12 pruebas (27 total)
apps/api/src/modules/wallet/__tests__/walletTransactions.repository.test.ts +3 pruebas (6 total)
```

Cubren explícitamente lo pedido: rol/ownership del conductor, estado del viaje, tiempo de espera,
manipulación de monto (payload forjado con los 6 campos financieros prohibidos), idempotencia
(no-show y aplicación de crédito), doble cargo bloqueado (mark-paid solo desde pending),
imposibilidad de autoaprobar (creador Y aprobador no pueden revertir), no reutilización de
`available` para deuda, separación de los 6 totales de saldo, y atomicidad/rollback tanto de
`applyAvailableCredit` como de `reverseTransaction` (con mocks de `db.transaction`).

**Concurrencia real (dos requests simultáneas)**: no se puede probar de verdad sin una base de
datos real corriendo — los tests unitarios con mocks demuestran la *lógica* (el UPDATE
condicional retorna 0 filas si el estado ya cambió), pero la garantía de atomicidad real depende
de Postgres, no de este código. Marcar como **EVIDENCIA INSUFICIENTE para concurrencia real**,
recomendándose una prueba de integración contra una base de datos de prueba antes de producción.

```text
Suite completa del API: 94/96 (mismos 2 fallos preexistentes de payments.service.test.ts /
  mercadopago.provider.test.ts, sin regresiones)
Typecheck: 31 errores TS4111 preexistentes, ninguno nuevo
Build: mismo resultado preexistente
```

## 6. Archivos modificados/nuevos

```text
apps/api/src/db/migrations/0028_wallet_transactions_ledger.sql   (editado in-place)
apps/api/src/db/schema/walletTransactions.schema.ts              (editado in-place)
apps/api/src/modules/wallet/walletPolicy.constants.ts             (nuevo)
apps/api/src/modules/wallet/walletTransactions.{repository,service,controller,routes,schemas}.ts (extendidos)
apps/api/src/modules/rides/rides.repository.ts                    (+ cancelNoShow)
apps/api/src/modules/rides/rides.routes.ts                        (+ ruta no-show)
apps/api/src/modules/rides/noShow.{service,schemas,controller}.ts (nuevos)
apps/api/src/modules/wallet/__tests__/walletTransactions.{service,repository}.test.ts (extendidos)
apps/api/src/modules/rides/__tests__/noShow.service.test.ts       (nuevo)
docs/security/LEANDRO_PHASE_4B_*.md                                (política, diseño, este informe)
```

Ningún archivo de `apps/mobile`, `package.json`, `package-lock.json`, `.env`, ni proveedores de
pago fue tocado.

## Riesgos residuales

1. **Sin `db.transaction` envolviendo la creación del débito de no-show + cancelación del
   ride** — son dos operaciones secuenciales sobre tablas distintas (`wallet_transactions_ledger`
   y `ride_requests`). Se ordenaron deliberadamente (débito primero, cancelación después) para
   que un fallo en la cancelación del ride nunca deje un cargo sin registrar; pero si el ride no
   logra cancelarse tras crear el débito, queda en un estado transitorio inconsistente
   (débito registrado, ride técnicamente aún `driver_arrived`) que requeriría un job de
   reconciliación o reintento manual — no implementado en esta fase.
2. Migración `0028` extendida sigue sin aplicarse a ninguna base de datos.
3. Ningún método de cobro automático aprobado — todo débito queda `pending` hasta revisión admin.
4. Concurrencia real no probada contra una base de datos viva (solo mocks).
5. `GET /wallets/me/ledger` (renombre recomendado en el diseño) no se implementó — se mantuvo
   `GET /wallets/me/credits` para no romper nada que ya lo consumiera (aunque hoy nada lo
   consume, dado que el frontend no está migrado).

---

```text
MIGRACIÓN 0028 SEGURA PARA EDITAR: SÍ
LEDGER SOPORTA DÉBITOS: SÍ
ENDPOINT NO-SHOW AUTORITATIVO: SÍ
MONTO CONTROLADO POR CLIENTE: NO
DOBLE CARGO BLOQUEADO: SÍ
IDEMPOTENCIA PROBADA: SÍ
NO-SHOW EN LOCALSTORAGE: todavía puede existir visualmente en el cliente (no se tocó
  apps/mobile), pero ya no tiene autoridad financiera una vez que el frontend consuma este
  endpoint — la migración de frontend (que conecta la UI a este endpoint) sigue pendiente
COBROS REALES EJECUTADOS: NO
RIESGOS CRÍTICOS BACKEND ABIERTOS: 0
APTO PARA INICIAR FASE 4B FRONTEND: SÍ
```

No se hizo push ni merge.
