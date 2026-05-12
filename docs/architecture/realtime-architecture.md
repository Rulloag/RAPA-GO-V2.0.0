# Arquitectura Tiempo Real — RAPA GO V2.0.0

## Casos de uso de tiempo real

| Caso de uso | Emisor | Receptor | Mecanismo |
|-------------|--------|----------|-----------|
| Posición del conductor en viaje activo | Conductor (mobile) | Pasajero | Supabase Realtime / WebSocket |
| Cambio de estado de viaje | Backend | Pasajero + Conductor | Supabase Realtime |
| Notificación de nueva solicitud de viaje | Backend | Conductor disponible | Supabase Realtime / Push |
| Confirmación de pago | Backend (webhook) | Pasajero | Supabase Realtime |
| Aprobación de operador | Admin via panel | Operador | Supabase Realtime / Push |
| Actualización de saldo wallet | Backend | Usuario | Supabase Realtime |

## Mecanismo principal: Supabase Realtime

Supabase Realtime permite suscribirse a cambios en tablas PostgreSQL (INSERT, UPDATE, DELETE) via WebSocket. El cliente mobile se suscribe a los canales relevantes según su contexto:

```
Pasajero en viaje activo:
  → Suscribe al canal del viaje: trips:id=<trip_id>
  → Recibe actualizaciones de estado y posición

Conductor en modo activo:
  → Suscribe a solicitudes entrantes: trip_requests:driver_id=<id>
  → Emite su posición al backend via HTTP periódico o WebSocket
```

## Mecanismo alternativo: WebSocket backend propio

Para casos donde Supabase Realtime no es suficiente (lógica de broadcasting compleja, throttling de posición), el backend Fastify puede exponer un WebSocket propio:

```
ws://api.rapago.cl/realtime
  → Autenticado con token JWT
  → Canales por tipo de evento
  → Broadcast controlado por backend
```

La decisión entre Supabase Realtime y WebSocket propio se tomará durante la fase de implementación del módulo de viajes.

## Emisión de posición del conductor

El conductor móvil emite su posición:
- Cada 3-5 segundos mientras tiene un viaje activo.
- Solo cuando hay un viaje en estado `in_progress` o `accepted`.
- El backend valida que el emisor es el conductor asignado al viaje.
- La posición se escribe en `trip_locations` y se replica via Realtime al pasajero.

## Principios

1. El cliente **suscribe**, no **pollea**. No usar `setInterval` con llamadas HTTP para actualizar estado en tiempo real.
2. El backend controla quién puede suscribirse a qué canal (autorización de canal).
3. La posición GPS nunca se almacena permanentemente sin justificación operacional.
4. Si la conexión Realtime se pierde, el cliente muestra un indicador de reconexión y no asume que el estado anterior sigue siendo válido.

## Reconexión

El cliente debe implementar reconexión automática con backoff exponencial. Supabase JS Client lo gestiona automáticamente para sus canales. Para WebSocket propio, debe implementarse en la capa de servicio del mobile.
