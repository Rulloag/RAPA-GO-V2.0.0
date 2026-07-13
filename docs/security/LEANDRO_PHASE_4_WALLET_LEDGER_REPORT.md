# FASE 4 — Diseño e implementación del ledger autoritativo de créditos (backend)

Rama: `security/remediation-leandro-wallet`. Clasificación de origen: **CRÍTICO — BLOQUEANTE
PARA MERGE**. Estado tras esta fase: **backend resuelto, frontend pendiente** (ver §6).

## PASO 1 — Decisión de negocio

```text
DECISIÓN DE NEGOCIO PENDIENTE
```

No se definió (ni en esta fase ni en las anteriores, pese a haberse preguntado explícitamente en
Fase 2B) la política real de: porcentaje/monto exacto de penalización por cancelación, tope
máximo, vigencia/expiración de un crédito, y si la política de "reembolso 100% actual vía
MercadoPago" (confirmada en el código real, Fase 2B/3) coexiste o reemplaza al "30% con tope
$3.000 → crédito" que promete la UI de Leandro. **No se inventó ninguna regla financiera.** El
ledger diseñado en esta fase es **agnóstico a esa política**: no calcula porcentajes ni topes por
sí mismo — solo permite que un admin proponga un `amountClp` concreto (con motivo obligatorio) y
que otro admin lo apruebe. La política de cuánto crédito otorgar ante cada evento de cancelación
sigue siendo una decisión pendiente que un futuro `CancellationPolicyService` deberá calcular; este
ledger es la infraestructura que recibiría ese cálculo, no el cálculo en sí.

## PASO 2 — Diseño del ledger

Tabla nueva `wallet_transactions_ledger` (`apps/api/src/db/schema/walletTransactions.schema.ts`,
migración `apps/api/src/db/migrations/0028_wallet_transactions_ledger.sql`, **NO aplicada** — ver
§7):

```text
id, wallet_id, user_id, ride_id, payment_id, applied_to_ride_id,
type, source, amount_clp, currency, status, approval_status,
idempotency_key (UNIQUE), created_by, approved_by,
created_at, approved_at, applied_at, expires_at, reversed_at, metadata
```

- `type`: `credit | debit | refund | adjustment | reversal`
- `source`: `cancellation | no_show | admin | payment_refund | ride_payment | promotion`
- `status`: `pending | available | applied | rejected | expired | reversed`
- `CHECK (amount_clp > 0)` a nivel de base de datos (defensa en profundidad, no solo Zod)
- Las reversas se modelan como **nuevos movimientos** (`type=reversal`), nunca como edición
  destructiva de un movimiento existente (regla explícita del Paso 3). El endpoint de reversa en
  sí **no se implementó** en esta fase (ver §6 — no estaba en la lista mínima de endpoints del
  Paso 4, y no había casos de uso concretos definidos para priorizarlo sin la decisión de negocio).

## PASO 3 — Reglas de integridad implementadas

- Montos enteros CLP, `amountClp > 0` (Zod + `CHECK` SQL).
- `idempotencyKey` única (`UNIQUE` en DB) — tanto para creación de crédito como para su
  aplicación.
- Relaciones FK con `users`, `wallets`, `ride_requests`, `payments`.
- **Transacciones SQL**: primer uso de `db.transaction(...)` en todo el codebase (no existía
  ningún precedente — confirmado por `grep -rn "db.transaction(" apps/api/src` antes de esta
  fase). Se usa en `WalletTransactionsRepository.applyAvailableCredit`.
- **Bloqueo contra doble aplicación**: el `UPDATE ... WHERE status = 'available'` es atómico a
  nivel de fila en Postgres — una segunda solicitud concurrente que intente aplicar el mismo
  crédito encuentra 0 filas afectadas y la operación se rechaza, sin necesidad de locks
  explícitos adicionales.
- Auditoría de creación (`createdBy`) y aprobación (`approvedBy`) en cada fila.
- Transiciones de estado válidas verificadas en el servicio antes de cada `UPDATE` (p. ej. no se
  puede aprobar algo que no está `pending`).
- El saldo (`getAvailableBalance`) se calcula siempre con `SUM(amount_clp) WHERE status =
  'available'` a partir de los movimientos — **nunca** se guarda como un número mutable único
  (cumple regla 6 explícita del encargo).

## PASO 4 — Endpoints implementados

```text
GET  /wallets/me/credits                          (pasajero, ownership implícito por token)
POST /wallets/apply-credit                         (pasajero)
POST /admin/wallet-transactions                     (admin)
POST /admin/wallet-transactions/:id/approve         (admin, no puede ser el creador)
POST /admin/wallet-transactions/:id/reject          (admin)
```

Archivos: `walletTransactions.routes.ts`, `walletTransactions.controller.ts`,
`walletTransactions.service.ts`, `walletTransactions.repository.ts`, registrados en `app.ts`.

Controles por endpoint:
- Autenticación: mismo `authenticate()` (JWT + sesión válida) que el resto del módulo Wallet.
- Autorización: `isFinancialAdmin(role)` bloquea los 3 endpoints `/admin/*` a no-admins.
- Ownership: `applyCredit` verifica `credit.userId === auth.userId` antes de aplicar.
- Idempotencia: `idempotencyKey` obligatoria en creación y aplicación; una repetición retorna el
  mismo resultado sin duplicar efectos (`idempotentReplay: true`).
- Auditoría: cada fila registra quién creó/aprobó/rechazó.
- Rate limiting: **no se agregó uno específico para estos endpoints** — el proyecto ya tiene
  `@fastify/rate-limit` como dependencia global (confirmado en Fase 1), se asume que la
  configuración global de Fastify ya cubre estas rutas; no se verificó su alcance exacto en esta
  fase (EVIDENCIA INSUFICIENTE puntual, no bloqueante).
- Concurrencia: cubierta por el `UPDATE ... WHERE status='available'` atómico (Paso 3).

## PASO 5 — Aplicación del crédito

Implementado en `WalletTransactionsRepository.applyAvailableCredit` dentro de una única
`db.transaction`: valida disponibilidad (`status='available'`), vigencia (`expiresAt` chequeado
en el servicio antes de invocar el repositorio), ownership, marca el crédito como `applied` y
crea el movimiento de débito vinculado al viaje (`appliedToRideId`) — todo en una sola
transacción. Confirmado con test (`walletTransactions.repository.test.ts`) que si la inserción
del débito falla, la promesa se rechaza (Postgres revierte el `UPDATE` previo automáticamente al
hacer rollback de la transacción).

## PASO 6 — Administración y PASO 7 — Frontend: **NO IMPLEMENTADO EN ESTA FASE**

Esta es la limitación más importante de esta fase y debo ser explícito al respecto:

- El panel admin (`apps/mobile/src/pages/admin/index.tsx`, ~10.000+ líneas) sigue leyendo y
  escribiendo `rapago_wallet_benefits_v1` en `localStorage` — **no fue migrado** para consumir los
  nuevos endpoints `/admin/wallet-transactions*`.
- El frontend de pasajero (`WalletPage.tsx`, `TripsPage.tsx`, `RequestRidePage.tsx`) sigue
  generando, leyendo y aplicando créditos localmente vía `localStorage` — **no fue migrado** para
  usar `GET /wallets/me/credits` / `POST /wallets/apply-credit`.
- **Razón de no hacerlo en esta pasada**: son 4 archivos de varios miles de líneas cada uno, con
  al menos 15 funciones que leen/escriben la clave `rapago_wallet_benefits_v1` con tipados
  locales distintos por archivo (`LocalWalletBenefit`, `AdminWalletBenefit`,
  `PassengerWalletBenefitForRequest`). Reescribir esto de forma segura requiere: (a) mapear cada
  punto de lectura/escritura, (b) decidir una estrategia de UI para estados de carga/error de red
  que hoy no existen (todo es síncrono desde localStorage), y (c) probarlo funcionalmente en la
  app real — nada de esto es seguro de ejecutar sin una sesión dedicada y, idealmente, sin la
  política de negocio del Paso 1 ya definida (para saber qué mensajes/estados mostrar). Hacerlo
  de forma apresurada arriesgaba introducir regresiones reales en un flujo que maneja dinero.

**Consecuencia de seguridad importante**: mientras el frontend no se migre, `localStorage` sigue
siendo la única fuente que el pasajero/admin *ven y usan* en la app — el ledger backend nuevo
existe y es seguro, pero **no está conectado a ninguna pantalla todavía**. Un atacante que forje
`rapago_wallet_benefits_v1` seguirá viendo un "crédito falso" en su UI (aunque ese crédito nunca
podrá cobrarse contra el backend real una vez que el frontend use los nuevos endpoints — lo cual
todavía no ocurre).

## PASO 8 — Datos legacy

No aplica todavía (no se implementó ninguna migración automática de `localStorage` a saldo real —
correctamente, según la regla 2 del encargo). Cuando se haga la migración del frontend (Paso 7,
pendiente), la recomendación es: **ignorar** los datos antiguos de `localStorage` (no
convertirlos a créditos reales bajo ninguna circunstancia) y, opcionalmente, mostrar un aviso
informativo al pasajón indicando que debe contactar soporte si cree tener un crédito pendiente de
antes de la migración — sin acreditar nada automáticamente.

## PASO 9 — Pruebas

Dos archivos nuevos, 18 pruebas, todas backend (no se pudo probar `localStorage` adulterado desde
`apps/mobile` porque ese workspace no tiene test runner configurado — confirmado en Fase 1 —, así
que la prueba equivalente se hizo a nivel de contrato: confirmar que los DTOs Zod del backend ni
siquiera tienen un campo `status`/`adminReviewStatus` que un cliente pudiera enviar):

`apps/api/src/modules/wallet/__tests__/walletTransactions.service.test.ts` (15 pruebas):
- Crédito válido creado por admin → estado `pending`.
- Rechaza creación por no-admin (403).
- Idempotencia de creación (misma `idempotencyKey` no duplica).
- **Imposibilidad de autoaprobar**: el admin creador no puede aprobar su propio crédito (403
  `AUTH_SELF_APPROVAL_FORBIDDEN`).
- Un admin distinto sí puede aprobar.
- Rechaza aprobar/reaprobar un crédito que no está `pending` (incluye el caso explícito "un
  crédito rechazado no puede reaparecer como disponible").
- Aplicación de crédito disponible propio → éxito.
- Rechaza aplicar un crédito de otro usuario (403).
- Rechaza un crédito vencido (409 `WALLET_TX_EXPIRED`).
- **Doble aplicación**: si el repositorio indica que la fila ya no está `available`, rechaza con
  409 `WALLET_TX_NOT_AVAILABLE`.
- Idempotencia de aplicación (misma `idempotencyKey` no vuelve a debitar).
- `localStorage` adulterado (proxy de contrato): el payload forjado
  `{status:"available", adminReviewStatus:"admin_approved", amountClp:999999999}` se parsea con
  Zod y esos campos simplemente **no existen** en el objeto resultante — el backend nunca podría
  leerlos aunque quisiera.

`apps/api/src/modules/wallet/__tests__/walletTransactions.repository.test.ts` (3 pruebas):
- Aplicación exitosa dentro de una transacción.
- Doble aplicación (UPDATE afecta 0 filas) → `null`, sin insertar débito.
- **Rollback**: si la inserción del débito falla, la transacción completa se rechaza.

```text
Test Files  2 passed (2)
     Tests  18 passed (18)
```

Suite completa del API tras esta fase: **71/73** (mismos 2 fallos preexistentes de
`payments.service.test.ts`/`mercadopago.provider.test.ts`, sin regresiones). Typecheck: 31
errores `TS4111` preexistentes, ninguno nuevo. Build: mismo resultado preexistente.

## PASO 10 — Commits (propuestos, pendientes de tu confirmación)

```text
feat(api): add authoritative wallet credit ledger
test(security): prevent wallet credit tampering and double use
docs(security): document wallet ledger remediation
```

**No se crea** el commit `fix(mobile): remove local wallet financial authority` — no se tocó
ningún archivo de `apps/mobile` en esta fase, según lo explicado en §6.

## Archivos nuevos/modificados

```text
apps/api/src/db/schema/walletTransactions.schema.ts          (nuevo)
apps/api/src/db/migrations/0028_wallet_transactions_ledger.sql (nuevo, NO aplicada — ver abajo)
apps/api/src/db/schema/index.ts                                (export agregado)
apps/api/src/modules/wallet/walletTransactions.schemas.ts      (nuevo)
apps/api/src/modules/wallet/walletTransactions.repository.ts   (nuevo)
apps/api/src/modules/wallet/walletTransactions.service.ts      (nuevo)
apps/api/src/modules/wallet/walletTransactions.controller.ts   (nuevo)
apps/api/src/modules/wallet/walletTransactions.routes.ts       (nuevo)
apps/api/src/app.ts                                             (registro de rutas)
apps/api/src/modules/wallet/__tests__/walletTransactions.service.test.ts    (nuevo)
apps/api/src/modules/wallet/__tests__/walletTransactions.repository.test.ts (nuevo)
```

**Migración NO aplicada**: siguiendo la regla "no modificar producción", el archivo SQL fue
escrito (mismo formato que las 27 migraciones manuales previas del repo) pero **no se ejecutó**
`npx drizzle-kit migrate` ni `migrate-prod.ts` contra ninguna base de datos. Debe aplicarse a
través del pipeline de deploy normal del equipo, después de revisión.

## Riesgos residuales / críticos abiertos

1. **Frontend no migrado** (§6) — el ledger backend existe pero no está conectado a ninguna
   pantalla. Mientras esto no se resuelva, el sistema de créditos que el usuario final experimenta
   sigue siendo el de `localStorage`, inseguro.
2. **Migración de base de datos sin aplicar** — requiere ejecución manual/CI antes de que
   cualquiera de estos endpoints funcione contra una base de datos real.
3. **Política de negocio pendiente** (§1) — sin esto, ningún admin sabe qué `amountClp` debería
   proponer al crear un crédito por cancelación.
4. Endpoint de reversa (`type=reversal`) diseñado en el esquema pero no implementado — sin caso
   de uso concreto todavía.
5. Rate limiting específico para estos endpoints no verificado (solo se asume la configuración
   global de Fastify).

---

```text
FASE 4:
LEDGER BACKEND: SÍ
LOCALSTORAGE AUTORITATIVO: SÍ — sigue siéndolo en el frontend, que no fue migrado en esta fase
IDEMPOTENCIA: SÍ (creación y aplicación de créditos)
DOBLE APLICACIÓN BLOQUEADA: SÍ (a nivel de backend, verificado con tests de transacción)
ADMIN Y PASAJERO COMPARTEN FUENTE: SÍ, a nivel de backend — NO todavía en la experiencia real de
  la app, porque el frontend no consume estos endpoints aún
PRUEBAS DE MANIPULACIÓN: PASAN (18/18 nuevas, 71/73 con preexistentes sin regresión)
RIESGOS CRÍTICOS ABIERTOS: 1 (frontend sigue usando localStorage como fuente real — §6)
COMMITS: 3 propuestos (feat/test/docs), pendientes de tu confirmación
APTO PARA MERGE: NO — el backend está listo y probado, pero mientras el frontend no se migre
  (Fase 4B, fuera de esta pasada) la vulnerabilidad original (créditos falsificables vía
  localStorage) sigue presente en la experiencia real de usuario, aunque ya no podría cobrarse
  contra un backend que la migración conectaría de forma segura.
```

No se hizo push ni merge.
