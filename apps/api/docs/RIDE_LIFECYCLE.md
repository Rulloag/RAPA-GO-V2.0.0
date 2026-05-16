# RAPA GO — Ciclo de vida del viaje (despacho manual)

## Modelo de negocio

Rapa Nui, primera etapa: **asignación manual por administrador/operador de servicio**.
No hay matching automático. El pasajero solicita, el admin ve la cola y asigna un conductor disponible.

---

## Estados del viaje

| Estado | Descripción |
|---|---|
| `requested` | Pasajero creó la solicitud. Sin conductor asignado. |
| `accepted` | Admin asignó conductor (reutiliza estado actual — ver nota abajo). |
| `driver_en_route` | Conductor marcó "Voy en camino" al punto de origen. *(Fase 66+)* |
| `driver_arrived` | Conductor llegó al punto de origen. *(Fase 66+)* |
| `in_progress` | Pasajero a bordo, viaje en curso hacia destino. |
| `completed` | Viaje finalizado por el conductor. |
| `cancelled` | Viaje cancelado (por pasajero, admin o conductor según reglas). |

### Nota sobre `accepted` vs `assigned`

El sistema actual usa `accepted` como estado post-asignación. Se **mantiene `accepted`** por ahora
porque:
- El schema ya existe en producción sin necesidad de migración.
- La columna `acceptedAt` y `driverUserId` ya existen.
- El admin simplemente llama a un nuevo endpoint de asignación que escribe los mismos campos.
- Si en el futuro se quiere renombrar a `assigned`, se hace con una migración controlada.

---

## Diagrama de transiciones

```
requested
    │
    │  admin asigna conductor  (POST /api/admin/rides/:id/assign)
    ▼
accepted
    │
    │  driver marca en camino  (POST /api/rides/:id/en-route)   [Fase 66]
    ▼
driver_en_route
    │
    │  driver marca llegó      (POST /api/rides/:id/arrived)    [Fase 66]
    ▼
driver_arrived
    │
    │  driver inicia viaje     (POST /api/rides/:id/start)
    ▼
in_progress
    │
    │  driver finaliza         (POST /api/rides/:id/complete)
    ▼
completed

(desde requested, accepted) → cancelled
```

---

## Tabla completa de transiciones

| Transición | De → A | Actor | Endpoint | Fase |
|---|---|---|---|---|
| Solicitar viaje | — → `requested` | passenger | `POST /api/rides/request` | ✅ Existe |
| Asignar conductor | `requested` → `accepted` | admin | `POST /api/admin/rides/:id/assign` | **Fase 65** |
| Conductor en camino | `accepted` → `driver_en_route` | driver | `POST /api/rides/:id/en-route` | Fase 66 |
| Conductor llegó | `driver_en_route` → `driver_arrived` | driver | `POST /api/rides/:id/arrived` | Fase 66 |
| Iniciar viaje | `accepted` → `in_progress` | driver | `POST /api/rides/:id/start` | ✅ Existe* |
| Finalizar viaje | `in_progress` → `completed` | driver | `POST /api/rides/:id/complete` | ✅ Existe |
| Cancelar (requested) | `requested` → `cancelled` | passenger | `POST /api/rides/:id/cancel` | ✅ Existe |
| Cancelar (accepted) | `accepted` → `cancelled` | passenger/driver | `POST /api/rides/:id/cancel-accepted` | ✅ Existe |
| Admin cancela | `requested`/`accepted` → `cancelled` | admin | `POST /api/admin/rides/:id/cancel` | **Fase 65** |
| Calificar | post-`completed` | passenger/driver | `POST /api/rides/:id/rate` | ✅ Existe |

*`start` acepta desde `accepted`; cuando se agregue `driver_en_route`/`driver_arrived` se actualiza la lógica.

---

## Endpoints existentes (reutilizables)

| Método | Ruta | Actor | Estado |
|---|---|---|---|
| `POST` | `/api/rides/request` | passenger | ✅ |
| `GET` | `/api/rides/me` | passenger | ✅ |
| `POST` | `/api/rides/:id/cancel` | passenger | ✅ |
| `POST` | `/api/rides/:id/cancel-accepted` | passenger/driver | ✅ |
| `GET` | `/api/rides/available` | driver | ✅ (muestra `requested`) |
| `POST` | `/api/rides/:id/accept` | driver | ⚠️ Usar solo para pruebas locales — en prod lo reemplaza el assign de admin |
| `POST` | `/api/rides/:id/start` | driver | ✅ |
| `POST` | `/api/rides/:id/complete` | driver | ✅ |
| `GET` | `/api/rides/driver/me` | driver | ✅ |
| `POST` | `/api/rides/:id/rate` | passenger/driver | ✅ |
| `GET` | `/api/admin/users` | admin | ✅ |
| `PATCH` | `/api/admin/users/:id/status` | admin | ✅ |
| `GET` | `/api/admin/documents` | admin | ✅ |
| `PATCH` | `/api/admin/documents/:id/review` | admin | ✅ |

---

## Endpoints nuevos — Fase 65

| Método | Ruta | Actor | Descripción |
|---|---|---|---|
| `GET` | `/api/admin/rides` | admin | Cola de viajes + filtros por estado |
| `POST` | `/api/admin/rides/:id/assign` | admin | Asignar conductor a un viaje `requested` |
| `POST` | `/api/admin/rides/:id/cancel` | admin | Cancelar viaje en cualquier estado activo |

Payload de assign:
```json
{ "driverUserId": "<uuid>" }
```

---

## Endpoints nuevos — Fase 66 (estados intermedios de conductor)

| Método | Ruta | Actor | Descripción |
|---|---|---|---|
| `POST` | `/api/rides/:id/en-route` | driver | `accepted` → `driver_en_route` |
| `POST` | `/api/rides/:id/arrived` | driver | `driver_en_route` → `driver_arrived` |

Requiere columnas nuevas en DB:
- `en_route_at TIMESTAMPTZ`
- `arrived_at TIMESTAMPTZ`
- `start` deberá aceptar desde `driver_arrived` (además de `accepted` legacy)

---

## Responsabilidades por rol

### Passenger
- Crear solicitud con origen/destino/notas
- Ver estado actual del viaje (polling o refresh)
- Ver conductor asignado (nombre) cuando `status = accepted`
- Cancelar si `status = requested` o `accepted`
- Calificar al conductor tras `completed`

### Admin / Operador
- Ver cola de solicitudes `requested`
- Ver conductores activos (users con `role = driver` y `status = active`)
- Asignar conductor a una solicitud
- Cancelar viajes activos con motivo
- Ver todas las solicitudes con filtro de estado

### Driver
- Ver viajes asignados a él (`GET /rides/driver/me`)
- Marcar "Voy en camino" *(Fase 66)*
- Marcar "Llegué" *(Fase 66)*
- Iniciar viaje
- Finalizar viaje
- Calificar al pasajero *(a implementar)*

---

## Pantallas impactadas

| Pantalla | Cambios necesarios |
|---|---|
| `/passenger/home` | Mostrar viaje activo si existe |
| `/passenger/request-ride` | ✅ Funcional |
| `/passenger/trips` | Mostrar nombre del conductor cuando `accepted`; mostrar estados `driver_en_route`/`driver_arrived` cuando existan |
| `/driver/home` | Mostrar viaje activo asignado si existe |
| `/driver/requests` | Cambiar de "solicitudes disponibles" a "viajes asignados a mí" — el driver ya no auto-acepta |
| `/driver/trips` | ✅ Funcional (start/complete/rate) |
| `/admin/home` | ActionCard hacia cola de viajes |
| `/admin/trips` *(nuevo)* | Cola `requested` + asignación + viajes en curso |

---

## Schema actual — columnas presentes

```
ride_requests:
  id, passenger_user_id, origin_text, destination_text, notes,
  estimated_fare_clp, driver_user_id, status, requested_at,
  accepted_at, started_at, completed_at, cancelled_at,
  cancellation_reason, cancelled_by_user_id, cancelled_by_role,
  created_at, updated_at
```

**No se requiere migración para Fase 65.**
Fase 66 requerirá: `en_route_at`, `arrived_at`.

---

## Riesgos técnicos

| Riesgo | Descripción | Mitigación |
|---|---|---|
| `/rides/available` | Muestra viajes `requested` a cualquier driver — en despacho manual este endpoint sobra | Desactivarlo o restringirlo a admin en Fase 65 |
| `/rides/:id/accept` | Permite que cualquier driver se auto-asigne — colisiona con el modelo manual | Deprecar en Fase 65; admin usa `/admin/rides/:id/assign` |
| `start` desde `accepted` | Cuando se añadan estados intermedios, `start` debe aceptar desde `driver_arrived` también | Actualizar condición en repositorio en Fase 66 |
| Polling | Sin WebSocket, el pasajero y el admin necesitan refresh manual o polling | Agregar `IonRefresher` en todas las pantallas de estado como solución temporal |

---

## Orden de implementación

| Fase | Nombre | Contenido |
|---|---|---|
| **65** | Admin asigna conductor | `GET /admin/rides`, `POST /admin/rides/:id/assign`, `POST /admin/rides/:id/cancel`, pantalla `/admin/trips` con cola y asignación |
| **66** | Estados intermedios driver | `en-route`, `arrived`, timestamps en DB, pantalla driver actualizada |
| **67** | Info conductor en vista pasajero | Mostrar nombre del conductor asignado en trips page |
| **68** | QA ciclo completo | Probar ciclo end-to-end: solicitud → asignación → en camino → llegada → inicio → fin → rating |
| **69** | Railway deploy real | Deploy a producción con DB migrada |
