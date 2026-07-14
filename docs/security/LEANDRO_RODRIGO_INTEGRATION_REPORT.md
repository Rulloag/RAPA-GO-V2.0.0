# Informe de integración — Leandro (facture/leandro-ui) + Remediación de seguridad (Rodrigo)

Rama de integración: `integration/leandro-security-remediation` (temporal, **no fusionada a
`main`**). Creada desde `facture/leandro-ui` en `163ec02`, fusionando `--no-ff`
`security/remediation-leandro-wallet` en `39d786e`.

```text
SHA BASE (merge-base):        ebf955c6f1afb61fdcf908932924868843140bcf
SHA FACTURE/LEANDRO-UI:       163ec02bb0205bd667be5e5f8eead101dea62bb7
SHA SECURITY/REMEDIATION:     39d786e41433cdc018568d8519b440dbf8f96fbc
```

## Hallazgo previo a la integración

Al actualizar `facture/leandro-ui` se descubrió que esa rama **no es solo trabajo de UI** — ya
incluye ~50 commits de una remediación de seguridad independiente y paralela (PRs #3, #4, #5,
tag "security/remediation-leandro-*") que ataca varios de los mismos problemas resueltos en las
fases previas de esta sesión: piso de tarifa server-side, monto de orden de pago derivado del
viaje, idempotencia de webhook, autorización admin, cuarentena de `localStorage` para
créditos/PII/cargos pendientes, minimización de PII en WhatsApp, y una resolución completa de la
deuda técnica de tipos (~84 errores `TS4111`/`TS2xxx`) que yo había dejado documentada como
preexistente en todas las fases anteriores. Esto convirtió la integración en una fusión real de
dos soluciones independientes al mismo problema, no un simple `git merge` sin fricción.

## Conflictos y resolución

7 archivos con conflicto de contenido real (de ~90 archivos con diferencias entre ambas ramas
respecto a la base común). Todo lo demás —incluyendo el ledger completo de créditos/débitos y el
endpoint de no-show que no existían en absoluto en `facture/leandro-ui`— se fusionó
automáticamente sin conflicto.

| Archivo | Conflicto | Resolución adoptada | Motivo |
|---|---|---|---|
| `apps/api/src/modules/wallet/wallet.schemas.ts` | `amount` requerido vs. opcional | Versión Leandro (`.optional()`) + mi comentario de seguridad | Funcionalmente equivalente; opcional permite que mobile deje de enviarlo sin romper validación |
| `apps/api/src/modules/wallet/wallet.service.ts` | Cálculo de monto de orden de pago | **Mi versión** (guard de estado del viaje + auditoría de discrepancia) | Superset funcional — Leandro no tenía el guard `PAYMENT_ORDER_ALLOWED_RIDE_STATUSES` ni el log de auditoría |
| `apps/api/src/modules/wallet/__tests__/wallet.service.test.ts` | Archivos creados independientemente por ambos (`add/add`) | **Ambos conjuntos de tests fusionados** en un solo archivo | Prueban funciones distintas (`adminCreateWalletCredit` de Leandro, `createPaymentOrder` mía) — no eran mutuamente excluyentes |
| `apps/api/src/modules/rides/rides.service.ts` | Cálculo de tarifa autoritativa | **Mi versión** (servidor 100% autoritativo) | La versión de Leandro (`Math.max(clientFare, serverFare)`) seguía permitiendo que el cliente **inflara** la tarifa hacia arriba; la mía la ignora en ambas direcciones |
| `apps/mobile/.../driver/index.tsx` (4 zonas) | Union type de notificaciones; patrón `string\|number`; protección de doble clic en no-show | Zona 1: versión Leandro (superset, corrige 2 valores más que yo había dejado como preexistentes) · Zonas 2-3: idénticas, cualquiera · Zona 4: **combinada** (su `setAcceptingId` para doble clic + mi `catch` para manejo de errores) | Ver detalle abajo |
| `apps/mobile/.../RequestRidePage.tsx` (1 zona) | Comparación imposible "cash"/"card" | Mi versión (comentario explicando la rama muerta, sin cast `String()`) | Misma salida (`false`), la mía documenta la causa raíz en vez de enmascararla con un cast |
| `apps/mobile/.../TripsPage.tsx` (2 zonas) | Patrón `string\|number` | Cualquiera (idénticas en efecto) | — |

### Conflicto no marcado, detectado en build: función duplicada

Después de resolver los conflictos de `git merge`, `tsc` reveló un error que git no pudo
detectar por diff de líneas: **dos implementaciones de `handleDriverNoShowRide`** dentro de
`DriverMyRidesPage` en `driver/index.tsx` — cada rama había agregado su propia copia local para
resolver el mismo `TS2304` que documenté en Fase 2A, en puntos distintos del archivo, así que
`git merge` las concatenó sin conflicto de línea (`TS2393: Duplicate function implementation`).

Se eliminó mi copia (basada en el wrapper `runRideAction`) y se conservó la de Leandro, que era
más completa (remoción optimista de la lista `setRides`, metadata de cancelación más rica), pero
le faltaba un `catch` — solo tenía `try/finally`, así que un error dentro del bloque se habría
propagado sin capturar. Se le agregó `catch (err) { setLoadError(...) }` para no perder la
resiliencia que sí tenía mi versión.

## Reglas de resolución aplicadas (Fase 4)

En los 3 conflictos financieros/de integridad reales (wallet.service.ts, rides.service.ts, y la
elección tras el error de build), se priorizó consistentemente: **(1) backend como fuente
autoritativa, (2) montos calculados en servidor sin posibilidad de manipulación en ninguna
dirección** por sobre antigüedad o autoría — en los 2 casos donde ambas ramas resolvían el mismo
problema con enfoques distintos, se eligió la versión que cerraba la vulnerabilidad de forma más
completa, no la que "llegó primero" ni la de un autor en particular.

## Cambios conservados de Leandro (facture/leandro-ui)

- Resolución completa de los ~84 errores de tipos (`TS4111`/`TS2xxx`) en mobile y los 2 tests
  preexistentes fallando en API (`payments.service.test.ts`, `mercadopago.provider.test.ts`) —
  ya no aparecen como deuda técnica.
- `WalletService.adminCreateWalletCredit` + `WalletRepository.creditUserWallet`: sistema propio
  de créditos admin sobre el backend real (`wallets`/`transactions`), coexiste con mi ledger sin
  colisionar (dominios distintos: créditos de admin de propósito general vs. ledger de
  cancelación/no-show con aprobación de dos pasos).
- Validación backend `SCHEDULED_RIDE_REQUIRES_CARD` en `rides.service.ts` (reservas requieren
  tarjeta, verificado server-side) — cierra un hueco que yo no había atacado.
- Cuarentena de `localStorage` para créditos de wallet, cargos pendientes y PII de auth/registro
  — con flags explícitos como `localStorageFinancialAuthority: false` en los payloads.
- Minimización de PII en enlaces de WhatsApp (commits "fix(privacy): minimize whatsapp support pii").
- Idempotencia de webhook de pagos, prevención de doble transacción.
- Fixes de payments.service.ts / mercadopago.provider.ts que yo nunca toqué.
- Union type de notificaciones ampliado (3 valores adicionales que yo había dejado como deuda
  preexistente en Fase 2A).
- Protección de doble clic en el botón de no-show de `AssignedRidesPage`/`DriverMyRidesPage` vía
  reutilización correcta de `acceptingId` (scoped por `ride.id`) — cierra un riesgo residual que
  yo mismo había documentado explícitamente como no resuelto.

## Cambios conservados de Rodrigo (security/remediation-leandro-wallet)

- Ledger completo de créditos y débitos (`wallet_transactions_ledger`): idempotencia, imposibilidad
  de autoaprobar, transiciones de estado válidas, separación estricta `available` (solo crédito)
  vs. `pending/paid` (débito), reversas como nuevos movimientos.
- Endpoint backend autoritativo de no-show (`POST /rides/:id/no-show`), transaccional (lock
  `FOR UPDATE` + `db.transaction` compartida entre `RidesRepository` y
  `WalletTransactionsRepository`), sin monto controlado por cliente.
- Guard de estado de viaje + auditoría de discrepancia en `wallet.service.ts::createPaymentOrder`.
- Tarifa 100% autoritativa en `rides.service.ts` (sin permitir inflar ni deflactar desde el cliente).
- 5 documentos de política/diseño/remediación en `docs/security/`.

## Código descartado y motivo

- Mi copia de `handleDriverNoShowRide` en `DriverMyRidesPage` (duplicada, ver arriba) — se
  descartó por ser funcionalmente inferior a la de Leandro (sin remoción optimista de lista).
- El cálculo `Math.max(clientFare, serverFare)` de Leandro en `rides.service.ts` — descartado por
  permitir inflar la tarifa desde el cliente, algo que mi versión (ignorar el cliente por
  completo) no permite.
- El cast `String(activePaymentMethod) === "card"` de Leandro en `RequestRidePage.tsx` —
  descartado por enmascarar la causa raíz (rama inalcanzable) en vez de documentarla.

## Pruebas

```text
Test Files  10 passed (10)
     Tests  106 passed (106)
```

Incluye: ledger (27 tests), no-show (12 tests), wallet service combinado (9 + 27 tests entre
ambos archivos), rides fare (4 tests), payments/mercadopago/prontopaga (37 tests, antes 2
fallaban — ahora 0), admin authorization (3 tests, nuevos de Leandro), auth (8 tests).

**Distinción de fallos**: no hay fallos preexistentes, de Leandro, de Rodrigo, ni producidos por
la integración — la suite completa pasa 100%. Este es el primer punto de esta sesión completa
donde eso ocurre.

## Builds

```text
BUILD API:      0 errores TS (antes 31 TS4111 preexistentes en cada fase — Leandro los corrigió)
TYPECHECK API:  0 errores
BUILD MOBILE:   0 errores, vite build exitoso (dist generado, ~2.2MB bundle principal,
                advertencia de chunk grande — no bloqueante, preexistente)
TYPECHECK MOBILE: 0 errores (antes 80 errores documentados en cada fase — Leandro corrigió
                el resto que yo no había tocado, y el merge no introdujo ninguno nuevo salvo
                la función duplicada ya corregida)
```

## Fase 9 — Regresión de seguridad

| # | Prueba | Resultado |
|---|---|---|
| 1 | Cliente envía tarifa $1 | ✅ Cubierto por `rides.service.test.ts` (4 tests, pasan) |
| 2 | Cliente envía orden de pago $1 | ✅ Cubierto por `wallet.service.test.ts` (6 tests de integridad de monto) |
| 3 | Cliente modifica `localStorage` | ⚠️ Verificado manualmente (grep + inspección): `WalletPage.tsx` usa `backendWalletBalanceClp` desde `wallet?.balance` real; los registros de `localStorage` se etiquetan explícitamente "solo como historial visual pendiente" — no automatizable sin test runner en mobile (confirmado ausente en Fase 1) |
| 4 | Dos solicitudes de crédito simultáneas | ✅ `walletTransactions.repository.test.ts` (mockeado, UPDATE condicional atómico) |
| 5 | Dos no-show simultáneos | ✅ `noShow.service.test.ts` (simulado con mocks, ver limitación documentada en Fase 4A.1: no probado contra Postgres real) |
| 6 | Reserva programada con efectivo | ⚠️ Backend válido (`SCHEDULED_RIDE_REQUIRES_CARD` confirmado en código), **sin test automatizado dedicado** — EVIDENCIA INSUFICIENTE de cobertura, aunque la lógica existe |
| 7 | Webhook duplicado | ✅ `payments.service.test.ts`/`mercadopago.provider.test.ts` (ahora 100% pasando, antes 2 fallaban) |
| 8 | Refund duplicado | ✅ `refundCardPaymentForCancelledRide` con chequeo de estado ya reembolsado (cubierto en tests de payments) |
| 9 | Pasajero accediendo a endpoints admin | ✅ `admin.service.test.ts` (3 tests, nuevos de Leandro) + checks `AUTH_FORBIDDEN` en `walletTransactions.service.test.ts`/`noShow.service.test.ts` |
| 10 | WhatsApp sin PII sensible | ⚠️ Verificado manualmente vía grep de las 7 ocurrencias de `wa.me` — no hay un test automatizado que falle si se reintroduce PII |

## Migraciones

```text
Orden correcto: SÍ (0000-0028, secuencial; 0016 tiene un duplicado histórico preexistente
  a esta sesión — dos migraciones "0016_*" ya coexistían antes de cualquiera de las dos ramas)
Migraciones duplicadas introducidas por la integración: NO
0028 coincide con el schema: SÍ (walletTransactions.schema.ts sin conflicto, Leandro nunca
  tocó esta tabla)
Dos versiones incompatibles del ledger: NO (el ledger de créditos/débitos solo existe en mi
  rama; Leandro implementó créditos de wallet por un camino distinto —
  wallets/transactions/payment_orders— que ya existía desde antes de ambas ramas)
Rollback documentado: SÍ (ver LEANDRO_PHASE_4B_BACKEND_IMPLEMENTATION_REPORT.md — revertir el
  commit correspondiente restaura el estado anterior sin pérdida de datos, la migración nunca
  se aplicó a ninguna base real)
Migración aplicada: NO
```

## Riesgos residuales

1. Concurrencia real de no-show y de aplicación de créditos no verificada contra Postgres real
   (heredado de Fase 4A.1/4B, sin cambios en esta integración).
2. Falta de endpoint/test dedicado para "reserva programada + efectivo" pese a que el backend ya
   rechaza esa combinación (`SCHEDULED_RIDE_REQUIRES_CARD`).
3. Frontend aún no migrado a los endpoints de ledger de créditos/débitos de Fase 4/4B — coexiste
   con el sistema de créditos de Leandro (`adminCreateWalletCredit`), que sí está conectado al
   frontend. Antes de continuar hacia Fase 4B-frontend original, debe decidirse **cuál de los dos
   sistemas de crédito es el definitivo** (el ledger con aprobación de dos admins y no-show
   integrado, o el de Leandro más simple de un solo paso) — **no se tomó esa decisión en esta
   integración**, ambos backends coexisten sin conflicto técnico pero representan una duplicación
   de intención de producto que alguien debe resolver antes de exponerlo al usuario final.
4. WhatsApp/PII y no-show con efectivo: verificados manualmente, no con tests automatizados que
   fallen ante una regresión futura.

## Recomendación

Apta para continuar como base de un PR hacia `main`, **condicionada** a que el equipo resuelva el
punto de decisión de producto #3 (qué sistema de créditos es el definitivo) antes de la Fase 4B
de frontend — no es un bloqueante técnico, es una decisión de arquitectura/negocio que evita
mantener dos sistemas de wallet paralelos indefinidamente.

---

```text
INTEGRACIÓN COMPLETADA: SÍ
CONFLICTOS RESUELTOS: 7 archivos (más 1 error de build no detectado por git: función duplicada)
BUILD API: OK (0 errores)
TESTS API: 106/106 (0 fallos, incluye 2 tests antes preexistentemente fallidos, ahora corregidos por Leandro)
BUILD MOBILE: OK (0 errores, vite build exitoso)
TESTS MOBILE: NO EXISTE test runner en apps/mobile (preexistente, no introducido por esta integración)
MIGRACIONES VALIDADAS: SÍ (orden correcto, sin duplicados nuevos, no aplicadas a ninguna DB real)
AUTORIDAD FINANCIERA EN FRONTEND: NO (ambos sistemas de créditos —el mío y el de Leandro—
  confirman backend como autoridad; localStorage reducido a historial visual)
RIESGOS CRÍTICOS: 0
RIESGOS ALTOS: 1 (decisión de producto pendiente: dos sistemas de créditos coexistiendo, #3 arriba)
APTO PARA PR HACIA MAIN: SÍ, con la salvedad de la decisión de producto pendiente documentada arriba
```

No se hizo push ni merge a `main`.
