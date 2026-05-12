# Flujo del Guía Turístico — RAPA GO V2.0.0

## Precondición

El guía debe estar **aprobado por el administrador** con documentación válida (certificación de guía turístico, registro SERNATUR u equivalente).

## Flujo: Configurar perfil y servicios

```
[Pantalla: /guide/profile]
  → Foto de perfil.
  → Nombre completo, idiomas que domina.
  → Biografía y descripción de servicios.
  → Especialidades: arqueología, naturaleza, historia rapanui, etc.
  → Tarifas por persona o por grupo.
  → Documentos de habilitación (solo admin puede ver).
  → Calificación promedio visible.
```

## Flujo: Gestionar disponibilidad

```
[Pantalla: /guide/availability]
  → Calendario mensual.
  → Guía marca días y horarios disponibles.
  → Backend actualiza disponibilidad en BD.
  → Los pasajeros solo ven los slots disponibles al reservar.
```

## Flujo: Gestionar reservas

```
[Pantalla: /guide/bookings]
  → Lista de reservas: pendientes, confirmadas, completadas, canceladas.
  → Filtros por fecha.

[Pantalla: /guide/bookings/:id]
  → Detalle: pasajero, fecha, hora, cantidad de personas, monto.
  → Estado de pago (pagado/pendiente).
  → Opciones: confirmar, cancelar (con restricciones de tiempo).
  → Chat con pasajero (funcionalidad futura).
```

## Flujo: Completar servicio y cobrar

```
[Al completar el servicio guiado]
  → Guía marca reserva como completada en la app.
  → Backend verifica que la fecha de servicio haya pasado.
  → Pago se acredita al wallet del guía (menos comisión RAPA GO).
  → Pasajero recibe notificación para calificar.
```

## Flujo: Ganancias

```
[Pantalla: /guide/earnings]
  → Saldo disponible en wallet.
  → Historial de servicios y pagos recibidos.
  → Solicitar retiro (flujo futuro).
```

## Estados de una reserva de guía

| Estado | Descripción |
|--------|-------------|
| `pending` | Reserva solicitada, pago procesándose |
| `confirmed` | Pago confirmado, reserva activa |
| `completed` | Servicio realizado, pago acreditado |
| `cancelled_by_passenger` | Cancelada por el pasajero |
| `cancelled_by_guide` | Cancelada por el guía |

## Política de cancelación

- Pasajero cancela con más de 48 horas de anticipación: reembolso completo.
- Pasajero cancela con menos de 24 horas: sin reembolso (o parcial según configuración).
- Guía cancela: reembolso completo al pasajero. Penalización registrada en perfil del guía.
