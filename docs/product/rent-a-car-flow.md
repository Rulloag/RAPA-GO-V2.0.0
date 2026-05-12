# Flujo Rent a Car — RAPA GO V2.0.0

## Precondición

El operador de rent a car debe estar **aprobado por el administrador** con documentación válida (registro empresa, documentos del vehículo).

## Flujo: Gestionar flota de vehículos

```
[Pantalla: /rental/vehicles]
  → Lista de vehículos registrados con estado (disponible/arrendado/en mantenimiento).
  → Botón "Agregar vehículo".

[Pantalla: /rental/vehicles/new]
  → Formulario: marca, modelo, año, patente, color, descripción.
  → Subir fotos del vehículo (Supabase Storage).
  → Configurar tarifa diaria.
  → Guardar → backend crea registro en BD.

[Pantalla: /rental/vehicles/:id]
  → Editar datos del vehículo.
  → Ver calendario de reservas.
  → Marcar en mantenimiento (bloquea reservas en esas fechas).
  → Activar/desactivar vehículo.
```

## Flujo: Gestionar reservas

```
[Pantalla: /rental/bookings]
  → Lista de reservas: pendientes, activas, completadas, canceladas.

[Pantalla: /rental/bookings/:id]
  → Datos del pasajero, vehículo, fechas, monto total.
  → Estado del pago.
  → Check-in: operador confirma entrega del vehículo.
  → Check-out: operador confirma devolución del vehículo.
```

## Flujo del pasajero para arrendar

```
[Pantalla: /passenger/rentals]
  → Catálogo filtrado por disponibilidad en fechas seleccionadas.
  → Cada vehículo muestra: foto, modelo, precio/día, calificación.

[Pantalla: /passenger/rentals/:id]
  → Galería de fotos.
  → Características del vehículo.
  → Selección de fechas (date picker).
  → Precio total calculado: días × tarifa diaria.
  → Botón "Reservar y pagar".

[Confirmación]
  → Backend crea booking, inicia pago.
  → Pago confirmado via webhook → booking activo.
  → Pasajero recibe instrucciones de recogida (dirección del operador).
```

## Check-in y check-out

```
Check-in:
  → Pasajero llega a recoger el vehículo en la fecha acordada.
  → Operador marca check-in en la app.
  → El período de arriendo comienza oficialmente.

Check-out:
  → Pasajero devuelve el vehículo.
  → Operador marca check-out.
  → Si hay cargo adicional (combustible, daños), se cobra al wallet del pasajero.
  → Pasajero califica al operador. Operador califica al pasajero.
```

## Disponibilidad

- Un vehículo no puede tener dos reservas solapadas.
- El backend valida la disponibilidad antes de confirmar cualquier reserva.
- El cliente nunca asume disponibilidad; siempre la consulta al backend en tiempo real.

## Tarifas

- Tarifa base: CLP por día.
- Cargos adicionales opcionales: seguro adicional, conductor adicional.
- La tarifa es fija al momento de confirmar la reserva.

## Estados de una reserva de rent a car

| Estado | Descripción |
|--------|-------------|
| `pending` | Pago en proceso |
| `confirmed` | Pago confirmado, reserva activa |
| `in_progress` | Vehículo entregado (post check-in) |
| `completed` | Vehículo devuelto (post check-out) |
| `cancelled` | Cancelada (por pasajero u operador) |
