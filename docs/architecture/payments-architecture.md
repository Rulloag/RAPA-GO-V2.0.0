# Arquitectura de Pagos — RAPA GO V2.0.0

## Principio fundamental

**Los pagos se procesan exclusivamente server-side.** El cliente mobile solo inicia la intención de pago y recibe la confirmación. Nunca procesa ni confirma un pago de forma independiente.

## Abstracción PaymentProvider

Se define una interfaz `PaymentProvider` en el backend que todos los proveedores de pago deben implementar:

```typescript
interface PaymentProvider {
  createOrder(params: CreateOrderParams): Promise<PaymentOrder>;
  verifyWebhook(payload: unknown, signature: string): Promise<boolean>;
  getOrderStatus(orderId: string): Promise<PaymentStatus>;
  refund(orderId: string, amount: number): Promise<RefundResult>;
}
```

Esto permite cambiar de proveedor (o agregar múltiples) sin modificar la lógica de negocio.

## Proveedores compatibles (Chile)

| Proveedor | Estado | Uso previsto |
|-----------|--------|-------------|
| Flow | Prioritario | Pagos generales, recarga wallet |
| Transbank Webpay | Prioritario | Tarjetas nacionales |
| MercadoPago | Secundario | Turistas con cuenta MercadoPago |

## Flujo de pago estándar

```
1. Cliente → POST /payments/initiate
   Body: { amount, currency, concept, method }

2. Backend → crea registro payment (status: pending) en BD

3. Backend → llama a PaymentProvider.createOrder()

4. Backend → devuelve al cliente: { paymentUrl, paymentId }

5. Cliente → redirige/abre WebView con paymentUrl

6. Proveedor → POST /payments/webhook (backend)

7. Backend → verifica firma del webhook

8. Backend → actualiza payment status en BD (completed/failed)

9. Backend → emite evento Realtime al cliente

10. Cliente → recibe confirmación via Realtime
```

## Webhook de confirmación

- El endpoint `/payments/webhook` es público pero verifica la firma del proveedor.
- Cada proveedor tiene su propio mecanismo de verificación (HMAC, token fijo, etc.).
- El webhook es idempotente: procesar el mismo evento dos veces no duplica transacciones.
- Si el webhook llega pero el `payment_id` no existe en BD, se rechaza con log de alerta.

## Wallet

- El saldo del wallet se actualiza **solo** via backend, después de confirmar el pago.
- El cliente nunca modifica el saldo directamente.
- Toda transacción de wallet genera un registro en `wallet_transactions`.
- El saldo en BD es la única fuente de verdad. El cliente solicita el saldo actual en cada pantalla de wallet.

## Manejo de errores de pago

| Escenario | Comportamiento |
|-----------|---------------|
| Proveedor no disponible | Backend responde error, cliente muestra mensaje |
| Webhook no llega | Job de reconciliación (futuro) consulta estado al proveedor |
| Pago duplicado | Verificación de idempotencia en BD por `payment_id` |
| Fraude detectado por proveedor | Proveedor rechaza, webhook con status `failed` |

## Moneda

Todos los montos se almacenan en centavos (entero) en la base de datos para evitar errores de punto flotante. La conversión a CLP legible ocurre solo en la capa de presentación.

## Facturación y comprobantes

Los comprobantes de pago son responsabilidad del proveedor de pago. RAPA GO registra la referencia del comprobante (`receipt_url`) en la tabla `payments` para consulta posterior.
