# Cierre y conciliación de pagos en efectivo

## Flujo definitivo

1. El conductor completa el viaje.
2. El conductor informa el monto recibido.
3. El backend verifica que el viaje esté completado, sea en efectivo y pertenezca al conductor autenticado.
4. El monto recibido no puede ser inferior a la tarifa final.
5. El backend calcula el pago de más y crea un único cierre por viaje.
6. Si el pago es exacto, el cierre queda en `paid_exact`.
7. Si existe excedente, queda en `overpayment_pending_choice` hasta que la misma cuenta elija beneficio o devolución bancaria.
8. La elección y su resolución actualizan el cierre con referencia al beneficio o devolución.
9. El administrador puede consultar y conciliar los cierres por estado.

## Controles

- Una restricción única impide dos cierres para el mismo viaje.
- Un reintento idéntico devuelve el cierre existente.
- Un reintento con un monto diferente genera conflicto.
- El conductor no decide el destino del excedente; la elección corresponde al titular que pagó.
- El frontend conserva datos locales únicamente como respaldo operativo; el backend es la fuente de verdad.

## Evidencia técnica

- Módulo `apps/api/src/modules/cashPayments`.
- Integración móvil en `apps/mobile/src/features/rides/rides.service.ts` y cierres de viaje del conductor.
- Integración con beneficios y devoluciones en los módulos `wallet` y `cashRefunds`.
- Tabla `cash_payment_closures` en la migración `0038_final_matrix_19_24.sql`.
- Pruebas unitarias en `cashPayments.service.test.ts`.

**Estado del punto 24:** completado técnicamente.
