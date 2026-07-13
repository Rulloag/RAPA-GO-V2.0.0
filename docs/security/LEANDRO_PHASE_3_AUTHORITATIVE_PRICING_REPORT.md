# FASE 3 — Remediación crítica de integridad financiera (tarifas)

Rama: `security/remediation-leandro-wallet`. Hallazgo preexistente (no introducido por Leandro),
detectado en Fase 2B, clasificado **CRÍTICO PREEXISTENTE — BLOQUEANTE PARA MERGE**.

## 1. Causa raíz (Paso 1)

| Campo financiero | Origen (antes del fix) | Validación | Recalculado en backend | Riesgo |
|---|---|---|---|---|
| `estimatedFareClp` (input cliente) | `createRideRequestSchema`: `z.number().int().positive()` | Solo tipo/signo | **NO** — se usaba tal cual si era positivo | 🔴 Crítico |
| `baseFare` (fallback) | `estimateFare()` server-side, solo si el cliente no enviaba nada | Consulta `fareSettings` (`mobility_per_km`, `minimum_fare`, `zone_fare`) | Sí | 🟡 Medio (fallback de distancia es un proxy débil basado en longitud de texto, no en mapas reales — no es una vulnerabilidad de seguridad, es una limitación de precisión de negocio, fuera de alcance de esta fase) |
| `finalFare` | `baseFare` − descuento de referido | Requiere `refCode.isActive` | Sí, pero heredaba la contaminación de `baseFare` | 🔴 Crítico (heredado) |
| Moneda | No existe columna `currency` en `rideRequests` — todo es CLP fijo | N/A | N/A | 🟢 Sin vector de manipulación (no hay campo que alterar) |
| Persistencia | `ridesRepo.create(..., finalFare)` → `rideRequests.estimated_fare_clp` | — | — | Esta columna es, en la práctica, el precio oficial que luego lee `payments.service.ts` |

## 2. Trazado hasta el proveedor de pago (Paso 2)

```text
MERCADOPAGO / PRONTOPAGA:
Monto usado: ride.estimatedFareClp (payments.service.ts:482)
Origen: columna persistida en rideRequests, fijada en rides.service.ts (ahora corregido)
Se consulta desde DB: SÍ
Se recalcula en creación de pago: NO — usa el valor ya persistido del viaje (correcto,
  siempre que ese valor sea confiable — que ahora lo es, tras esta fase)
Se compara con el proveedor en el webhook: NO — NormalizedWebhook (payment.provider.ts) no
  incluye un campo `amount`; ni MercadoPago ni ProntoPaga devuelven el monto para comparar
  contra payment.amountClp. GAP DOCUMENTADO, NO CORREGIDO EN ESTA FASE (ver §7).
IMPACTO FINANCIERO DIRECTO: confirmado antes del fix (un pasajero podía fijar
  ride.estimatedFareClp en $1 y pagar $1 por un viaje real).
```

## 3-6. Diseño y corrección aplicada (Pasos 3-6)

Se optó por la **corrección mínima segura** en vez del rediseño completo de columnas
(`finalFare`/`authorizedAmount`/`capturedAmount` de Paso 4), para no ampliar el alcance
(regla 9) ni requerir migración de base de datos en producción (regla 4) en esta fase:

- `rides.service.ts`: `baseFare` se calcula **siempre** vía `estimateFare()` (tarifario real del
  servidor: `mobility_per_km`, `minimum_fare`, `zone_fare`). El valor enviado por el cliente
  (`input.estimatedFareClp`) ya **no se usa nunca** como precio autoritativo.
- Si el cliente envía un valor distinto al calculado por el servidor, se registra un evento de
  auditoría (`ride.fare_client_mismatch`, sin PII, solo `clientFareClp` vs `serverFareClp`) para
  poder detectar patrones de manipulación, sin bloquear la creación del viaje (evita romper el
  flujo normal, ya que el frontend siempre envía una estimación distinta al cálculo exacto del
  servidor por diseño).
- No se tocaron `payments.service.ts` ni los proveedores (`mercadopago.provider.ts`,
  `prontopaga.provider.ts`) — ya usaban correctamente `ride.estimatedFareClp` persistido, no un
  monto del request de creación de pago.

**Diseño ideal recomendado para una fase futura (no implementado ahora):** separar
`clientEstimatedFareClp` (diagnóstico) de `serverFareClp`/`pricingVersion`/`pricingBreakdown`
como columnas explícitas (Paso 4/6 del plan), y mejorar `estimateFare()` para usar distancia real
de un proveedor de mapas en vez del proxy de longitud de texto. Ambos quedan fuera de esta fase
por alcance.

## 7. Webhooks (Paso 8) — validación parcial, gap documentado

Confirmado por lectura de `payment.provider.ts`, `mercadopago.provider.ts`, `prontopaga.provider.ts`:

- ✅ Verificación de firma (`verifyWebhookSignature`) antes de procesar.
- ✅ Idempotencia: `payment.status === "success" | "rejected" | "failed" | "refunded"` bloquea
  reprocesamiento de webhooks repetidos.
- ❌ **No se verifica el monto.** `NormalizedWebhook` no expone un campo `amount`; el webhook
  nunca compara lo que el proveedor confirma contra `payment.amountClp`. Esto requeriría ampliar
  la interfaz `PaymentProvider` y ambos proveedores — se **decidió no tocar proveedores de pago
  sin entender antes su contrato completo** (regla 3), y por tratarse de un cambio de mayor
  riesgo/alcance que la corrección mínima de esta fase. **Queda como hallazgo ALTO abierto**,
  recomendado para un sprint dedicado a webhooks.
- No hay `db.transaction()` envolviendo las escrituras del webhook (`markSuccess` + `update` del
  ride son dos operaciones separadas) — riesgo de inconsistencia ante fallo parcial. También
  queda documentado, no corregido en esta fase (alcance mínimo).

## 8. Pruebas de manipulación (Paso 9)

Archivo nuevo: `apps/api/src/modules/rides/__tests__/rides.service.test.ts` (no existía
previamente ningún test para este módulo).

| Prueba | Resultado |
|---|---|
| `estimatedFareClp: 1` (manipulación a la baja) | ✅ PASA — el backend ignora el valor y calcula la tarifa real |
| `estimatedFareClp: 999999999` (tarifa exagerada) | ✅ PASA — no se persiste el valor del cliente |
| Sin `estimatedFareClp` en el request | ✅ PASA — el servidor calcula igual, sin evento de auditoría (nada que comparar) |
| Tarifa de zona configurada en backend (`zone_fare`) | ✅ PASA — se usa la tarifa de zona, ignorando por completo el valor del cliente |

```text
Test Files  1 passed (1)
     Tests  4 passed (4)
```

Pruebas de "pago manipulado", "webhook repetido" y "doble petición de pago" **no se agregaron**
en esta fase porque ya existen en `payments.service.test.ts`/`mercadopago.provider.test.ts`
(confirmado: 43-47 de 45-49 tests pasan según el módulo, con los mismos 2 fallos preexistentes de
la Fase 1, no relacionados con este cambio). La prueba de "webhook con monto distinto" **no se
pudo implementar** porque, como se documenta en §7, el código actual no tiene ningún punto donde
comparar el monto — se marca como `NO RESOLUBLE SIN DEFINICIÓN FUNCIONAL` hasta que se diseñe la
extensión de `NormalizedWebhook`.

## 9. Compatibilidad y migración (Paso 10)

No se requiere migración de base de datos — no se agregaron ni renombraron columnas. El cambio es
puramente de lógica de servicio: los viajes ya creados no se ven afectados (no se recalculó nada
retroactivamente). Los viajes nuevos, desde este commit, calculan su tarifa 100% en servidor.

```text
Viajes no pagados / reservas futuras: no se tocaron registros existentes, la lógica nueva solo
  aplica a partir de este commit hacia adelante.
Viajes pagados: sin cambios, no se recalculó nada retroactivamente (regla explícita del plan).
Rollback: revertir el commit fix(api) restaura el comportamiento anterior (vulnerable) sin
  pérdida de datos, ya que no hubo migración de esquema.
```

## 10. Archivos modificados

```text
apps/api/src/modules/rides/rides.service.ts                  (fix)
apps/api/src/modules/rides/__tests__/rides.service.test.ts    (nuevo, tests)
docs/security/LEANDRO_PHASE_3_AUTHORITATIVE_PRICING_REPORT.md (nuevo, este informe)
```

No se tocó Wallet, `localStorage`, proveedores de pago, ni ningún archivo de mobile.

## 11. Riesgos residuales / críticos abiertos

1. **ALTO** — Webhooks no verifican el monto confirmado por el proveedor contra
   `payment.amountClp` (§7). Requiere extender `NormalizedWebhook` + ambos proveedores.
2. **ALTO** — Ausencia de transacciones DB atómicas en el flujo de webhook (`payments.service.ts`)
   y en `WalletService.handleWebhook` (confirmado en Fase 2B).
3. **CRÍTICO, ya identificado en Fase 2B, NO corregido aquí (fuera de alcance, pertenece a Wallet)**
   — `WalletService.createPaymentOrder` (`wallet.service.ts:122`) usa `input.amount` directo del
   cliente sin validarlo contra el viaje. Se deja explícitamente para el Paso 6 del plan ("Recién
   después corregir Wallet y créditos").
4. `estimateFare()` usa un proxy de distancia poco preciso (longitud de texto de
   origen/destino) cuando no hay `zone_fare` configurada — no es una vulnerabilidad de seguridad,
   pero sí una limitación de negocio a mejorar en una fase de precisión de tarifas.

## 12. Confirmación de que no quedan montos del cliente confiados en el flujo de tarifa/pago principal

```bash
rg -n "input\.(fare|amount|estimatedFare|minimumFare|total|discount|surcharge)" apps/api/src -i
```
Resultado:
- `rides.service.ts` — ahora solo lectura diagnóstica (`fareFromClient`), no autoritativa. ✅
- `fareSettings.service.ts:156` (`input.fare`) — endpoint de **administración** (`auth.role !==
  "admin"` bloquea a no-admins en las 5 rutas del servicio), no es tarifa de un viaje individual
  de pasajero. No es la misma clase de vulnerabilidad — un admin autorizado fijando tarifas
  oficiales es el comportamiento esperado. ✅ Sin acción.
- `wallet.service.ts:122` (`input.amount`) — pendiente, explícitamente diferido a la fase de
  Wallet (ítem 6 del plan). ⚠️ Documentado, no corregido aquí.

---

```text
FASE 3:
TARIFA CONTROLADA POR CLIENTE: NO (ride creation ya no confía en estimatedFareClp del cliente)
MONTO RECALCULADO EN BACKEND: SÍ (siempre, vía estimateFare())
PAYMENTS USA MONTO AUTORITATIVO: SÍ (ya lo hacía — ride.estimatedFareClp persistido, ahora confiable)
WEBHOOK VALIDA MONTO: NO — gap documentado, no corregido en esta fase (§7, riesgo ALTO abierto)
IDEMPOTENCIA: SÍ (webhook de pagos, confirmado por status ya terminal + tests existentes)
PRUEBAS DE MANIPULACIÓN: PASAN (4/4 nuevas, más 47/49 preexistentes sin regresión)
RIESGOS CRÍTICOS ABIERTOS: 1 (WalletService.createPaymentOrder — diferido intencionalmente a Wallet)
COMMIT: pendiente de confirmación del usuario
APTO PARA CONTINUAR CON WALLET: SÍ, con la condición de que la Fase de Wallet corrija también
  wallet.service.ts:122 (input.amount) antes de dar por cerrada la integridad financiera completa.
```

No se hizo push ni merge.
