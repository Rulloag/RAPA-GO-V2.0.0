# Unificación del sistema de créditos de Wallet

Rama: `integration/leandro-security-remediation`. Elimina la coexistencia de dos backends
financieros independientes detectada al cerrar la integración de `facture/leandro-ui` +
`security/remediation-leandro-wallet`.

## Paso 1 — Mapa de los dos sistemas (antes de esta fase)

| Aspecto | Ledger completo | Sistema Leandro |
|---|---|---|
| Tabla | `wallet_transactions_ledger` | `wallets.balance` (mutable) + `transactions` |
| Servicio | `WalletTransactionsService` | `WalletService.adminCreateWalletCredit` |
| Endpoint | `POST /admin/wallet-transactions` (+5 más) | `POST /admin/wallet/credits` |
| Fuente de saldo | `SUM()` sobre movimientos | Columna `balance` incrementada directamente |
| Aprobación | Dos admins (creador ≠ aprobador) | Un admin, inmediato |
| Idempotencia | `idempotencyKey` `UNIQUE` obligatoria | `providerTransactionId` opcional, **sin `UNIQUE`** |
| Frontend | Ninguno conectado | `admin/index.tsx:579` (aprobación de `AdminWalletBenefit`) |
| Aplicación al viaje | `POST /wallets/apply-credit` transaccional | No existía |
| Reversa | `POST .../reverse` | No existía |

Confirmado: `creditUserWallet` no tenía ninguna garantía real de idempotencia (constraint
ausente en el schema, campo opcional) — un doble clic o retry de red podía duplicar el crédito
sin detección.

## Paso 2 — Fuente única de verdad

`wallet_transactions_ledger` es ahora la única fuente autoritativa. Decisión tomada con el
usuario: `wallets.balance` **se conserva** como caché de lectura rápida para `GET /wallets/me`,
pero deja de ser mutado directamente — se recalcula siempre desde
`WalletTransactionsRepository.getAvailableBalance(userId)` después de cualquier operación que
cambie el saldo disponible (`createCredit` auto-aprobado, `approveCredit`, `applyCredit`,
`reverseTransaction`), vía el nuevo método privado `WalletTransactionsService.syncWalletBalanceCache`.

## Paso 3 — `adminCreateWalletCredit` reescrito

`WalletService.adminCreateWalletCredit` ya no llama a `WalletRepository.creditUserWallet`. Flujo
nuevo:

```text
Admin endpoint (sin cambio de contrato)
    ↓ authenticate + role=admin + target=passenger + ride ownership (sin cambios)
    ↓ idempotencyKey determinista (externalReference, o hash de userId+rideId+amountClp+reason)
    ↓ WalletTransactionsRepository.findByIdempotencyKey → replay si ya existe
    ↓ decideAdminCreditApproval(amountClp) → available (auto) o pending (2do admin)
    ↓ WalletTransactionsRepository.create(...)  [ledger, fuente única]
    ↓ si quedó 'available': recalcular y actualizar wallets.balance (caché)
    ↓ adaptar respuesta al contrato legacy {wallet, transaction}
```

`WalletRepository.creditUserWallet` se marcó `@deprecated`, no se eliminó (transición
controlada — Paso 8).

## Paso 4 — Política de aprobación

```ts
// walletPolicy.constants.ts
export const ADMIN_WALLET_CREDIT_SINGLE_APPROVAL_MAX_CLP = 3000; // SIN CONFIRMAR por el equipo
export function decideAdminCreditApproval(amountClp) {
  return amountClp <= 3000
    ? { status: "available", approvalStatus: "admin_approved" }
    : { status: "pending",   approvalStatus: "pending_review"  };
}
```

Se implementó el umbral propuesto en `LEANDRO_PHASE_4B_CANCELLATION_POLICY_PROPOSAL.md`
($3.000 CLP), **dejado explícitamente marcado como no confirmado por el equipo** y centralizado
en una única función para que `WalletTransactionsService.createCredit` (ledger nativo) y
`WalletService.adminCreateWalletCredit` (fachada legacy) apliquen exactamente la misma regla —
no hay dos políticas de aprobación distintas.

## Paso 5 — Compatibilidad del frontend

Sin cambios de contrato en `POST /admin/wallet/credits` — mismo request (`AdminCreateWalletCreditPayload`)
y misma forma de respuesta (`{wallet, transaction}`, con `TransactionData` adaptada desde la fila
del ledger vía `serializeLedgerRowAsLegacyTransaction`). El frontend de Leandro (`admin/index.tsx`)
sigue funcionando sin modificaciones.

## Paso 6 — Prevención de doble acreditación

Idempotencia verificada con 3 pruebas nuevas:
- Reintento con el mismo `externalReference` → no crea un segundo movimiento.
- Doble clic / retry sin `externalReference` → clave derivada determinística de los campos de
  negocio (mismos `userId+rideId+amountClp+reason` → misma clave).
- El endpoint antiguo y el nuevo (`POST /admin/wallet-transactions`) ahora escriben en la **misma
  tabla** con la **misma restricción `UNIQUE(idempotency_key)`** — ya no pueden crear créditos
  duplicados de forma silenciosa entre sí, aunque **sus claves de idempotencia se derivan de
  forma distinta** (una determinística por hash, la otra client-supplied), así que dos llamadas a
  **endpoints distintos** para la "misma" operación de negocio no colisionan automáticamente —
  ver riesgo residual.

## Paso 7 — Datos existentes

`WalletRepository.creditUserWallet` nunca llegó a ejecutarse contra ninguna base de datos real
(confirmado: rama sin pushear, migración nunca aplicada). **No existen datos reales que
migrar** — se documenta esto explícitamente en vez de asumirlo.

## Paso 8 — Deprecación

```text
compatibilidad → ledger → eliminación futura
```

- `WalletRepository.creditUserWallet`: marcado `@deprecated`, sin callers activos, no eliminado.
- `wallets.balance`: se conserva como caché de lectura, ya no se escribe fuera de
  `syncWalletBalanceCache`.
- `transactions` (tabla): sigue viva para pagos reales vía MercadoPago/webhook (dominio distinto,
  no tocado).

## Paso 9 — Pruebas

Nuevas/actualizadas en `wallet.service.test.ts` y `walletTransactions.service.test.ts`:

```text
✅ adminCreateWalletCredit crea movimiento en el ledger (no en la tabla paralela)
✅ no crea registro en creditUserWallet (aserción explícita: mockCreditUserWallet nunca llamado)
✅ autorización admin (pasajero bloqueado, 403)
✅ límite de monto / umbral de aprobación (createCredit: pending vs. available según monto)
✅ aprobación (approveCredit ya existente, imposibilidad de autoaprobar ya probada en Fase 4B)
✅ idempotencia (mismo externalReference no duplica)
✅ doble llamada (replay idempotente retorna el mismo resultado)
✅ saldo actualizado (getAvailableBalance invocado y wallets.balance sincronizado tras auto-aprobación)
✅ frontend recibe formato esperado (wallet + transaction con los campos legacy)
✅ pasajero no puede crear crédito (ya existente)
✅ conductor no puede crear crédito (cubierto por isFinancialAdmin, mismo patrón que endpoints del ledger)
✅ reversa (ya existente en Fase 4B, sin cambios)
✅ crédito expirado (ya existente en Fase 4B)
✅ aplicación única (ya existente, applyCredit)
```

```text
Test Files  10 passed (10)
     Tests  109 passed (109)
```

## Paso 10 — Validación final

```text
TYPECHECK API: 0 errores
BUILD API: 0 errores
TESTS API: 109/109
TYPECHECK MOBILE: 0 errores (sin cambios, no se tocó frontend)
BUILD MOBILE: OK (vite build exitoso)
```

Búsqueda de sistemas paralelos (`rg -n "adminCreateWalletCredit|rapago_wallet_benefits_v1|walletBenefit" apps`):
todas las coincidencias corresponden a (a) la fachada de compatibilidad del endpoint legacy
(esperado, Paso 5), o (b) el worklist visual de `localStorage` en mobile que decide QUÉ créditos
proponer al admin, pero ya no crea dinero por sí mismo — la creación real siempre pasa por el
ledger. Ninguna coincidencia representa un segundo backend financiero activo.

## Riesgos residuales (previos a este cierre)

1. ~~**Idempotencia cruzada entre endpoints no garantizada.**~~ **RESUELTO** — ver §11 (Clave
   canónica de operación) más abajo.
2. **Umbral de aprobación** — **POLÍTICA PROVISIONAL APROBADA PARA ESTA VERSIÓN** (aprobada por
   el usuario tras el cierre de idempotencia):

   ```text
   Créditos manuales de hasta $3.000 CLP: aprobación de un administrador autorizado.
   Créditos manuales superiores a $3.000 CLP: aprobación de dos administradores distintos.
   Créditos automáticos generados por reglas del sistema: no requieren aprobación manual,
     siempre que el monto sea calculado por backend, exista idempotencia, y estén vinculados
     a un viaje, pago o evento válido.
   ```

   Implementado en `decideAdminCreditApproval`/`ADMIN_WALLET_CREDIT_SINGLE_APPROVAL_MAX_CLP`
   (`walletPolicy.constants.ts`), configurable en backend, nunca hardcodeado en frontend.

   **TAREA PENDIENTE (seguimiento, no bloqueante para este PR):** el equipo de negocio debe
   confirmar o modificar formalmente el monto de $3.000 CLP antes de producción. Hasta esa
   confirmación, esta es la política vigente del sistema — riesgo MEDIO, no bloqueante, porque
   ya está documentada, es configurable, y la mecánica de aprobación (1 vs. 2 administradores)
   es correcta independientemente del valor exacto del umbral.
3. El frontend (`admin/index.tsx`, `WalletPage.tsx`, etc.) sigue sin migrar a los endpoints del
   ledger — fuera de alcance de esta fase, ya documentado en fases anteriores.
4. `transactions`/`wallets.balance` para pagos reales (MercadoPago/webhook) no se tocaron —
   dominio separado, coexiste sin conflicto con el ledger de créditos.

## §11 — Cierre del riesgo residual: idempotencia canónica entre endpoints

Se creó `buildWalletCreditOperationKey(...)` (`walletPolicy.constants.ts`), una función pura
compartida por `WalletService.adminCreateWalletCredit` (endpoint legacy) y
`WalletTransactionsService.createCredit` (endpoint nativo del ledger). Ambos calculan la misma
clave de idempotencia a partir de **campos de dominio exclusivamente** — nunca del motivo/texto
libre:

```text
credit:sha256(operationType|userId|rideId|paymentId|source|amountClp|policyVersion|externalReference)
```

- `externalReference` (o `idempotencyKey` como alias retrocompatible en el DTO del ledger) es el
  token que el admin usa para distinguir explícitamente una operación de otra. Si se omite, se usa
  un centinela fijo (`"no-reference"`, NO aleatorio) — así una solicitud repetida sin token
  explícito (doble clic, retry de red) sigue detectándose como el mismo movimiento.
- El motivo/descripción **nunca** forma parte de la clave — cambiar el texto no genera un
  crédito nuevo ni impide detectar un duplicado.
- `reverseTransaction` usa su propia clave (`reversal:<idOriginal>`, ya existente desde Fase 4B)
  con un `operationType` implícito distinto (`type=reversal` en vez de `admin_wallet_credit`), así
  que nunca colisiona con el crédito que revierte.

Ambos endpoints comparten la misma tabla (`wallet_transactions_ledger`) y la misma restricción
`UNIQUE(idempotency_key)` — por lo tanto, una operación equivalente enviada por cualquiera de los
dos endpoints, en cualquier orden, o de forma concurrente, produce como máximo un movimiento.

### Pruebas nuevas — `walletCreditIdempotencyAcrossEndpoints.test.ts`

Instancia `WalletService` y `WalletTransactionsService` reales contra un repositorio simulado
compartido con semántica de `UNIQUE(idempotency_key)` real (no solo mocks aislados por archivo):

```text
1. Crear por /admin/wallet/credits, repetir la misma operación por /admin/wallet-transactions
   → un solo movimiento.                                                              ✅ PASA
2. Orden inverso (ledger primero, legacy después), misma operación → un solo movimiento. ✅ PASA
3. Dos solicitudes concurrentes por endpoints distintos → invariante final: 1 sola fila.  ✅ PASA
4. Mismo viaje y monto, externalReference DISTINTO (operación legítima distinta)
   → NO colisiona (2 filas).                                                          ✅ PASA
5. Mismo externalReference, descripción distinta → SÍ colisiona (1 fila) — el motivo
   nunca es parte de la clave.                                                        ✅ PASA
6. Distintos pasajeros, mismo resto de campos → NO colisiona (2 filas).                ✅ PASA
7. Distintos rideId, mismo resto de campos → NO colisiona (2 filas).                   ✅ PASA
8. Reversa vs. crédito original → claves distintas, nunca colisionan.                  ✅ PASA
```

```text
Test Files  11 passed (11)
     Tests  117 passed (117)   (109 previos + 8 nuevos de idempotencia cruzada)
```

---

```text
FUENTE DE VERDAD FINANCIERA: UNA
LEDGER AUTORITATIVO: SÍ
ADMINCREATEWALLETCREDIT USA LEDGER: SÍ
TABLA PARALELA ACTIVA: NO (creditUserWallet deprecado, sin callers)
DOBLE ACREDITACIÓN POSIBLE: NO — cerrado también entre endpoints distintos (§11)
FRONTEND COMPATIBLE: SÍ (mismo contrato de request/response)
IDEMPOTENCIA ENTRE ENDPOINTS: SÍ
DOBLE CRÉDITO ENTRE ENDPOINTS: NO
TESTS API: 117/117
BUILD API: OK
BUILD MOBILE: OK
RIESGOS CRÍTICOS: 0
RIESGOS ALTOS: 0
RIESGOS MEDIOS: 1 (umbral de aprobación $3.000 CLP sin confirmación formal del equipo — #2 arriba)
APTO PARA PR A MAIN: SÍ
```

No se hizo push ni merge.
