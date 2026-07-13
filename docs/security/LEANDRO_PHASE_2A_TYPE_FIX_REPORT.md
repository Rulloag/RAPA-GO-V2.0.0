# FASE 2A — Investigación y corrección de errores de tipos introducidos por `ebf955c`

Rama: `security/remediation-leandro-wallet` (base `ebf955c`, origen `facture/leandro-ui`)
Alcance: únicamente los 7 errores de TypeScript introducidos por el commit de Leandro en los 5
archivos que él modificó. No se tocó Wallet, pagos, base de datos, dependencias ni ESLint.

## 1. Errores investigados

| # | Archivo | Línea (antes) | Código | Descripción |
|---|---|---|---|---|
| 1 | `driver/index.tsx` | 5923 | TS2820 | `type: "scheduled_driver_reassigned"` no está en la unión `PassengerNotificationPayload.type` |
| 2 | `driver/index.tsx` | 7981 | TS2365 | `value > 0` sobre `string \| number` en `readDriverNoShowTimerMap` |
| 3 | `driver/index.tsx` | 11755 | TS2304 | `setActionLoading` no definido dentro de `AssignedRidesPage` |
| 4 | `driver/index.tsx` | 11780 | TS2304 | `setActionLoading` no definido dentro de `AssignedRidesPage` |
| 5 | `driver/index.tsx` | 14357 | TS2304 | `handleArrivedSmart` no definido dentro de `DriverMyRidesPage` |
| 6 | `driver/index.tsx` | 14393 | TS2304 | `handleDriverNoShowRide` no definido dentro de `DriverMyRidesPage` |
| 7 | `RequestRidePage.tsx` | 5135 | TS1117 | Clave duplicada `reservationRequiresCard` (ya corregido en fase previa, sin commit) |
| 8 | `RequestRidePage.tsx` | 5477 | TS2367 | `activePaymentMethod === "card"` imposible tras narrowing |
| 9 | `RequestRidePage.tsx` | 5479 | TS2367 | ídem |
| 10 | `TripsPage.tsx` | 294 | TS2365 | `value > 0` sobre `string \| number` (patrón duplicado del #2) |
| 11 | `TripsPage.tsx` | 466 | TS2365 | ídem, segunda copia del mismo patrón |

(11 líneas de error, agrupadas en 7 causas raíz distintas, tal como reportó el baseline de Fase 1.)

## 2. Causa raíz de cada uno

**#1 — Notificación fuera de unión.** `PassengerNotificationPayload.type` (línea 6575) es una
unión literal `"driver_cancelled_requeue" | "driver_assigned" | "scheduled_driver_assigned"`.
Leandro agregó un nuevo tipo de notificación legítimo (`"scheduled_driver_reassigned"`, usado al
reasignar una reserva a otro conductor) sin extender la unión. Verificado que `type` no se usa en
ningún `switch`/comparación exhaustiva en el archivo — ampliar la unión es seguro.

**#2 y #10/#11 — `string | number` en filtros de timers.** Mismo patrón exacto
(`Object.fromEntries(Object.entries(parsed).map(([k,v]) => [k, Number(v)]).filter(...))`)
duplicado en tres funciones (`readDriverNoShowTimerMap` en driver, y
`readPassengerDriverArrivedTimerMap` + `readPassengerDriverAcceptedTimerMap` en TripsPage,
esta última preexistente y no reportaba error — solo las dos primeras generaban error tras el
commit). Causa: `.map()` devuelve un array literal que TS ensancha a `(string|number)[]`, perdiendo
la tupla `[string, number]`. **La lógica en runtime ya era correcta** (`Number(value)` maneja bien
string numérico, vacío, texto, `null`, `undefined`, `NaN`, `Infinity`); el problema era 100% de
tipos.

**#3 y #4 — `setActionLoading` fuera de scope.** `AssignedRidesPage` (línea 10693) y
`DriverMyRidesPage` (línea 13951, ahora 13953) son dos componentes de función **distintos**.
`handleDriverNoShowRide` fue escrito dentro de `AssignedRidesPage` pero llama a
`setActionLoading`, un estado que **solo existe en `DriverMyRidesPage`** (`const [actionLoading,
setActionLoading] = useState<string | null>(null)`, línea 13959 original). `AssignedRidesPage`
únicamente tiene `const [loading, setLoading] = useState(true)` (loading de carga inicial, no por
acción) y `acceptingId` (loading específico del flujo de aceptar viajes, usado en 9 botones
distintos — reutilizarlo para no-show habría mezclado semánticas de dos flujos diferentes, algo
que las reglas de esta fase prohíben explícitamente). **Confirmado con `git diff --no-index` y
`grep`:** el botón "No show" de `AssignedRidesPage` (línea ~13206) nunca consultó ningún estado de
loading en su JSX — la llamada a `setActionLoading` era huérfana desde el primer commit.

**#5 y #6 — Handlers definidos en el componente equivocado.** Comparación
`git show af33c69:...` vs `git show ebf955c:...` confirmó la causa exacta: el botón "Llegué"
original de `DriverMyRidesPage` (línea vieja ~13383) llamaba a
`runRideAction(activeRide.id, () => ridesService.markArrived(...))`, usando la infraestructura
propia de ese componente (`runRideAction` + `actionLoading`, ya declarados ahí). Leandro reemplazó
esa llamada por `handleArrivedSmart(activeRide)` y agregó un nuevo botón "No show" llamando a
`handleDriverNoShowRide(activeRide)` — pero **ambas funciones las definió únicamente dentro de
`AssignedRidesPage`**, un componente distinto. El fetch de PII/estado (`session`, `loadRides`,
`ridesService`) sí existe igual en ambos componentes, pero las funciones en sí no son compartidas
ni importadas — cada componente en este archivo define sus propios handlers.

**#7 (clave duplicada)** — ya documentado y corregido en la fase anterior; confirmado que sigue
resuelto en el working tree sin commit.

**#8 y #9 — Comparación "cash"/"card" imposible.** El objeto `LocalPassengerRideData` que contiene
estas líneas se construye únicamente dentro del bloque
`catch (err) { if (isPassengerRolePermissionMessage(message)) { if (activePaymentMethod ===
"card") { setSubmitError(...); return; } ... } }` (línea 5293 en el estado post-fix-#7). Es decir:
si `activePaymentMethod === "card"`, la función ya retornó antes de llegar a construir este objeto.
TypeScript demuestra correctamente, por control-flow analysis, que en ese punto
`activePaymentMethod` **no puede** ser `"card"` — la comparación es lógicamente muerta, no un bug
de tipos a silenciar.

## 3. Evidencia de Git

```text
git blame -L <línea>,<línea> --porcelain ebf955c -- <archivo>
```
confirmó línea por línea que las 7 causas raíz pertenecen a `ebf955c` (no a `af33c69`, `b2f414d`,
`0a9ab20`, `4c117ce`, `720b9ae`, `9426592`, que son los commits a los que pertenecen el resto de
los 80 errores preexistentes).

```text
git show af33c69:apps/mobile/src/pages/driver/index.tsx > /tmp/driver-before.tsx
git show ebf955c:apps/mobile/src/pages/driver/index.tsx > /tmp/driver-after.tsx
```
confirmó el reemplazo de `runRideAction(...) → ridesService.markArrived(...)` por
`handleArrivedSmart(activeRide)` en `DriverMyRidesPage`, y la ausencia total de un botón "No show"
en ese componente antes del commit.

## 4. Corrección aplicada

1. **`driver/index.tsx`** — se amplió la unión `PassengerNotificationPayload.type` agregando
   `"scheduled_driver_reassigned"` (categoría A: tipo real usado, unión incompleta).
2. **`driver/index.tsx`** — se anotó el retorno de `.map()` como tupla `[string, number]` en
   `readDriverNoShowTimerMap` (categoría tipos, sin cambio de lógica runtime).
3. **`driver/index.tsx`** — se definieron **copias locales** de `handleArrivedSmart` y
   `handleDriverNoShowRide` dentro de `DriverMyRidesPage`, reutilizando exactamente la misma
   lógica autoritativa de backend (`ridesService.markEnRoute`, `ridesService.markArrived`,
   `ridesService.cancelAcceptedRide`) y los mismos helpers de módulo ya compartidos
   (`saveDriverActiveRideLocalMirror`, `notifyPassengerDriverArrivedByAppAndWhatsapp`,
   `getDriverNoShowState`, `saveDriverNoShowChargeForPassenger`,
   `notifyPassengerNoShowByAppAndWhatsapp`, `markPassengerRideNoShowCancelledFromDriver`,
   `clearDriverNoShowTimer`, `clearDriverLiveLocationForPassenger`,
   `removeDriverActiveRideLocalMirror`), pero conectadas al `actionLoading`/`setActionLoading`/
   `runRideAction`/`setLoadError`/`loadRides` **propios de `DriverMyRidesPage`** (categoría B:
   handler movido/duplicado al scope correcto, modificación mínima, sin inventar lógica nueva).
4. **`driver/index.tsx`** — dentro de `AssignedRidesPage`, se eliminaron las dos llamadas
   huérfanas a `setActionLoading` en `handleDriverNoShowRide` (nunca existió tal estado en ese
   componente y ningún botón lo consumía), y se reemplazó el `try { } finally { }` vacío resultante
   por `try { } catch (err) { setError(...) }`, agregando manejo de error donde antes no existía
   ninguno (mejora estricta, sin cambiar reglas financieras ni montos).
5. **`RequestRidePage.tsx`** — se reemplazaron las dos comparaciones lógicamente muertas
   `activePaymentMethod === "card"` por el literal `false`/`null` correspondiente, con un
   comentario explicando por qué (esta rama solo se alcanza cuando el pago ya no puede ser
   `"card"`). No se cambió ningún resultado de negocio: el valor ya era siempre `false`/`null` en
   ese punto, TypeScript solo lo demostró.
6. **`TripsPage.tsx`** — misma anotación de tupla `[string, number]` aplicada a las dos copias
   del patrón (`readPassengerDriverArrivedTimerMap`, `readPassengerDriverAcceptedTimerMap`).

**No se usó `any`, `@ts-ignore`, `@ts-nocheck`, ni funciones vacías.** No se inventó ninguna regla
de negocio nueva. No se tocó Wallet, pagos, `localStorage` de créditos, ni ningún archivo fuera de
los tres modificados.

## 5. Archivos modificados

```text
apps/mobile/src/pages/driver/index.tsx                              | 78 ++++++++++++++++++++--
apps/mobile/src/pages/passenger/pages/RequestRidePage.tsx           |  7 +-
apps/mobile/src/pages/passenger/pages/TripsPage.tsx                 |  4 +-
3 files changed, 79 insertions(+), 10 deletions(-)
```
Ningún cambio en `package.json`, `package-lock.json`, `apps/api`, ni en `admin/index.tsx` /
`WalletPage.tsx` (0 errores en esos dos desde el inicio).

## 6. Resultado de typecheck

```text
Antes  (ebf955c limpio, sin fix de la fase anterior): 91 errores totales, 7 introducidos por Leandro
Ahora (working tree, tras esta fase):                 80 errores totales, 0 introducidos por Leandro
```
Confirmado con `git blame` línea por línea sobre las 30 líneas de error restantes en los 5
archivos: las 30 pertenecen a commits anteriores a `ebf955c` (`af33c69`, `b2f414d`, `0a9ab20`,
`4c117ce`, `720b9ae`, `9426592`). `admin/index.tsx` y `WalletPage.tsx`: 0 errores (sin cambios,
como en el baseline).

## 7. Validación funcional

Ver detalle en la conversación (Paso 13). Resumen: ambos handlers ahora resuelven en el componente
correcto y no producen `ReferenceError`; el flujo backend-autoritativo (`markEnRoute` →
`markArrived`, `cancelAcceptedRide`) se preserva sin cambios; no se alteró ningún saldo ni lógica
de wallet. **Riesgo residual documentado:** el botón "No show" de `AssignedRidesPage` no tiene
protección de doble clic (nunca la tuvo — no es una regresión de esta fase, es preexistente al bug
de compilación).

## 8. Riesgos residuales

- Falta de protección de doble clic en el botón "No show" de `AssignedRidesPage` (ver arriba).
- Duplicación de lógica: `handleArrivedSmart`/`handleDriverNoShowRide` ahora existen en dos
  componentes con cuerpos casi idénticos. No se extrajo a un módulo compartido porque las reglas
  de esta fase prohíben refactors amplios; queda como candidato para Fase 6 (DRY) de la
  remediación mayor.
- No se validó en emulador/dispositivo real (solo `tsc` + inspección estática).
- `eslint` sigue sin estar instalado (gap preexistente, fuera de alcance).

## 9. Errores preexistentes no corregidos

30 errores en los 5 archivos (todos verificados vía `git blame` como anteriores a `ebf955c`), más
50 errores adicionales en otros archivos del proyecto (`auth.service.ts`, `admin.service.ts`,
`apiClient.ts`, etc.), para un total de 80. No se tocó ninguno, conforme a la regla 11.

## 10. Recomendación para continuar

Los 5 archivos de Leandro ya compilan sin errores propios y el flujo "Llegué"/"No show" del
conductor ya no depende de nombres inexistentes. Es seguro avanzar a Fase 2B (o a la Fase 3 de
diseño de Wallet, según se decida), mientras se mantenga pendiente la definición de negocio sobre
la política real de cancelación con tarjeta (100% reembolso vs. 30%/tope $3.000), que sigue sin
respuesta.

---

```text
FASE 2A:
ERRORES INTRODUCIDOS INICIALES: 7 (11 líneas de error)
ERRORES INTRODUCIDOS RESTANTES: 0
BUILD MOBILE: Sigue fallando (bloqueado por 80 errores preexistentes, no por cambios de Leandro)
FLUJO LLEGUÉ: Corregido — handleArrivedSmart resuelto en ambos componentes, backend-autoritativo
FLUJO NO-SHOW: Corregido — handleDriverNoShowRide resuelto en ambos componentes, backend-autoritativo
CAMBIOS FINANCIEROS: Ninguno
COMMIT: Pendiente de confirmación del usuario
APTO PARA CONTINUAR A FASE 2B: SÍ
```
