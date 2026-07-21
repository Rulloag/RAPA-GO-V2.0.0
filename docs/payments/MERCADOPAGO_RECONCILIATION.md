# Mercado Pago — conciliación, webhook y comprobantes

## Fuente de verdad

La tabla de pagos del backend es la fuente de verdad interna. Mercado Pago actúa como proveedor externo y sus identificadores se conservan para conciliación.

## Reglas implementadas

1. Cada pago conserva propósito, monto, moneda, estado, proveedor e identificadores externos.
2. El webhook valida su firma antes de modificar el estado interno.
3. Cada evento se identifica mediante referencia del proveedor o hash estable del contenido.
4. Los eventos se registran en `payment_webhook_events` con estado de procesamiento, intentos, error y marcas de tiempo.
5. Un evento ya completado no vuelve a aplicar el pago.
6. Un evento fallido puede reintentarse sin duplicar el efecto financiero.
7. El monto y la moneda informados por el proveedor se comparan con la orden interna.
8. El endpoint de estado entrega referencias, reembolso y fechas relevantes.
9. El endpoint de comprobante entrega una representación conciliable del pago sin datos de tarjeta.

## Estados y excepciones

- La aprobación del proveedor no debe activar más de una vez el mismo beneficio o viaje.
- Un monto o moneda incompatibles genera error de conciliación y no se normaliza como pago aprobado.
- Los reembolsos y contracargos se registran de forma separada del pago original.
- Nunca se almacenan PAN completo, CVV ni credenciales del comprador.

## Evidencia técnica

- Servicio: `apps/api/src/modules/payments/payments.service.ts`.
- Persistencia y eventos: `apps/api/src/modules/payments/payments.repository.ts`.
- Rutas de estado, comprobante y webhook: `apps/api/src/modules/payments/payments.routes.ts`.
- Esquema de eventos: `apps/api/src/db/schema/paymentWebhookEvents.schema.ts`.
- Migración: `apps/api/src/db/migrations/0038_final_matrix_19_24.sql`.

**Estado del punto 23:** completado técnicamente, sujeto a prueba final con credenciales productivas y un pago controlado.
