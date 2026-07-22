# Diseño Técnico — Viajes Multi-Destino con Precio por Tramo

**Parte:** 22 (diseño)
**Estado:** Aprobación pendiente — sin código modificado
**Autores:** Rodrigo Ulloa / Claude
**Fecha:** 2026-06-06

---

## 1. Diagnóstico del estado actual

### 1.1 Backend

**`rides.schema.ts` — campos actuales de destino:**
```
destinationText    VARCHAR(150)
destinationLat     DOUBLE PRECISION
destinationLng     DOUBLE PRECISION
distanceMeters     INTEGER
durationSeconds    INTEGER
estimatedFareClp   INTEGER
```
Un único destino. No hay tabla de paradas ni campo JSONB.

**`rides.schemas.ts` — validación Zod actual:**
- Valida un solo `destinationText`, `destinationLat`, `destinationLng`.
- No tiene concepto de destinos múltiples ni de orden de paradas.

**`rides.service.ts` — cálculo de tarifa:**
```typescript
estimateFare(distanceMeters) → max(km * 2300, 3000)
```
Un solo tramo. Recibe `distanceMeters` del cliente (calculado por Google Maps) y lo valida.

**`rides.repository.ts`:**
- `create()` recibe un solo set de coordenadas origen/destino.
- `findAvailable()`, `findByPassengerId()` etc. retornan objetos con un solo destino.

**Migración más reciente:** `0029_scheduled_rides.sql` → próxima sería `0030_ride_stops.sql`.

### 1.2 Mobile — Mapas

**`useDirectionsRoute.ts`:**
- Firma: `calculate(origin: LatLng, destination: LatLng, map) → void`
- Llama `DirectionsService.route({ origin, destination, travelMode: DRIVING })`.
- Solo procesa `result.routes[0]?.legs[0]` → un único tramo.
- El error `MAX_WAYPOINTS` ya está manejado en el string de error, pero los waypoints no se usan.
- **No soporta multi-parada todavía.**

**`maps.types.ts`:**
- `GoogleDirectionsResult.routes[].legs[]` es un array — la API Google retorna un `leg` por tramo cuando se usan waypoints.
- El tipo ya modela el array de `legs`, pero `useDirectionsRoute` solo lee `legs[0]`.

**`PlaceAutocompleteInput.tsx`:**
- Componente único reutilizable para un campo de texto con autocompletado de Places.
- Es stateless — puede instanciarse múltiples veces sin problema.

### 1.3 Mobile — UI

**`RequestRidePage.tsx`:**
- Un `PlaceAutocompleteInput` para origen, uno para destino.
- `useDirectionsRoute` → calcula un tramo, extrae `distanceValue` y `durationValue`.
- Envía al backend: `originText/Lat/Lng`, `destinationText/Lat/Lng`, `distanceMeters`, `durationSeconds`.

**`TripsPage.tsx`:**
- Muestra `ride.originText` y `ride.destinationText` como par fijo.
- `DriverLocationSection` usa `destinationLat/Lng` como único punto destino para la ruta en curso.

**`DriverMyRidesPage` (`driver/index.tsx`):**
- `DriverRideRouteMap` calcula ruta al origen del pasajero (en `accepted/driver_en_route`) o al destino (en `in_progress`).
- Conoce solo un destino final.

### 1.4 Conclusión del diagnóstico

| Capa | Cambio requerido |
|---|---|
| DB | Nueva tabla `ride_stops` |
| Backend schema | `rides.schema.ts` sin cambios de campos; nueva tabla Drizzle |
| Backend Zod | `createRideRequestSchema` acepta array de destinos |
| Backend service | `estimateFare` total por suma de tramos |
| Backend repository | `create()` inserta stops; getters incluyen stops |
| Backend types | Agregar `stops` y `segments` en responses |
| Mobile maps | Nuevo `useMultiStopRoute` o extensión de `useDirectionsRoute` |
| Mobile RequestRidePage | Lista dinámica de destinos con `PlaceAutocompleteInput` |
| Mobile TripsPage | Mostrar lista de paradas en lugar de un destino |
| Mobile driver | Conocer parada actual + botón "Llegué a parada N" |

---

## 2. Modelo de datos recomendado

### Opción A — Tabla `ride_stops` (RECOMENDADA)

```sql
CREATE TABLE ride_stops (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_request_id         UUID NOT NULL REFERENCES ride_requests(id) ON DELETE CASCADE,
  stop_order              SMALLINT NOT NULL,          -- 1, 2, 3...
  label                   VARCHAR(150) NOT NULL,      -- texto del destino
  lat                     DOUBLE PRECISION NOT NULL,
  lng                     DOUBLE PRECISION NOT NULL,
  segment_distance_meters INTEGER,                    -- metros desde la parada anterior
  segment_duration_seconds INTEGER,                   -- segundos desde la parada anterior
  segment_fare_clp        INTEGER,                    -- tarifa proporcional de este tramo
  arrived_at              TIMESTAMPTZ,                -- cuando conductor marcó llegada a esta parada
  departed_at             TIMESTAMPTZ,                -- cuando inició el siguiente tramo
  UNIQUE (ride_request_id, stop_order)
);

CREATE INDEX idx_ride_stops_ride_request ON ride_stops (ride_request_id, stop_order ASC);
```

**¿Por qué tabla y no JSONB?**

| Criterio | Tabla `ride_stops` | JSONB en `ride_requests` |
|---|---|---|
| Consultas por parada individual | ✅ Query directo | ❌ Requiere jsonb_array_elements |
| Auditoría por parada | ✅ Filas individuales con timestamps | ⚠️ Difícil distinguir versiones |
| Índices | ✅ `stop_order`, `arrived_at` | ❌ Solo GIN general |
| Actualizar `arrived_at` por parada | ✅ `UPDATE WHERE id=? AND stop_order=?` | ⚠️ UPDATE del JSONB completo |
| Reportes de rentabilidad por tramo | ✅ Agrupa por `ride_request_id` | ❌ Complejo |
| Esquema evoluciona más campos | ✅ `ALTER TABLE ADD COLUMN` | ❌ Migración de datos |
| Compatibilidad con viaje simple | ✅ Un stop con `stop_order=1` | ✅ Array de un elemento |

**Decisión: tabla `ride_stops`.**

### Opción B — JSONB (descartada)

```sql
ALTER TABLE ride_requests ADD COLUMN stops JSONB;
-- [{ order, label, lat, lng, segmentDistM, segmentDurS, segmentFareClp, arrivedAt }]
```

Descartada por dificultad en consultas, auditoría y evolución del esquema.

---

### 2.1 Cambios de compatibilidad en `ride_requests`

Los campos actuales **se mantienen sin cambios**:

| Campo | Comportamiento con multi-destino |
|---|---|
| `destinationText` | Último destino (`stop_order` máximo) |
| `destinationLat` | Lat del último destino |
| `destinationLng` | Lng del último destino |
| `distanceMeters` | Suma de todos los `segment_distance_meters` |
| `durationSeconds` | Suma de todos los `segment_duration_seconds` |
| `estimatedFareClp` | Tarifa total (suma de tramos + priorityFee si aplica) |

Se agrega un campo nuevo en `ride_requests`:

```sql
ALTER TABLE ride_requests
  ADD COLUMN current_stop_order SMALLINT NOT NULL DEFAULT 0;
-- 0 = en camino al pasajero, 1 = en camino a parada 1, etc.
```

`current_stop_order` lo incrementa el backend cuando el conductor marca "Llegué a parada N".

---

## 3. Cálculo de tarifa

### Regla principal

La **tarifa mínima aplica al viaje total**, no a cada tramo individual.

```
totalFare = max(totalDistanceKm × 2300, 3000) + extraStopFee + priorityFeeClp
```

Cada tramo recibe su parte proporcional:

```
segmentFareClp[i] = floor(totalBaseFare × (segmentDistMeters[i] / totalDistMeters))
```

El tramo con más distancia absorbe el redondeo para que la suma sea exactamente `totalBaseFare`.

### Tarifa por parada adicional (configurable)

Se agrega en `fare_settings`:

| type | name | value | descripción |
|---|---|---|---|
| `extra_stop_fee` | Cargo por parada adicional | 1000 | CLP por cada destino más allá del primero |

El cargo aplica así:
```
extraStopFee = max(0, numStops - 1) × extraStopFeePerStop
```

Ejemplo: 3 destinos → 2 paradas adicionales → 2 × 1000 = 2.000 CLP extra.

Si el setting no existe o está inactivo → `extraStopFee = 0` (sin cargo, no fallback).

**El `extraStopFeeClp` y la tarifa por tramo se calculan 100% en backend. El cliente solo envía distancias y duraciones por tramo.**

### Ejemplo completo

```
Origen: Aeropuerto
Stop 1: Hotel A → 3 km, 8 min
Stop 2: Restaurante → 2 km, 5 min
Stop 3: Casa → 4 km, 10 min

totalDistKm = 9 km
baseFare = max(9 × 2300, 3000) = 20.700 CLP
extraStopFee = 2 × 1000 = 2.000 CLP
totalFare = 20.700 + 2.000 = 22.700 CLP

Distribución proporcional:
  Tramo 1 (3/9): 20.700 × 0.333 = 6.900 CLP
  Tramo 2 (2/9): 20.700 × 0.222 = 4.600 CLP
  Tramo 3 (4/9): 20.700 × 0.444 = 9.200 CLP (absorbe redondeo)
  Suma tramos = 20.700 ✅
```

---

## 4. API — Payload y Response

### 4.1 Request: `POST /rides/request`

```typescript
interface CreateMultiRideInput {
  originText:       string;
  originLat:        number;
  originLng:        number;
  destinations: Array<{    // mínimo 1, máximo 5
    text:           string;
    lat:            number;
    lng:            number;
    order:          number; // 1-based, secuencial
  }>;
  segments: Array<{        // longitud = destinations.length
    fromOrder:      number; // 0 = origen, 1..N = stop anterior
    toOrder:        number; // 1..N
    distanceMeters: number; // calculado por Google Maps en cliente
    durationSeconds: number;
  }>;
  rideType?:          "immediate" | "scheduled";
  scheduledPickupAt?: string;
  flightNumber?:      string;
  notes?:             string;
}
```

**Validaciones Zod (nuevas):**
- `destinations` — array, min 1, max 5 elementos.
- Cada `destination.order` debe ser único y secuencial (1, 2, 3…).
- No puede haber dos destinations con `lat/lng` idénticos entre sí.
- `segments.length === destinations.length`.
- Cada `segment.fromOrder` y `toOrder` corresponde a la secuencia de destinations.
- `segment.distanceMeters` entre 1 y 100.000 (misma regla que hoy).
- Distancia total acumulada ≤ 100.000 metros.
- `destinationText/Lat/Lng` en el body se deriva del último `destinations` elemento — el backend lo lee del array.

**Compatibilidad con viaje simple (1 destino):**
El cliente puede seguir enviando el payload antiguo con `destinationText/Lat/Lng/distanceMeters/durationSeconds` sin `destinations`/`segments` — el backend los transforma internamente en un array de 1 stop.

### 4.2 Response: `RideRequestResponse` extendido

```typescript
interface StopResponse {
  id:                     string;
  stopOrder:              number;
  label:                  string;
  lat:                    number;
  lng:                    number;
  segmentDistanceMeters:  number | null;
  segmentDurationSeconds: number | null;
  segmentFareClp:         number | null;
  arrivedAt:              string | null;
  departedAt:             string | null;
}

// Campos nuevos en RideRequestResponse / DriverRideResponse:
stops:              StopResponse[];    // array ordenado por stopOrder
currentStopOrder:   number;            // 0 hasta N
extraStopFeeClp:    number | null;     // cargo por paradas adicionales
```

---

## 5. Cambios por capa — resumen

### 5.1 Backend

| Archivo | Cambio |
|---|---|
| `apps/api/src/db/schema/rideStops.schema.ts` | **NUEVO** — Drizzle schema para `ride_stops` |
| `apps/api/src/db/schema/rides.schema.ts` | Agregar campo `currentStopOrder` |
| `apps/api/src/db/migrations/0030_ride_stops.sql` | **NUEVO** — `CREATE TABLE ride_stops` + ALTER `current_stop_order` |
| `apps/api/src/modules/rides/rides.schemas.ts` | Zod: acepta `destinations[]` y `segments[]` + valida |
| `apps/api/src/modules/rides/rides.service.ts` | `createRideRequest`: inserta stops, calcula tarifa por tramo |
| `apps/api/src/modules/rides/rides.repository.ts` | `create()`: INSERT stops; getters: JOIN con `ride_stops` |
| `apps/api/src/modules/rides/rides.types.ts` | Agregar `stops`, `currentStopOrder`, `extraStopFeeClp` |
| `apps/api/src/modules/admin/admin.repository.ts` | `listRides/findRideById`: incluir stops en respuesta |
| `apps/api/src/modules/admin/admin.types.ts` | `AdminRideResponse`: agregar stops |

**Nuevo endpoint para avanzar parada:**
```
POST /rides/:rideId/next-stop
Actor: driver
Body: (vacío)
Acción: incrementa currentStopOrder, registra arrivedAt/departedAt en la parada correspondiente
```

### 5.2 Mobile — Mapas

**`useDirectionsRoute.ts` — extensión para multi-tramo:**

Opción elegida: crear `useMultiStopRoute` como nuevo hook en `apps/mobile/src/features/maps/`. No modificar `useDirectionsRoute` para no romper los flujos existentes.

```typescript
// useMultiStopRoute.ts
// Llama DirectionsService con waypoints:
{
  origin: stops[0],
  destination: stops[stops.length - 1],
  waypoints: stops.slice(1, -1).map(s => ({ location: new LatLng(s.lat, s.lng), stopover: true })),
  travelMode: DRIVING,
}
// Procesa result.routes[0].legs[] (uno por tramo)
// Retorna RouteSummary[] (por tramo) + totales
```

La API Google Directions permite hasta 25 waypoints en una llamada. Para Rapa Nui con máximo 5 destinos, se usa 1 llamada con 3 waypoints intermedios → sin problema de límite.

**`maps.types.ts` — tipos nuevos:**
```typescript
interface MultiRouteSegment {
  fromLabel:     string;
  toLabel:       string;
  distanceText:  string;
  distanceValue: number;
  durationText:  string;
  durationValue: number;
}

interface MultiRouteState {
  status:   RouteStatus;
  segments: MultiRouteSegment[];
  totals:   RouteSummary | null;
  error:    string | null;
}
```

### 5.3 Mobile — RequestRidePage

**Estado nuevo:**
```typescript
const [destinations, setDestinations] = useState<MapPoint[]>([]);
// máx 5 elementos, mínimo 1 antes de envío
```

**UI:**
- Origen: igual que ahora (1 `PlaceAutocompleteInput`).
- Destinos: lista dinámica de `PlaceAutocompleteInput` con botones "+ Agregar parada" y "✕" para eliminar.
- Mapa: muestra ruta multi-tramo cuando hay 2+ puntos.
- Resumen: tabla de tramos con distancia, duración y precio por tramo + total.

**Payload enviado:**
```typescript
{
  originText, originLat, originLng,
  destinations: [{ text, lat, lng, order }],
  segments: [{ fromOrder, toOrder, distanceMeters, durationSeconds }],
  // desde useMultiStopRoute.segments[]
}
```

### 5.4 Mobile — TripsPage (pasajero)

- Si `ride.stops.length > 1`: mostrar lista de paradas en lugar del par origen/destino.
- Indicador visual de parada actual: parada completada (✓), parada activa (→), parada pendiente (○).
- Precio por tramo en el desglose.
- `DriverLocationSection` usa `stop[currentStopOrder]` como destino de la ruta (en lugar de `destinationLat/Lng` fijo).

### 5.5 Mobile — DriverMyRidesPage (conductor)

**Lista de paradas por viaje:**
```
1. ✓ Hotel A — Completado 14:05
2. → Restaurante — En camino
3. ○ Casa — Pendiente
```

**Botón de acción por estado:**

| Estado de la parada | Botón |
|---|---|
| `currentStopOrder = 0` | "Llegué al pasajero" (marca `driver_arrived`) |
| `status = driver_arrived` | "Iniciar viaje" (pasa a `in_progress`, establece `currentStopOrder = 1`) |
| `in_progress`, paradas pendientes | "Llegué a parada N" |
| `in_progress`, última parada | "Finalizar viaje" |

**`DriverRideRouteMap` — adaptación:**
- Calcula ruta al punto de la parada actual (`stops[currentStopOrder]`) en lugar del destino fijo.

---

## 6. Estados del viaje

Los estados principales **no cambian**:
```
requested → accepted → driver_en_route → driver_arrived → in_progress → completed
```

El progreso por paradas se controla con `currentStopOrder` dentro del estado `in_progress`:

```
in_progress, currentStopOrder=1 → conductor va a parada 1
in_progress, currentStopOrder=2 → conductor va a parada 2
in_progress, currentStopOrder=N → conductor va al destino final
```

El endpoint `POST /rides/:rideId/next-stop`:
1. Valida que el conductor es el asignado.
2. Valida que el viaje está `in_progress`.
3. Valida que `currentStopOrder < numStops`.
4. Registra `arrivedAt` en `ride_stops[currentStopOrder]`.
5. Incrementa `currentStopOrder` en `ride_requests`.
6. Si `currentStopOrder = numStops` → llama `completeRide`.

**No se agrega estado extra al estado machine principal** — mantiene compatibilidad total.

---

## 7. Compatibilidad con viaje simple

Un viaje con un solo destino es idéntico a ahora:
- `destinations.length = 1` → se crea `ride_stops` con `stop_order = 1`.
- `segments.length = 1` → el tramo único recibe 100% de la tarifa.
- `extraStopFeeClp = 0` (solo 1 destino, sin cargos adicionales).
- `currentStopOrder` arranca en `0`, pasa a `1` al iniciar y finaliza en `1`.
- Los campos legacy `destinationText/Lat/Lng/distanceMeters/durationSeconds` se rellenan igual que hoy.
- Los clientes anteriores que no conocen `stops` siguen funcionando — `stops` es un array adicional en el response.

---

## 8. Reglas de validación

| Regla | Valor |
|---|---|
| Mínimo destinos | 1 |
| Máximo destinos (fase inicial) | 3 (luego ampliable a 5) |
| Destinos duplicados | Rechazado (mismas coords que otro destino o que el origen) |
| Destino = origen | Rechazado (misma regla que hoy: diferencia < 0.0005°) |
| `segments.length === destinations.length` | Obligatorio |
| Orden secuencial | 1, 2, 3… sin saltos |
| `distanceMeters` por tramo | 1 – 100.000 |
| Distancia total acumulada | ≤ 100.000 metros |
| `extraStopFee` | Solo si `fare_settings.type='extra_stop_fee'` activo |
| `priorityFeeClp` | Solo para `rideType=scheduled`, suma al total |

---

## 9. Tests necesarios

| Test | Suite |
|---|---|
| Viaje simple (1 destino) sigue funcionando | `rides.service.test.ts` |
| Viaje multi-destino válido (3 stops) | `rides.service.test.ts` |
| Rechaza `destinations=[]` | `rides.service.test.ts` |
| Rechaza más de 3 destinos (límite inicial) | `rides.service.test.ts` |
| Rechaza destinos con `order` no secuencial | `rides.schemas.test.ts` |
| Rechaza destino duplicado exacto | `rides.schemas.test.ts` |
| `distanceMeters` total = suma de segmentos | `rides.service.test.ts` |
| `durationSeconds` total = suma de segmentos | `rides.service.test.ts` |
| Tarifa total = max(totalKm × 2300, 3000) + extraStop | `rides.service.test.ts` |
| Distribución proporcional suma tarifa base | `rides.service.test.ts` |
| `destinationText/Lat/Lng` = último stop | `rides.service.test.ts` |
| `ride_stops` creados en orden correcto | `rides.repository.test.ts` (nuevo) |
| Conductor recibe `stops` en response | `rides.service.test.ts` |
| Pasajero recibe `stops` en response | `rides.service.test.ts` |
| Viaje programado multi-destino suma `priorityFeeClp` | `rides.service.test.ts` |
| Auto-asignación usa `originLat/Lng` igual que hoy | `rides.service.test.ts` |
| `next-stop` incrementa `currentStopOrder` | `rides.service.test.ts` (nuevo) |
| `next-stop` rechaza si no es el conductor asignado | `rides.service.test.ts` (nuevo) |
| `next-stop` en última parada completa el viaje | `rides.service.test.ts` (nuevo) |
| `extraStopFeeClp=0` si setting no existe | `rides.service.test.ts` |

---

## 10. Riesgos y decisiones pendientes

### Riesgos técnicos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Cliente envía `segments` manipulados (distancias infladas) | Media | El backend NO recalcula con Google Maps; solo valida rango (1–100.000 por tramo). Riesgo residual: tarifa manipulada. **Decisión pendiente**: ¿re-calcular en backend con Google Maps API server-side? |
| Conductor salta una parada (va directo al final) | Media | UI mostrará paradas en orden. El sistema no puede forzar el camino físico. Registrar `arrivedAt` de la parada omitida = null. |
| Google Directions API falla para algún tramo | Baja | `useMultiStopRoute` captura el error y muestra mensaje amigable. Pasajero puede editar las paradas. |
| Costos de Google API | Media | Directions API cobra por request. Multi-stop = 1 request (con waypoints) en lugar de N. Sin costo adicional por usar waypoints. Precio actual: ~$5 USD/1000 requests. |
| Rendimiento: respuesta con stops embedded | Baja | Para viajes con ≤5 stops, el overhead es mínimo. No requiere paginación de stops. |
| Pasajero agrega destinos durante el viaje | Media | No contemplado en MVP. UI bloquea edición una vez que el viaje está `in_progress`. |
| Conflicto de `currentStopOrder` con race conditions | Baja | El endpoint `next-stop` hace UPDATE atómico con condición `WHERE currentStopOrder = expected`. Si ya cambió, retorna 409. |

### Decisiones pendientes antes de implementar

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| D1 | Máximo inicial de destinos | 3 o 5 | **3** — más simple de validar, testear y manejar en UI pequeña |
| D2 | Re-calcular distancias en backend | Sí (server-side Directions API) / No (confiar en cliente) | **No por ahora** — añade latencia y costo. Validar solo rangos. Revisar si hay fraude en producción |
| D3 | Cargo por parada extra (`extraStopFee`) | Habilitado desde inicio / Solo disponible vía config | **Config desde inicio** — insertar el setting en la migración `0030` con valor 1.000 CLP pero `is_active=false`. Admin lo activa cuando decida |
| D4 | Viaje simple usa `destinations[]` o payload legacy | Mantener ambos formatos / Migrar solo a `destinations[]` | **Mantener ambos** — el backend detecta si viene `destinations` o los campos legacy y los normaliza |
| D5 | Tarifa mínima por tramo vs por viaje total | Por tramo / Por viaje | **Por viaje total** — evita que tramos cortos en Rapa Nui disparen la tarifa mínima × N |

---

## 11. Plan de implementación por partes

### Parte 23 — Backend: tabla y repositorio

**Alcance:** Solo backend, sin UI.
1. Crear `apps/api/src/db/schema/rideStops.schema.ts` (Drizzle).
2. Agregar `currentStopOrder` a `rides.schema.ts`.
3. Crear migración `0030_ride_stops.sql`.
4. Actualizar `rides.repository.ts`: `create()` acepta y persiste stops; getters hacen JOIN con `ride_stops`.
5. Actualizar `admin.repository.ts`: incluye stops en consultas.
6. Validación: `npm run typecheck`, `npm run build` API.

### Parte 24 — Backend: validación, tarifa y endpoint next-stop

**Alcance:** Lógica de negocio.
1. Actualizar `rides.schemas.ts` (Zod): `destinations[]`, `segments[]`, compatibilidad legacy.
2. Actualizar `rides.service.ts`:
   - `createRideRequest`: calcula tarifa total por tramos, `extraStopFeeClp`, distribución proporcional.
   - Nuevo método `advanceToNextStop(accessToken, rideId)`.
3. Actualizar `rides.types.ts`: agregar `stops`, `currentStopOrder`, `extraStopFeeClp`.
4. Nueva ruta `POST /rides/:rideId/next-stop`.
5. Tests unitarios completos (suite tabla de tests del punto 9).
6. Validación: 63+ tests, typecheck, build.

### Parte 25 — Mobile: UI pasajero multi-destino

**Alcance:** Solo `RequestRidePage` y `TripsPage`.
1. Crear `useMultiStopRoute.ts` en `features/maps/`.
2. Extender `maps.types.ts` con `MultiRouteState`, `MultiRouteSegment`.
3. Actualizar `RequestRidePage.tsx`: lista dinámica de destinos, cálculo multi-tramo, desglose de precios.
4. Actualizar `TripsPage.tsx`: mostrar lista de paradas, indicador de parada actual.
5. Actualizar `rides.service.ts` mobile: `CreateRideInput` acepta `destinations[]`+`segments[]`; `RideRequestData` incluye `stops`, `currentStopOrder`, `extraStopFeeClp`.
6. Validación: typecheck, build mobile.

### Parte 26 — Mobile: UI conductor paradas

**Alcance:** Solo `driver/index.tsx`.
1. Extender `DriverRideData` (mobile) con `stops`, `currentStopOrder`.
2. Actualizar `DriverMyRidesPage`: lista de paradas, botón "Llegué a parada N", lógica de avance.
3. Adaptar `DriverRideRouteMap`: usa `stops[currentStopOrder]` como destino.
4. Agregar llamada a `ridesService.advanceToNextStop(token, rideId)` (nuevo método en mobile `rides.service.ts`).
5. Validación: typecheck, build mobile.

### Parte 27 — QA multi-destino

**Alcance:** Prueba E2E de punta a punta.
1. Viaje simple sigue igual.
2. Viaje multi-destino completo (3 paradas).
3. Viaje programado multi-destino.
4. Conductor avanza por paradas.
5. Pasajero ve avance.
6. Admin ve desglose de paradas.
7. `npm run test`, typecheck, build completo.
8. Documento de QA + commit.

---

## 12. Impacto en módulos existentes

| Módulo | Impacto | Riesgo |
|---|---|---|
| Viajes inmediatos | Ninguno si se mantiene compatibilidad legacy | Bajo |
| Viajes programados | Suma `extraStopFeeClp` al total si hay múltiples destinos | Bajo |
| Auto-asignación | Sin cambios — usa `originLat/Lng` igual que hoy | Ninguno |
| Admin listRides | Necesita incluir `stops` en el SELECT | Bajo |
| Earnings / ganancias | `estimatedFareClp` total ya incluye tramos — sin cambios | Ninguno |
| Ratings | Por ride completo, no por tramo — sin cambios | Ninguno |
| Referral discount | Solo viajes inmediatos — aplica sobre `baseFare` total | Ninguno |
| Offline bookings | Sin stops — viaje simple por defecto | Ninguno |

---

*Documento aprobado para iniciar implementación cuando se confirme. Código no modificado.*
