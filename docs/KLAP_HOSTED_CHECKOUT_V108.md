# Klap V108 — Checkout alojado con `redirect_url`

## Objetivo

RAPA GO deja de depender del SDK `checkout-frictionless`, de
`KLAP.payOrder()`, de Cardinal cargado por la aplicación y de la observación
interna de `/cards/receipt`.

El flujo V108 sigue el contrato de las APIs que Klap entregó:

1. El backend crea la orden con `POST /payment-gateway/v1/orders`.
2. Klap responde con `order_id`, `status` y `redirect_url`.
3. El frontend valida el host y abre el `redirect_url` alojado por Klap.
4. Klap regresa por `return_url` o `cancel_url`.
5. Los webhooks `confirm` y `reject` continúan como autoridad principal.
6. Como respaldo, el backend consulta `GET /payment-gateway/v1/orders/{order_id}`.
7. RAPA GO valida `order_id`, `reference_id`, monto y moneda antes de aprobar.

RAPA GO no captura ni almacena PAN, fecha de vencimiento o CVV.

## Variables requeridas en Hostinger

No copies valores de producción a Git. Configúralos únicamente en el entorno:

```env
KLAP_ENVIRONMENT=sandbox
KLAP_API_KEY=<SECRETO_KLAP>

KLAP_SANDBOX_ORDERS_URL=https://api-pasarela-sandbox.mcdesaqa.cl/payment-gateway/v1/orders
KLAP_RETURN_URL=https://backend.rapago.cl/api/payments/return/klap
KLAP_CANCEL_URL=https://backend.rapago.cl/api/payments/cancel/klap
KLAP_WEBHOOK_CONFIRM_URL=https://backend.rapago.cl/api/webhooks/klap/confirm
KLAP_WEBHOOK_REJECT_URL=https://backend.rapago.cl/api/webhooks/klap/reject
KLAP_WEBHOOK_VALIDATION_URL=https://backend.rapago.cl/api/webhooks/klap/validate

KLAP_ORDER_EXPIRATION_MINUTES=30
KLAP_REQUEST_TIMEOUT_MS=10000
KLAP_SEND_IDEMPOTENCY_HEADER=false
```

`VITE_KLAP_CHECKOUT_SCRIPT_URL` deja de utilizarse en V108. Puede permanecer
temporalmente en el entorno, pero el frontend ya no carga ese script.

## Rutas nuevas o ajustadas

```text
POST /api/payments/klap/orders
POST /api/payments/:paymentId/reconcile/klap
GET  /api/payments/return/klap
GET  /api/payments/cancel/klap
GET  /api/payments/:paymentId/status
```

Se conservan los webhooks existentes:

```text
POST /api/webhooks/klap/confirm
POST /api/webhooks/klap/reject
GET/POST /api/webhooks/klap/validate
```

También se mantienen aliases históricos definidos en `payments.routes.ts`.

## Reglas contra dobles cobros

- Una orden activa no se reemplaza únicamente porque haya pasado el tiempo local.
- Antes de crear otra orden, el backend consulta el estado oficial de la anterior.
- Si Klap informa aprobación, el viaje se activa y no se crea un cobro nuevo.
- Si Klap informa estado pendiente o desconocido, se reutiliza el enlace existente
  o se bloquea el nuevo intento.
- Solo una orden oficialmente rechazada, cancelada o expirada permite continuar
  con una orden nueva.
- Un retorno del navegador nunca aprueba el pago por sí solo.

## Estado remoto

Los Swagger entregados no muestran en las capturas el enum completo de estados.
V108 usa un mapeo conservador:

- Aprobado: `approved`, `success`, `paid`, `completed`, `confirmed`.
- Rechazado/terminal: `rejected`, `failed`, `cancelled`, `canceled`,
  `expired`, `voided`, `refunded`.
- Pendiente: `pending`, `processing`, `created`, `in_process`, `in-process`.
- Cualquier valor desconocido permanece pendiente y no activa el viaje.

Klap debe confirmar durante la reunión el enum exacto de estados.

## `webhook_validation`

Klap Checkout (incluido Google Pay) consulta `webhook_validation` con GET
antes de confirmar el pago. Si esa URL no existe o solo admite POST, el
checkout aborta con `500001 Request method 'GET' is not supported`.

V108 envía `webhook_validation` en la orden y responde `{"status":"ok"}` a
GET/POST en `/api/webhooks/klap/validate`. Un GET a confirm/reject también
responde 200 de conectividad y **nunca** marca el pago como cobrado.

## Validación después de instalar

```powershell
npm run test --workspace=apps/api -- --run `
  src/modules/payments/__tests__/klap.provider.test.ts `
  src/modules/payments/__tests__/paymentsService.klap.test.ts `
  src/modules/payments/__tests__/KlapSandboxRecoveryRegression.test.ts

npm run test --workspace=apps/mobile -- --run `
  src/features/payments/__tests__/KlapCheckoutFrontend.test.ts

npm run typecheck --workspace=apps/api
npm run typecheck --workspace=apps/mobile
git diff --check
```

No hagas `commit`, `push` ni merge a `main` hasta probar una orden nueva en
sandbox y confirmar con Klap que el comercio debe usar el `redirect_url`.
