# ADR-0005: Backend como Única Fuente de Verdad en Tiempo Real

**Estado**: Aprobado
**Fecha**: 2026-05-11
**Autor**: Rodrigo Alexander Ulloa González

## Contexto

En una app de transporte, múltiples clientes (pasajero, conductor) necesitan ver el mismo estado del mundo (posición del conductor, estado del viaje) en tiempo real. Se debe definir quién tiene autoridad sobre ese estado y cómo se distribuye.

## Decisión

**El backend y la base de datos son la única fuente de verdad.** Los clientes solo reciben proyecciones del estado actual via Supabase Realtime o WebSocket. Ningún cliente puede proclamar unilateralmente un cambio de estado sin que el backend lo valide y persista.

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

## Por qué no usar Supabase Realtime directamente desde el cliente para escritura

Supabase Realtime permite que los clientes se suscriban a cambios de tablas. Pero si los clientes también pudieran escribir directamente a las tablas (Supabase client insert/update), se pierde la validación de lógica de negocio que vive en el backend.

La solución es:
- **Lectura/Suscripción**: Supabase Realtime directo al cliente (eficiente, bajo latencia).
- **Escritura**: Solo via API del backend. El backend escribe en Supabase y Realtime distribuye el cambio.

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
