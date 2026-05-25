# Integración Proveedor de Pagos — Rapa Go

## Nuestra arquitectura

- **Backend:** Node.js/Fastify en Railway
- **DB:** PostgreSQL — tablas `wallets`, `transactions`, `payment_orders`
- **Webhook endpoint:** `POST /api/payments/webhook`
- **Moneda:** CLP (pesos chilenos), montos en **centavos** (integer)

## Lo que necesitamos del proveedor

1. API Key sandbox + API Key producción
2. Webhook secret (para validar firma HMAC)
3. Documentación de endpoints REST
4. Sandbox para pruebas de integración
5. Webhooks que envíen:
   - `payment.success`
   - `payment.failed`
   - `payment.refunded`
   - `payment.dispute`

## Lo que enviamos nosotros

```json
{
  "orderId":     "uuid-interno",
  "amount":      1500000,
  "currency":    "CLP",
  "description": "Viaje Rapa Go Hanga Roa → Anakena",
  "returnUrl":   "https://rapago.cl/payment/success",
  "cancelUrl":   "https://rapago.cl/payment/cancel",
  "metadata": {
    "rideId":    "uuid-del-viaje",
    "userId":    "uuid-del-usuario"
  }
}
```

> Los montos van en centavos: 1.500 CLP = `150000` centavos.

## Flujo completo

```
Passenger solicita viaje
        │
        ▼
Backend crea payment_order (status='pending')
        │
        ▼
Responde al cliente con { paymentUrl }
        │
        ▼
Passenger es redirigido a página del proveedor
        │
        ▼
Passenger paga
        │
        ▼
Proveedor envía POST /api/payments/webhook
        │
        ▼
Backend valida firma HMAC con PAYMENT_WEBHOOK_SECRET
        │
   ┌────┴────┐
  ok?       no
   │         │
   ▼         ▼
Acreditar   Log error
wallet      + 400
   │
   ▼
Marcar ride como 'paid'
Enviar notificación al driver
```

## Variables de entorno necesarias

```bash
PAYMENT_PROVIDER_API_KEY=       # API key del proveedor
PAYMENT_PROVIDER_SECRET=        # Secret para operaciones firmadas
PAYMENT_WEBHOOK_SECRET=         # Secret para validar firma de webhooks
PAYMENT_ENVIRONMENT=sandbox     # sandbox | production
```

## Tablas DB ya preparadas

### `payment_orders`
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | ID interno |
| `user_id` | UUID | Pasajero |
| `ride_id` | UUID | Viaje asociado |
| `amount` | INTEGER | En centavos |
| `currency` | TEXT | "CLP" |
| `status` | TEXT | pending / completed / failed / refunded |
| `provider` | TEXT | Nombre del proveedor |
| `provider_order_id` | TEXT | ID del proveedor |
| `payment_url` | TEXT | URL de pago generada |
| `expires_at` | TIMESTAMPTZ | Expiración del link |
| `completed_at` | TIMESTAMPTZ | Timestamp de pago |

### `transactions`
| Campo | Tipo | Descripción |
|---|---|---|
| `wallet_id` | UUID | Billetera del usuario |
| `type` | TEXT | credit / debit / refund |
| `amount` | INTEGER | En centavos |
| `status` | TEXT | pending / completed / failed |
| `description` | TEXT | Descripción legible |

## Proveedores candidatos (Chile)

| Proveedor | Nota |
|---|---|
| **Flow** | API REST, soporte CLP, webhooks |
| **Transbank** | API oficial Transbank, WebpayPlus |
| **MercadoPago** | Amplio soporte, checkout transparente |
| **Khipu** | Transferencia bancaria directa, ideal CLP |

## Implementación (cuando se elija proveedor)

1. Agregar variables al `.env.template`
2. Crear `apps/api/src/modules/payments/` con service + controller
3. Registrar `POST /api/payments/create-order` y `POST /api/payments/webhook`
4. Implementar validación de firma en el webhook
5. Llamar a `WalletRepository.createTransaction()` y actualizar balance
6. Notificar al driver via `notifyAsync`
