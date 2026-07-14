# FASE 4B — Diseño ampliado del ledger (créditos + débitos) y plan de implementación backend

**Estado: DISEÑO PENDIENTE DE APROBACIÓN. No se ha escrito ni modificado código en este
documento — es la entrega solicitada antes de tocar frontend o backend.**

Referencia: política aprobada en `LEANDRO_PHASE_4B_CANCELLATION_POLICY_PROPOSAL.md`. Este
documento traduce esa política a un diseño técnico concreto.

---

## 1. Por qué el ledger de Fase 4 no alcanza

`wallet_transactions_ledger` (creado en Fase 4, migración `0028`, **nunca aplicada a ninguna
base de datos real**) fue diseñado para créditos a favor del pasajero:
`type ∈ {credit, debit, refund, adjustment, reversal}` y
`status ∈ {pending, available, applied, rejected, expired, reversed}` — pero el flujo de
`debit` nunca se implementó (ni servicio, ni endpoint), y `available` tiene semántica exclusiva
de crédito. Reutilizarlo tal cual para no-show/cargos violaría tu regla explícita: **"No
reutilices `available` para una deuda pendiente."**

## 2. Esquema ampliado (diseño, no implementado)

### 2.1 Tipos y estados

```text
type:
  credit      — a favor del pasajero, aplicable a un viaje futuro
  debit       — obligación/cargo pendiente EN CONTRA del pasajero (no-show, cancelación tardía sin cobertura)
  refund      — dinero devuelto al medio de pago original (evento ya ejecutado, no es saldo futuro)
  payment     — referencia de un cobro ya capturado (fila espejo para reconciliación contable unificada)
  adjustment  — corrección administrativa manual (aumenta o disminuye saldo/deuda)
  reversal    — anula el efecto de un movimiento anterior (nunca edita, siempre crea una fila nueva)

status (semántica DEPENDE del type — nunca se mezclan):
  pending    — credit: propuesto, sin aprobar · debit: obligación registrada, sin cobrar
  available  — SOLO credit: aprobado, listo para aplicarse (NUNCA se usa para debit)
  applied    — SOLO credit: ya se usó como descuento en un viaje
  paid       — debit: cobrado/saldado · refund: reembolso ejecutado en el proveedor ·
               payment: cobro capturado (fila de referencia)
  rejected   — credit o debit: rechazado por un admin, no genera obligación ni beneficio
  expired    — SOLO credit: venció sin usarse (90 días)
  reversed   — cualquier type: fue anulado por un movimiento `type=reversal` posterior
  cancelled  — debit: la obligación fue condonada/cancelada (p. ej. el pasajero disputó
               exitosamente un no-show) sin llegar a cobrarse ni revertirse un cobro ya hecho
```

Matriz de transiciones válidas (lo único que el servicio permite, todo lo demás se rechaza con
`WALLET_TX_INVALID_TRANSITION`, igual que en Fase 4):

```text
credit:  pending → available → applied
         pending → rejected
         available → expired
         (available|applied) → reversed   [vía nueva fila type=reversal]

debit:   pending → paid
         pending → cancelled
         pending → rejected
         paid → reversed                  [vía nueva fila type=reversal — p. ej. disputa ganada
                                            después de cobrado]

refund:  pending → paid
         pending → rejected

payment: (creado directamente en paid, es una fila de referencia/espejo, no transiciona)

adjustment: pending → applied (si es a favor) | pending → paid (si es en contra)

reversal: se crea directamente, sin transiciones propias — es un movimiento terminal
```

### 2.2 Columnas nuevas (sobre la tabla ya diseñada en Fase 4)

```text
policyVersion            TEXT NOT NULL          -- ej. "2026-07-13-v1", trazabilidad de qué
                                                 -- versión de la política generó el movimiento
actorRole                TEXT NOT NULL          -- 'system' | 'admin' | 'driver' | 'passenger'
                                                 -- snapshot del rol de quien originó el movimiento
collectionMethod         TEXT                   -- SOLO para debit: 'next_ride' | 'independent_payment'
                                                 -- | 'provider_retry' | 'admin_review' | NULL mientras
                                                 -- no haya flujo de cobro aprobado (ver §5)
reversalOfTransactionId  UUID REFERENCES wallet_transactions_ledger(id)  -- SOLO type=reversal,
                                                 -- reemplaza el uso ad-hoc de metadata que se hizo
                                                 -- en Fase 4, por una FK real y consultable
settlesTransactionId     UUID REFERENCES wallet_transactions_ledger(id)  -- SOLO cuando una fila
                                                 -- 'paid' salda una obligación 'pending' anterior
                                                 -- (liga el cargo original con su cobro)
paidAt                   TIMESTAMPTZ            -- cuándo se marcó paid (debit/refund/payment)
cancelledAt              TIMESTAMPTZ            -- cuándo se marcó cancelled (debit condonado)
```

Columnas ya existentes en Fase 4 que se reutilizan sin cambios: `id, walletId, userId, rideId,
paymentId, appliedToRideId, amountClp, currency, idempotencyKey, createdBy, approvedBy, createdAt,
approvedAt, appliedAt, expiresAt, reversedAt, metadata`. `status`/`approvalStatus` mantienen su
tipo `text` (sin `CHECK` a nivel SQL, igual que `status` en `payments`/`wallets`/`payment_orders`
— consistente con la convención ya usada en todo el codebase de validar enums en Zod/servicio, no
en la base de datos, salvo el `CHECK (amount_clp > 0)` que ya existe y se mantiene).

### 2.3 Separación de montos (regla: "el saldo no debe ser un número modificable")

Todo se deriva del ledger, vía una función `getWalletBalanceSummary(userId)` (nueva, reemplaza a
`getAvailableBalance` de Fase 4):

```text
availableCreditClp  = SUM(amountClp) WHERE type='credit'  AND status='available'
pendingCreditClp    = SUM(amountClp) WHERE type='credit'  AND status='pending'
pendingDebitClp     = SUM(amountClp) WHERE type='debit'   AND status='pending'
paidAmountClp       = SUM(amountClp) WHERE type IN ('debit','payment') AND status='paid'
refundedAmountClp   = SUM(amountClp) WHERE type='refund'  AND status='paid'
reversedAmountClp   = SUM(amountClp) WHERE status='reversed'
```

Ningún endpoint escribe directamente estos totales — son siempre una proyección calculada en el
momento de la consulta (`SELECT SUM... GROUP BY type, status`), igual que ya se hizo con
`getAvailableBalance` en Fase 4.

## 3. Migración de base de datos necesaria

**Recomendación: editar el archivo `0028_wallet_transactions_ledger.sql` directamente (en vez de
crear un `0029_alter_...sql`)**, porque esa migración **nunca se aplicó a ninguna base de datos**
(confirmado en Fase 4 — no se ejecutó `drizzle-kit migrate`). No existe ningún ambiente real con
la tabla vieja que proteger; agregar un `ALTER TABLE` posterior sería una complejidad innecesaria
para una tabla que técnicamente no existe todavía en ningún entorno. Alternativa si prefieres
mantener el historial de migraciones incremental de todos modos: crear `0029` con los `ALTER
TABLE ADD COLUMN`. **Pendiente de tu decisión** — lo indico como punto abierto, no asumo.

En cualquiera de los dos casos, la migración sigue **sin aplicarse** hasta que apruebes también
el paso de ejecutarla contra un ambiente real (regla "no modificar producción").

## 4. Endpoints necesarios (nuevos o modificados)

```text
YA EXISTEN (Fase 4, sin cambios de contrato):
  GET  /wallets/me/credits                        → se recomienda RENOMBRAR a
                                                      GET /wallets/me/ledger?type=&status=
                                                      (más genérico, cubre créditos y débitos;
                                                      mantener /wallets/me/credits como alias
                                                      de compatibilidad si se prefiere)
  POST /wallets/apply-credit                       (sin cambios)
  POST /admin/wallet-transactions                  → ampliar el Zod DTO para aceptar
                                                      type=debit además de type=credit
  POST /admin/wallet-transactions/:id/approve      (sin cambios de contrato, aplica a debit
                                                      también si se decide requerir aprobación)
  POST /admin/wallet-transactions/:id/reject       (sin cambios de contrato)

NUEVOS:
  POST /admin/wallet-transactions/:id/mark-paid    → marca un debit pending como paid,
                                                      requiere admin, collectionMethod='admin_review'
  POST /admin/wallet-transactions/:id/cancel       → condona un debit pending (disputa ganada),
                                                      requiere admin + motivo obligatorio
  POST /admin/wallet-transactions/:id/reverse      → crea una fila type=reversal vinculada vía
                                                      reversalOfTransactionId, requiere admin
                                                      distinto al que aprobó/pagó originalmente
                                                      (misma regla de imposibilidad de autoaprobar)

NO ES UN ENDPOINT HTTP NUEVO (llamada de servicio interna):
  WalletTransactionsService.createNoShowDebit(...) — invocada desde el flujo existente de
    confirmación de no-show (hoy en apps/mobile/driver, debe moverse a un endpoint backend de
    no-show que hoy NO EXISTE — ver riesgo abierto #1 más abajo). Crea una fila type=debit,
    status=pending, source=no_show, collectionMethod=NULL (bloqueado hasta §5).
```

## 5. Tratamiento de cargos pendientes (cobro)

Por tu regla explícita — *"si todavía no existe una decisión válida para cobro automático,
registra el débito como pending y bloquea su uso financiero hasta contar con un flujo
aprobado"* — **no se implementa ningún cobro automático en esta fase**. Se define así:

```text
collectionMethod = NULL  hasta que se apruebe explícitamente uno de:
  'next_ride'          — deducir del próximo pago exitoso del pasajero (requiere diseño de
                          consentimiento/disclosure explícito antes de cobrar, no cubierto aún)
  'independent_payment' — generar una nueva orden de pago independiente que el pasajero debe
                          aceptar/pagar voluntariamente (más simple de aprobar, no requiere
                          tocar el flujo de creación de viajes)
  'provider_retry'      — reintento automático vía el proveedor (requiere confirmar soporte de
                          "cobro fuera de sesión" en MercadoPago/ProntoPaga — EVIDENCIA
                          INSUFICIENTE, no verificado)
  'admin_review'        — el único método DISPONIBLE hoy: un admin revisa caso a caso y decide
                          (marca paid manualmente, o cancela la deuda)
```

Mientras no se apruebe uno de los tres primeros métodos, todo `debit` creado queda en
`status=pending`, visible para el pasajero (transparencia) pero **sin ningún mecanismo
automático que intente cobrarlo** — solo `admin_review` vía los endpoints `mark-paid`/`cancel`
de arriba.

## 6. Plan de pruebas (créditos y débitos)

Extender `walletTransactions.service.test.ts` y `walletTransactions.repository.test.ts` con:

```text
- Crear debit (no-show) → status=pending, collectionMethod=NULL
- Admin marca debit como paid → status=paid, paidAt seteado, requiere rol admin
- Admin cancela (condona) un debit pending → status=cancelled, motivo obligatorio
- Un debit NO puede transicionar directamente a 'available' (test negativo explícito,
  documenta la regla "no reutilizar available para deuda")
- getWalletBalanceSummary separa correctamente: availableCreditClp, pendingCreditClp,
  pendingDebitClp, paidAmountClp, refundedAmountClp, reversedAmountClp — con fixtures que
  mezclan varios types/status para confirmar que no se cruzan entre sí
- Reversal de un credit ya applied → nueva fila type=reversal con reversalOfTransactionId,
  el crédito original NO se edita (se verifica que su fila permanece histórica sin cambios)
- Reversal de un debit ya paid → idem, para el caso de disputa ganada después de cobrado
- Imposibilidad de autoaprobar también aplica a mark-paid/cancel/reverse (mismo actor no puede
  crear y resolver su propio movimiento)
- Idempotencia de creación de debit por no-show (mismo rideId + evento no genera dos cargos)
```

## 7. Confirmación: no-show NO depende de localStorage

Una vez implementado este diseño, el cálculo y almacenamiento del cargo por no-show deja de
vivir en `RAPAGO_PASSENGER_PENDING_CHARGES_KEY` (localStorage, `driver/index.tsx`) y pasa a ser
una fila `type=debit` en `wallet_transactions_ledger`, creada por una llamada de servicio
backend. **Esto todavía no está implementado** — requiere además mover la lógica de "5 minutos de
espera + monto de no-show" desde `getDriverNoShowState`/`saveDriverNoShowChargeForPassenger`
(hoy 100% cliente) a un endpoint backend nuevo, que hoy no existe. Lo marco como **riesgo abierto
#1** porque es un prerequisito real para cerrar completamente el hallazgo de no-show identificado
en Fase 2A/2B, y no estaba explícitamente pedido como endpoint en tu mensaje — indícame si quieres
que lo incluya en el plan de implementación o si prefieres tratarlo como una fase separada.

## Riesgos abiertos

1. **No existe todavía un endpoint backend de no-show** — el cálculo sigue en el cliente
   (`driver/index.tsx`) hasta que se diseñe/apruebe uno. Sin esto, `createNoShowDebit` no tiene
   quién lo invoque de forma autoritativa.
2. Soporte de refund parcial en ProntoPaga no verificado (afecta la regla B — 70% reembolso).
3. Ningún método de cobro automático (`next_ride`/`independent_payment`/`provider_retry`) está
   aprobado — todo debit queda en revisión manual hasta nueva decisión.
4. Decisión pendiente: ¿editar `0028` in-place o crear `0029`? (§3).
5. `GET /wallets/me/credits` vs `/wallets/me/ledger` — renombrar rompe compatibilidad si algo ya
   lo consume (hoy nada lo consume porque el frontend no fue migrado, así que el riesgo es bajo,
   pero lo señalo).

---

```text
POLÍTICA APROBADA INCORPORADA: SÍ
VENTANA ÚNICA DE 30 MINUTOS: SÍ (diseño); pendiente de aplicar en backend, frontend, textos
  legales y panel admin cuando se implemente
LEDGER SOPORTA CRÉDITOS: SÍ (ya implementado en Fase 4)
LEDGER SOPORTA DÉBITOS: DISEÑADO, NO IMPLEMENTADO — este documento es el diseño, pendiente de tu
  aprobación para escribir el código
NO-SHOW DEPENDE DE LOCALSTORAGE: SÍ, TODAVÍA — el diseño lo resuelve pero no está implementado
  (riesgo abierto #1)
MIGRACIÓN NECESARIA: SÍ — ampliar wallet_transactions_ledger con policyVersion, actorRole,
  collectionMethod, reversalOfTransactionId, settlesTransactionId, paidAt, cancelledAt (editar
  0028 in-place o crear 0029, pendiente de tu decisión). Ninguna migración aplicada aún.
ENDPOINTS NECESARIOS: 3 nuevos (mark-paid, cancel, reverse) + ampliar el DTO de
  POST /admin/wallet-transactions para aceptar type=debit + evaluar renombrar
  GET /wallets/me/credits a /wallets/me/ledger
RIESGOS ABIERTOS: 5 (ver sección arriba) — el más importante es la falta de un endpoint backend
  de no-show, sin el cual R8/R-no-show no puede activarse de forma autoritativa
APTO PARA INICIAR IMPLEMENTACIÓN BACKEND: NO TODAVÍA — falta tu aprobación de este diseño y
  resolución de los puntos abiertos §3 (in-place vs 0029) y riesgo #1 (endpoint de no-show)
```
