# Queued Ride Offers — Cola Inteligente de Viajes

Commit de referencia: `3067563 feat(rides): add queued offers for busy drivers`

---

## 1. Objetivo Funcional

Permite que un conductor con un viaje **in_progress** reciba una oferta para su próximo viaje antes de terminar el actual. El conductor tiene 20 segundos para aceptar o rechazar. Si acepta, el nuevo viaje queda en estado `accepted` como próximo viaje, pero no puede iniciarlo hasta completar el viaje actual.

Beneficios:
- Reduce el tiempo muerto entre viajes.
- No interrumpe el viaje actual bajo ninguna circunstancia.
- El pasajero del viaje encolado no ve conductor asignado hasta que el conductor quede disponible.

---

## 2. Flujo Resumido

```
Pasajero solicita viaje
        │
        ▼
No hay conductor available
        │
        ▼
Backend busca conductor busy elegible
(in_progress, sin queuedRideId, sin offer pending)
        │
        ▼
Crea ride_assignment_offer (TTL 20s)
Ride queda en status = requested
        │
        ├─► Conductor acepta (dentro de 20s)
        │       │
        │       ▼
        │   ride → accepted
        │   driver_statuses.queuedRideId = rideId
        │   offer → status = accepted
        │
        ├─► Conductor rechaza
        │       │
        │       ▼
        │   offer → status = rejected
        │   Ride sigue requested
        │   Backend puede intentar próximo candidato
        │
        └─► Conductor no responde (expiración lazy)
                │
                ▼
            offer → status = expired
            Ride sigue requested
            Se intenta próximo candidato en el siguiente dispatch
```

Cuando el conductor completa el viaje actual:
- `driver_statuses.queuedRideId` pasa a ser el `currentRideId`.
- El conductor queda en estado `busy` con el nuevo viaje activo.

---

## 3. Reglas de Negocio

| Regla | Detalle |
|---|---|
| Solo viajes inmediatos | `rideType = immediate`. Los viajes `scheduled` nunca generan queued offers. |
| Solo conductor in_progress | El conductor debe tener exactamente un viaje en estado `in_progress`. |
| Un solo queued ride por conductor | Si `driver_statuses.queuedRideId` ya está seteado, no recibe nueva offer. |
| Un solo offer pending por viaje | Índice único parcial en `ride_assignment_offers` (status = pending, rideRequestId). |
| Offer pending ≠ conductor asignado | El pasajero no ve conductor asignado mientras la offer está pending. |
| Rechazo ≠ expiración | El rechazo es acción explícita del conductor y llama al endpoint `/reject`. La expiración es silenciosa y no llama ningún endpoint. |
| Admin puede asignar manualmente | Al asignar vía admin, cualquier offer pending del viaje se cancela automáticamente antes de la asignación. |
| Conductor no puede iniciar próximo viaje antes | El botón "Voy en camino" está bloqueado mientras existe un viaje `in_progress`. |

---

## 4. Modelo de Datos

### `ride_assignment_offers`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid | PK |
| `rideRequestId` | uuid | FK → ride_requests.id |
| `driverUserId` | uuid | FK → users.id |
| `status` | enum | `pending`, `accepted`, `rejected`, `expired`, `cancelled` |
| `offeredAt` | timestamp | Momento de creación |
| `expiresAt` | timestamp | `offeredAt + 20s` |
| `respondedAt` | timestamp | Momento de respuesta del conductor |
| `responseSource` | text | `driver`, `system`, `admin` |
| `attemptOrder` | int | Orden del intento (1, 2, 3…) |

Índices únicos parciales:
- `(rideRequestId) WHERE status = 'pending'` — un solo offer activo por viaje.
- `(driverUserId) WHERE status = 'pending'` — un solo offer activo por conductor.

### `driver_statuses`

| Columna relevante | Descripción |
|---|---|
| `queuedRideId` | ID del próximo viaje aceptado (null si no hay) |

### `ride_requests`

| Columna relevante | Descripción |
|---|---|
| `assignmentMode` | `automatic`, `manual`, `queued_offer` |
| `queuedOfferDriverId` | ID del conductor que aceptó via queued offer (null si no aplica) |

---

## 5. Endpoints

### `GET /api/drivers/me/offers/active`

Devuelve la offer pending activa del conductor autenticado, junto con los datos del viaje asociado.

**Respuesta exitosa:**
```json
{
  "ok": true,
  "statusCode": 200,
  "data": {
    "offer": {
      "id": "uuid",
      "rideRequestId": "uuid",
      "status": "pending",
      "offeredAt": "ISO8601",
      "expiresAt": "ISO8601",
      "attemptOrder": 1
    },
    "ride": {
      "id": "uuid",
      "originText": "Hanga Roa",
      "destinationText": "Aeropuerto",
      "estimatedFareClp": 5000,
      "distanceMeters": 2000,
      "durationSeconds": 300,
      "rideType": "immediate",
      "scheduledPickupAt": null,
      "priorityFeeClp": null,
      "flightNumber": null
    }
  }
}
```

Si no hay offer activa: `"data": null`.  
Si la offer está expirada, se marca `expired` en BD y retorna `null` (expiración lazy).

---

### `POST /api/drivers/me/offers/:offerId/accept`

Acepta la offer. Operación atómica: marca la offer `accepted`, pasa el ride a `accepted`, setea `queuedRideId` en `driver_statuses`.

**Respuesta exitosa:** datos completos del ride aceptado.  
**409** si la offer ya expiró, fue rechazada o ya no está pending.

---

### `POST /api/drivers/me/offers/:offerId/reject`

Rechaza manualmente la offer. La marca como `rejected` con `responseSource = driver`.

**Respuesta exitosa:** `{ "rejected": true }`.

---

## 6. UI Conductor

### Polling

- Intervalo: **3 segundos**.
- Activo solo cuando: `hasInProgressRide === true` AND `activeOffer === null`.
- Se limpia al desmontar el componente.

### Modal de Oferta (`QueuedOfferModal`)

- Se abre automáticamente cuando el polling detecta una offer activa.
- Muestra: origen → destino, tarifa estimada, distancia, duración, hora programada (si aplica), tarifa prioritaria, número de vuelo.
- **Countdown** de 20 segundos:
  - Verde cuando quedan más de 10s.
  - Naranja cuando quedan ≤ 10s.
  - Rojo cuando quedan ≤ 5s.
- **Aceptar**: llama a `/accept`, recarga rides, cierra modal.
- **Rechazar**: llama a `/reject`, cierra modal, muestra mensaje "Oferta rechazada."
- **Expiración por countdown**: NO llama a ningún endpoint. Solo cierra el modal y muestra "La oferta expiró." La expiración real ocurre en backend en la próxima lectura.

### Banners y bloqueos

- Banner azul informativo cuando `hasAcceptedQueuedRide === true` (ya hay próximo viaje asignado).
- Botón "Voy en camino" reemplazado por "Disponible al finalizar tu viaje actual" (disabled) cuando existe un viaje `in_progress`.

---

## 7. QA y Validaciones

| Validación | Estado |
|---|---|
| Tests API | 96/96 pasando |
| `typecheck` API | Limpio |
| `build` API | Limpio |
| `typecheck` mobile | Limpio |
| `build` mobile | Limpio |

### Casos validados

| Caso | Resultado esperado |
|---|---|
| Auto-asignación normal (conductor available) | Sin cambios — flujo directo sin queued offer |
| Dispatch a conductor busy elegible | Crea offer, ride queda requested |
| Conductor acepta dentro de 20s | Ride → accepted, queuedRideId seteado |
| Conductor rechaza | Offer → rejected, ride sigue requested |
| Offer expira sin respuesta | Offer → expired (lazy), ride sigue requested |
| Admin asigna manualmente | Cancela offer pending antes de asignar |
| Viaje scheduled | No genera queued offer en ningún caso |
| Backend multi-destino | Sin regresiones |

---

## 8. Limitaciones Conocidas

- **Sin push notifications.** El conductor solo se entera de la offer si tiene la app abierta con el polling activo.
- **Expiración lazy.** No hay worker en background. La offer se marca expired en la próxima lectura del endpoint `/active`, no en el momento exacto en que vence.
- **Sin optimización por destino actual.** El backend no considera si el destino del viaje actual está cerca del origen del próximo viaje para priorizar candidatos.
- **Sin cálculo de ETA.** No se estima cuánto tiempo falta para que el conductor termine el viaje actual al decidir si es buen candidato.
- **Conductor inactivo.** Si el conductor no consulta la app, la offer simplemente expira y no se reofrece hasta el próximo dispatch.

---

## 9. Próximos Pasos

| Ítem | Prioridad |
|---|---|
| Push notifications para ofertas | Alta |
| Worker de expiración automática (cron / pg_cron) | Media |
| Scoring mejorado de conductor ocupado (distancia destino actual → origen nuevo) | Media |
| UI pasajero para viajes multi-destino | Media |
| QA E2E manual en dispositivo real (iOS / Android) | Alta |

---

## 10. Comandos Útiles

```bash
# Tests API
npm run test --workspace=apps/api

# Typecheck
npm run typecheck --workspace=apps/api
npm run typecheck --workspace=apps/mobile

# Build
npm run build --workspace=apps/api
npm run build --workspace=apps/mobile
```
