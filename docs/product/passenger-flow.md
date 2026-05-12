# Flujo del Pasajero — RAPA GO V2.0.0

## Flujo principal: Solicitar un viaje

```
[Pantalla: /passenger/home]
  → El pasajero ve el mapa centrado en su ubicación actual.
  → Presiona "Solicitar viaje".

[Pantalla: /passenger/request-trip]
  → Ingresa destino (autocompletado via Places API).
  → El sistema muestra ruta estimada en mapa.
  → Backend consulta Distance Matrix → devuelve precio estimado y tiempo estimado.
  → Pasajero selecciona método de pago (wallet o pago externo).
  → Pasajero confirma solicitud.

[Estado: Buscando conductor]
  → Backend ejecuta matching (busca conductores disponibles cercanos).
  → Pasajero ve spinner "Buscando conductor..." con mapa activo.
  → Si no hay conductor disponible en X minutos → pantalla de error con opción reintentar.

[Estado: Conductor asignado]
  → Backend notifica via Realtime.
  → Pasajero ve nombre, foto, vehículo y calificación del conductor.
  → Pasajero ve posición del conductor acercándose en el mapa.

[Pantalla: /passenger/trip-active]
  → Mapa en tiempo real con pin del conductor.
  → Estado del viaje: "Conductor en camino" → "En tu ubicación" → "En curso".
  → Botón "Cancelar" disponible hasta que el conductor llegue (con política de cancelación).

[Estado: Viaje en curso]
  → Mapa muestra ruta activa.
  → Tiempo estimado de llegada actualizado en tiempo real.

[Estado: Viaje completado]
  → Backend calcula costo final.
  → Se debita del wallet o se genera cobro.

[Pantalla: /passenger/trip-completed]
  → Resumen: distancia, tiempo, costo.
  → Calificación del conductor (1-5 estrellas + comentario opcional).
  → Botón "Volver al inicio".
```

## Flujo: Reservar guía turístico

```
[Pantalla: /passenger/guides]
  → Lista de guías disponibles con foto, especialidades y calificación.
  → Filtros: idioma, especialidad, disponibilidad.

[Pantalla: /passenger/guides/:id]
  → Perfil completo del guía.
  → Calendario de disponibilidad.
  → Pasajero selecciona fecha/hora y cantidad de personas.
  → Sistema muestra precio total.
  → Pasajero confirma y paga.

[Confirmación]
  → Backend crea booking y procesa pago.
  → Pasajero y guía reciben notificación de confirmación.
```

## Flujo: Reservar vehículo

```
[Pantalla: /passenger/rentals]
  → Catálogo de vehículos disponibles.
  → Filtros: tipo, precio, disponibilidad.

[Pantalla: /passenger/rentals/:id]
  → Detalle del vehículo: fotos, características, tarifas.
  → Selección de fechas (inicio - fin).
  → Precio total calculado.
  → Pasajero confirma y paga.

[Confirmación]
  → Booking confirmado.
  → Pasajero recibe instrucciones de recogida del vehículo.
```

## Flujo: Wallet

```
[Pantalla: /passenger/wallet]
  → Saldo actual (obtenido del backend en cada carga).
  → Últimos movimientos.
  → Botón "Recargar".

[Pantalla: /passenger/wallet/topup]
  → Ingresa monto a recargar.
  → Selecciona método de pago.
  → Backend inicia flujo de pago.
  → Pasajero completa pago en WebView del proveedor.
  → Backend recibe webhook → actualiza saldo.
  → Pasajero recibe notificación de saldo actualizado.
```

## Estados de error que el pasajero puede encontrar

| Escenario | Mensaje visible |
|-----------|----------------|
| Sin conexión | "Sin conexión. Verifica tu red." |
| Sin conductores disponibles | "No hay conductores disponibles ahora. Intenta en unos minutos." |
| Pago rechazado | "El pago no pudo procesarse. Intenta con otro método." |
| Guía no disponible | "Este guía ya no tiene disponibilidad para la fecha seleccionada." |
| Sesión expirada | "Tu sesión expiró. Inicia sesión nuevamente." |
