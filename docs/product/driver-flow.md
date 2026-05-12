# Flujo del Conductor — RAPA GO V2.0.0

## Precondición

El conductor debe estar **aprobado por el administrador** antes de poder operar. Sin aprobación, el perfil está en estado `pending` y no puede activarse.

## Flujo principal: Activar disponibilidad y recibir viajes

```
[Pantalla: /driver/home]
  → Toggle "Estoy disponible" en OFF.
  → Conductor activa toggle → backend actualiza su estado a disponible.
  → Mapa muestra su posición actual.
  → Conductor espera solicitudes entrantes.

[Estado: Solicitud entrante]
  → Backend asigna viaje via matching.
  → Push notification + pantalla /driver/trip-request.

[Pantalla: /driver/trip-request]
  → Nombre del pasajero, origen, destino, distancia estimada, ganancia estimada.
  → Temporizador de 30 segundos para aceptar/rechazar.
  → Botón "Aceptar" → confirma viaje.
  → Botón "Rechazar" → viaje vuelve al pool de matching.

[Estado: Viaje aceptado]
  → Backend notifica al pasajero.
  → Conductor ve ruta hacia el pasajero en el mapa.
  → Comienza a enviar su ubicación GPS al backend cada 3-5 segundos.

[Pantalla: /driver/trip-active]
  → Estado: "Dirigiéndome al pasajero".
  → Al llegar: botón "He llegado al pasajero".
  → Estado cambia a "En tu ubicación" para el pasajero.
  → Pasajero sube al vehículo: botón "Iniciar viaje".
  → Estado: "En curso".
  → Al llegar al destino: botón "Completar viaje".

[Pantalla: /driver/trip-completed]
  → Resumen: distancia real, tiempo real, ganancia neta.
  → Calificación del pasajero (1-5 estrellas).
  → El conductor vuelve a estado disponible automáticamente.
```

## Flujo: Gestión de ganancias

```
[Pantalla: /driver/earnings]
  → Saldo disponible en wallet (del backend).
  → Ganancias del día, semana, mes.
  → Historial detallado de viajes y montos.
  → Botón "Solicitar retiro" (flujo futuro: transferencia bancaria).
```

## Flujo: Gestión de perfil y vehículo

```
[Pantalla: /driver/profile]
  → Foto de perfil.
  → Datos personales editables.
  → Datos del vehículo: patente, modelo, año, color.
  → Documentos: licencia, seguro, revisión técnica.
  → Calificación promedio y número de viajes.
  → Estado de aprobación visible.
```

## Estados del conductor

| Estado | Descripción |
|--------|-------------|
| `pending_approval` | Esperando revisión administrativa |
| `approved_offline` | Aprobado, pero no disponible actualmente |
| `available` | Disponible para recibir viajes |
| `in_trip` | Con viaje activo en curso |
| `suspended` | Suspendido por administración |

## Reglas de negocio del conductor

- Un conductor no puede tener más de un viaje activo simultáneamente.
- Si rechaza 3 solicitudes consecutivas, se le pregunta si quiere desactivar disponibilidad.
- La posición GPS solo se envía cuando el estado es `available` o `in_trip`.
- Al completar un viaje, el pago se acredita al wallet del conductor, menos la comisión de RAPA GO.

## Cancelación de viaje por el conductor

- Solo permitida antes de que el pasajero suba al vehículo.
- Requiere seleccionar motivo.
- Si cancela con frecuencia, puede afectar su calificación y disponibilidad.
