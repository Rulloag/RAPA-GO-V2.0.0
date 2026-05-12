# ADR-0005: Backend como Única Fuente de Verdad en Tiempo Real

**Estado**: Aprobado
**Fecha**: 2026-05-11
**Autor**: Rodrigo Alexander Ulloa González

## Contexto

En una app de transporte, múltiples clientes (pasajero, conductor) necesitan ver el mismo estado del mundo (posición del conductor, estado del viaje) en tiempo real. Se debe definir quién tiene autoridad sobre ese estado y cómo se distribuye.

## Decisión

**El backend y la base de datos son la única fuente de verdad.** Los clientes solo reciben proyecciones del estado actual via WebSocket gestionado por el backend o Supabase Realtime (si Supabase es el proveedor activo). Ningún cliente puede proclamar unilateralmente un cambio de estado sin que el backend lo valide y persista.

## Flujo correcto

```
Cliente (conductor) → POST /trips/:id/location
  → Backend valida que el conductor es el asignado al viaje
  → Backend persiste en trip_locations
  → Supabase Realtime emite el cambio
  → Cliente (pasajero) recibe la actualización

NO CORRECTO:
  → Conductor emite directamente a Supabase Realtime sin pasar por backend
  → Cualquier cliente puede escribir cualquier estado
```

## Por qué el cliente no escribe directamente a la base de datos ni al sistema de Realtime

Si el cliente pudiera escribir directamente (Supabase client insert/update, o WebSocket sin validación backend), se pierde la validación de lógica de negocio.

La regla invariante es:
- **Lectura/Suscripción**: El cliente recibe actualizaciones via WebSocket o Supabase Realtime (si el proveedor lo incluye).
- **Escritura**: Solo via API del backend. El backend valida, persiste y el sistema de Realtime distribuye el cambio.

Esta regla aplica independientemente del proveedor de base de datos o infraestructura elegido.

## Consecuencias

- Mayor latencia de escritura (cliente → backend → BD → Realtime → cliente) vs escritura directa a Supabase. Aceptable para este dominio.
- El backend es un cuello de botella crítico. Debe ser resiliente.
- Si el backend cae, los clientes no pueden actualizar estado. Los clientes deben mostrar indicador de pérdida de conexión.

## Reconexión y resincronización

Al reconectar (pérdida de red, background/foreground de la app), el cliente debe:
1. Solicitar el estado actual al backend via HTTP.
2. Reestablecer suscripción Realtime.
3. Descartar cualquier estado local que pueda estar desactualizado.

No se debe asumir que el estado local sigue siendo válido después de una reconexión.
