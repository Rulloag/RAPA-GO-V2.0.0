# ADR-0006: Abstracción de Proveedor de Pagos (PaymentProvider)

**Estado**: Aprobado
**Fecha**: 2026-05-11
**Autor**: Rodrigo Alexander Ulloa González

## Contexto

RAPA GO requiere integrar pagos en línea con proveedores locales de Chile (Flow, Transbank, MercadoPago). Cada proveedor tiene una API distinta. Se debe decidir cómo estructurar esta integración para que sea mantenible y extensible.

## Decisión

Se implementa una interfaz abstracta `PaymentProvider` en el backend. Cada proveedor de pago es una implementación concreta de esta interfaz. La lógica de negocio (crear orden, verificar pago, reembolsar) interactúa solo con la interfaz, no con el proveedor concreto.

```typescript
// Interfaz abstracta (en backend/src/providers/payment-provider.interface.ts)
interface PaymentProvider {
  readonly name: string;
  createOrder(params: CreateOrderParams): Promise<PaymentOrder>;
  verifyWebhook(payload: unknown, signature: string): Promise<boolean>;
  getOrderStatus(orderId: string): Promise<PaymentStatus>;
  refund(orderId: string, amount?: number): Promise<RefundResult>;
}

// Implementaciones concretas
class FlowPaymentProvider implements PaymentProvider { ... }
class TransbankPaymentProvider implements PaymentProvider { ... }
class MercadoPagoPaymentProvider implements PaymentProvider { ... }

// El handler de pagos usa la interfaz
const provider = paymentProviderFactory.get(method); // 'flow' | 'transbank' | 'mercadopago'
const order = await provider.createOrder(params);
```

## Motivo

1. **Cambio de proveedor sin cambiar lógica de negocio**: Si Flow cambia su API o se decide agregar un nuevo proveedor, solo se modifica o agrega la implementación concreta.
2. **Multi-proveedor simultáneo**: Distintos usuarios pueden usar distintos proveedores. El factory elige el correcto según la selección del usuario.
3. **Testing**: La interfaz permite mockear el proveedor en tests sin llamar APIs reales.
4. **Cumplimiento legal Chile**: Todos los proveedores soportados (Flow, Transbank, MercadoPago) están habilitados para operar en Chile y son compatibles con CLP.

## Proveedor prioritario para V2.0.0

**Flow** es el proveedor principal para el lanzamiento. Transbank Webpay es el segundo. MercadoPago se integra si hay demanda de usuarios con cuenta MercadoPago.

## Webhook de cada proveedor

Cada proveedor tiene su endpoint de webhook dedicado en el backend:
- `POST /payments/webhook/flow`
- `POST /payments/webhook/transbank`
- `POST /payments/webhook/mercadopago`

Cada endpoint verifica la firma específica del proveedor antes de procesar.

## Consecuencias

- Requiere implementar y mantener múltiples adaptadores.
- Los proveedores tienen modelos de datos distintos (URLs de retorno, formatos de webhook). Los adaptadores absorben esta diferencia.
- El campo `provider` en la tabla `payments` registra qué proveedor procesó cada transacción.

## Alternativas descartadas

- **Integración directa con un solo proveedor**: Acoplamiento alto. Cambiar de proveedor implicaría refactorizar toda la capa de pagos.
- **Plataforma de pagos unificada (ej. Stripe)**: Stripe no opera directamente en Chile con todos los métodos de pago locales. Los proveedores chilenos son necesarios para el mercado objetivo.
