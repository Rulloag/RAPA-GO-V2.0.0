# Flujo Wallet — RAPA GO V2.0.0

## Principio fundamental

El saldo y los movimientos del wallet existen **exclusivamente en el backend y la base de datos**. El cliente solo muestra lo que el backend confirma. Nunca se almacena ni calcula saldo en el cliente.

## Cuentas wallet

Cada usuario del sistema tiene una cuenta wallet asociada creada automáticamente al registrarse. Los roles `driver`, `guide` y `rental_operator` también tienen wallet para recibir pagos.

## Flujo: Ver saldo y movimientos

```
[Pantalla: /passenger/wallet (o /driver/earnings)]
  → Al montar la pantalla: GET /wallet/balance
  → Backend devuelve: saldo actual, moneda (CLP).
  → Al hacer scroll: GET /wallet/transactions?page=1
  → Backend devuelve: historial paginado de movimientos.

Cada movimiento muestra:
  → Tipo: crédito (verde) o débito (rojo).
  → Concepto: "Viaje #123", "Recarga", "Pago guía".
  → Monto.
  → Fecha y hora.
  → Estado: completado, pendiente, revertido.
```

## Flujo: Recargar saldo (pasajero)

```
1. Pasajero ingresa monto a recargar.
2. Selecciona método de pago (Flow / Transbank / MercadoPago).
3. POST /payments/initiate → backend crea orden de pago y devuelve URL.
4. Pasajero completa pago en WebView del proveedor.
5. Proveedor llama POST /payments/webhook al backend.
6. Backend verifica firma del webhook.
7. Backend actualiza saldo en wallet_accounts (transacción PostgreSQL).
8. Backend registra movimiento en wallet_transactions.
9. Backend emite evento via Supabase Realtime.
10. App cierra WebView y muestra nuevo saldo.
```

## Flujo: Pago de servicio desde wallet

```
1. Pasajero confirma viaje/reserva.
2. Backend verifica que el saldo del pasajero >= monto del servicio.
3. Si saldo insuficiente → error "Saldo insuficiente. Recarga tu wallet."
4. Al completar el servicio:
   → Backend debita wallet del pasajero.
   → Backend acredita wallet del operador (menos comisión RAPA GO).
   → Ambos movimientos en una sola transacción PostgreSQL.
5. Ambos reciben notificación del movimiento.
```

## Flujo: Retiro de saldo (operadores)

> Este flujo es para V2.x o posterior. En V2.0.0 se documenta el diseño pero no se implementa.

```
1. Operador solicita retiro indicando monto y cuenta bancaria.
2. Backend crea solicitud de retiro en estado pending.
3. Admin aprueba la solicitud.
4. Backend inicia transferencia via proveedor bancario.
5. Al confirmar: saldo se debita del wallet del operador.
6. Operador recibe notificación de transferencia.
```

## Validaciones del wallet

| Regla | Dónde se valida |
|-------|----------------|
| Saldo suficiente para pago | Backend (siempre), Frontend (UX) |
| Monto de recarga > 0 | Backend + Zod frontend |
| Monto máximo de recarga | Backend (configuración) |
| Saldo no puede ser negativo | PostgreSQL (constraint CHECK) |

## Transacciones atómicas

Cualquier operación que modifique el saldo de más de una cuenta (pago de servicio) usa una transacción PostgreSQL. Si algún paso falla, toda la operación se revierte. No existen "pagos parciales" en el sistema.

## Tipos de movimiento en wallet_transactions

| Tipo | Descripción |
|------|-------------|
| `topup` | Recarga de saldo |
| `trip_payment` | Pago de viaje (débito pasajero) |
| `trip_income` | Ingreso por viaje (crédito conductor) |
| `booking_payment` | Pago de reserva guía/rental (débito pasajero) |
| `booking_income` | Ingreso por reserva (crédito operador) |
| `commission` | Comisión RAPA GO descontada |
| `refund` | Reembolso |
| `withdrawal` | Retiro a cuenta bancaria |
