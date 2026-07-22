# Release — Movilidad: Auto-asignación y Viajes Programados Prioritarios

**Fecha:** 2026-06-06
**Commit:** `a9f771a`
**Tag:** `release-mobility-scheduled-rides-2026-06-06`
**Rama:** `main`

---

## Funcionalidades incluidas

### 13.1 — Sesiones estables con refresh token

- El backend emite un `accessToken` (JWT corto) y un `refreshToken` (larga duración, hash en BD).
- El cliente mobile rota el refresh token automáticamente cuando el access token expira.
- Las sesiones se almacenan en `SecureStorage` (no `localStorage`) en el dispositivo.
- `sessionStorage.service.ts` centraliza lectura/escritura de sesión en mobile.
- `apiClient.ts` intenta refresh transparente ante respuesta 401.

### 14 / 14.1 — Auto-asignación de conductor más cercano

- Al crear un viaje **inmediato**, el backend intenta asignar automáticamente al conductor disponible más cercano al punto de recogida.
- Usa distancia Haversine entre las coordenadas del pasajero y las coordenadas en `driver_statuses`.
- Solo considera conductores con `availability = available`, `location_updated_at` ≤ 10 min y `last_seen_at` ≤ 60 min.
- Radio máximo: **15 km**.
- Si el primer candidato ya fue tomado (race condition), intenta el siguiente en orden de distancia.
- Si ningún candidato está disponible, el viaje queda en `status = requested` y el admin puede asignarlo manualmente.
- La auto-asignación es **no fatal**: si falla, el viaje queda en `requested` sin error al pasajero.

### 16 / 16.1 / 16.2 — Backend viajes programados prioritarios

**Campos nuevos en `ride_requests`** (migración `0029_scheduled_rides.sql`):

| Campo | Tipo | Descripción |
|---|---|---|
| `ride_type` | `VARCHAR(20)` | `immediate` (default) o `scheduled` |
| `scheduled_pickup_at` | `TIMESTAMPTZ` | Fecha/hora de recogida para viajes programados |
| `priority_fee_clp` | `INTEGER` | Recargo prioritario calculado por backend |
| `flight_number` | `VARCHAR(20)` | Número de vuelo opcional, normalizado uppercase |

**Reglas de negocio backend:**

- `scheduledPickupAt` mínimo: **ahora + 30 minutos**.
- `scheduledPickupAt` máximo: **ahora + 30 días**.
- Un viaje `scheduled` queda en `status = requested` — **nunca se auto-asigna**.
- El `priorityFeeClp` lo calcula el backend desde `fare_settings` con `type = 'priority_surcharge'`.
- Fallback si el setting no existe, está inactivo o falla: **2.000 CLP**.
- El recargo se **suma** a la tarifa base (no la reemplaza).
- El descuento de referido solo aplica a viajes **inmediatos**.
- Los viajes `scheduled` en `status = requested` **no aparecen** en `GET /rides/available` (conductores no los ven como disponibles).

**Contratos actualizados:**

- `RideRequestResponse`, `DriverRideResponse`, `AdminRideResponse` incluyen `rideType`, `scheduledPickupAt`, `priorityFeeClp`, `flightNumber`.
- `AdminRideRow` y ambos `SELECT` del admin repository incluyen los 4 campos.
- `AdminRideData`, `RideRequestData`, `DriverRideData` (mobile) reflejan los mismos campos.
- `CreateRideInput` acepta `rideType`, `scheduledPickupAt`, `flightNumber` — **nunca `priorityFeeClp`**.

### 17 — UI pasajero — programar viaje

- `RequestRidePage` tiene un selector **Ahora / Programar** (`IonSegment`).
- En modo **Programar**:
  - Input `datetime-local` con `min` (ahora + 30 min) y `max` (ahora + 30 días).
  - Campo opcional de número de vuelo (max 20 caracteres, normalizado uppercase/trim).
  - Aviso visual: "Reserva con prioridad — el recargo es calculado por el sistema".
  - Botón cambia a "Confirmar reserva programada".
- Validación doble: cliente antes de envío + Zod en backend (422 si falla).
- Mensaje de éxito diferenciado:
  - **Scheduled**: "Reserva programada recibida con prioridad. Te avisaremos cuando se asigne un conductor."
  - **Inmediato auto-asignado**: "Conductor asignado automáticamente."
  - **Inmediato pendiente**: "Estamos buscando un conductor disponible. Un administrador podrá asignarlo si es necesario."
- La tarifa mostrada incluye el desglose de `priorityFeeClp` si existe.

### 18 — UI admin — gestión de programados

- `AdminTripsPage` tiene un segmento **Todos / ⚡ Programados**.
- En vista Programados:
  - Filtra client-side por `rideType === "scheduled"`.
  - Ordena por `scheduledPickupAt ASC` (más próximos primero).
- Cada tarjeta de viaje programado muestra:
  - Borde naranja y badge **PRIORITARIO**.
  - Fecha/hora de recogida en locale `es-CL`.
  - Número de vuelo si existe.
  - Recargo prioritario si `priorityFeeClp > 0`.
  - Alerta roja ⚠ si `scheduledPickupAt ≤ ahora + 2h` y `status = requested`: "Reserva próxima sin conductor asignado".
- La asignación manual de conductor funciona igual que para viajes inmediatos.
- **Fix de QA (Parte 20)**: al asignar admin a un viaje `scheduled`, el conductor **no** queda marcado como `BUSY` inmediatamente — permanece disponible para viajes inmediatos hasta que presione "Voy en camino".

### 19 — UI conductor — próximos viajes programados

- `DriverMyRidesPage` separa los viajes en dos secciones:
  - **Próximos viajes programados**: `rideType === "scheduled" && status === "accepted"`, ordenados por `scheduledPickupAt ASC`.
  - **Otros viajes**: todo lo demás (inmediatos activos, histórico).
- Cada tarjeta programada muestra:
  - Borde naranja, badges "Programado asignado" y **PRIORITARIO**.
  - Fecha/hora de recogida.
  - Número de vuelo si existe.
  - Recargo prioritario incluido.
  - Advertencia de horario: "Programado para [hora]. Inicia el traslado cuando corresponda."
  - Alerta roja si el pickup está a ≤ 2 horas: "Reserva próxima: prepárate para ir al punto de recogida."
  - Aviso gris si falta más tiempo: "Viaje programado para más tarde."
- El conductor puede presionar "Voy en camino" sin bloqueo por horario (advertencia visual, no bloqueo duro).
- Al presionar "Voy en camino", el viaje sale de la sección Programados y aparece en la lista principal como cualquier viaje activo.
- Los viajes `scheduled` en `status = requested` (sin asignar) **no aparecen** en la vista del conductor.

---

## Flujo inmediato (reference)

```
Pasajero solicita viaje
  → backend valida input (Zod)
  → backend calcula tarifa (distancia × 2.300 CLP/km, mín. 3.000 CLP)
  → aplica descuento referido si corresponde
  → crea ride con status=requested
  → intenta auto-asignación (radio 15 km, últimas coordenadas ≤ 10 min)
    → si hay candidato: status=accepted, driverStatus=busy, autoAssigned=true
    → si no hay candidato: status=requested (admin asigna manualmente)
  → retorna al pasajero
Conductor (si auto-asignado):
  → ve viaje en Mis Asignaciones y Mis Viajes
  → "Voy en camino" → driver_en_route
  → "Llegué" → driver_arrived
  → "Iniciar viaje" → in_progress
  → "Finalizar" → completed + setAvailable
```

---

## Flujo programado

```
Pasajero selecciona "Programar" en RequestRidePage
  → ingresa fecha/hora (+30 min a +30 días), vuelo opcional
  → backend valida (Zod: rango, formato ISO)
  → backend calcula tarifa base + priorityFeeClp desde fare_settings
  → crea ride con rideType=scheduled, status=requested
  → NO hay auto-asignación
  → retorna al pasajero con mensaje "Reserva programada recibida"

Admin:
  → ve reserva en Viajes → filtro Programados
  → badge PRIORITARIO, fecha, vuelo, recargo
  → alerta si pickup ≤ 2h y sin conductor
  → asigna conductor manualmente → status=accepted
  → conductor permanece availability=available (no setBusy)

Conductor:
  → ve sección "Próximos viajes programados" en Mis Viajes
  → ve todos los detalles del viaje
  → cuando corresponde: "Voy en camino" → driver_en_route
  → continúa flujo normal: arrived → in_progress → completed
```

---

## Reglas de auto-asignación

| Parámetro | Valor |
|---|---|
| Radio máximo | 15 km |
| Antigüedad máxima de coordenadas | 10 minutos |
| Antigüedad máxima de last_seen | 60 minutos |
| Algoritmo de distancia | Haversine |
| Orden de candidatos | Distancia ASC |
| Race condition | Intenta el siguiente en la lista |
| Fallo no fatal | Viaje queda en `requested` |
| Aplica para | Solo viajes `immediate` |

---

## Reglas de reservas programadas

| Regla | Valor |
|---|---|
| `scheduledPickupAt` mínimo | ahora + 30 minutos |
| `scheduledPickupAt` máximo | ahora + 30 días |
| Auto-asignación | Prohibida |
| Aparece en lista conductores | Solo si está asignado (`status = accepted`) |
| Aparece en `/rides/available` | Nunca |
| `priorityFeeClp` origen | Backend via `fare_settings.type='priority_surcharge'` |
| Fallback `priorityFeeClp` | 2.000 CLP |
| `priorityFeeClp` desde cliente | Prohibido |
| Descuento referido | No aplica (solo viajes inmediatos) |
| Alerta próxima (admin/conductor) | `scheduledPickupAt ≤ ahora + 2h` |

---

## Variables de entorno requeridas

### Backend (`apps/api/.env`)

```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
NODE_ENV=development
```

### Mobile (`apps/mobile/.env`)

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_GOOGLE_MAPS_API_KEY=...
```

---

## Migraciones necesarias

```bash
# Aplicar todas las migraciones pendientes (incluye 0029_scheduled_rides.sql)
npm run db:migrate --workspace=apps/api
```

La migración `0029_scheduled_rides.sql` hace:

1. `ALTER TABLE ride_requests ADD COLUMN ride_type`, `scheduled_pickup_at`, `priority_fee_clp`, `flight_number`.
2. `CREATE INDEX idx_ride_requests_scheduled` (parcial sobre viajes programados no terminados).
3. `INSERT INTO fare_settings` el recargo `priority_surcharge` = 2.000 CLP con `effective_from = '2026-06-01'`.

---

## Comandos para validar

```bash
# Desde la raíz del monorepo

# 1. Tests unitarios backend
npm run test --workspace=apps/api
# Esperado: 63/63 tests pasando

# 2. TypeScript backend
npm run typecheck --workspace=apps/api
# Esperado: 0 errores

# 3. Build backend
npm run build --workspace=apps/api
# Esperado: OK

# 4. TypeScript mobile
npm run typecheck --workspace=apps/mobile
# Esperado: 0 errores

# 5. Build mobile
npm run build --workspace=apps/mobile
# Esperado: built in ~2s

# 6. Usuarios de prueba
npm run seed:dev --workspace=apps/api
# passenger@rapago.local / Test1234!
# driver@rapago.local    / Test1234!
# admin@rapago.local     / Test1234!
```

---

## Limitaciones conocidas

| Limitación | Impacto | Estado |
|---|---|---|
| Sin scheduler/cron | El sistema no recuerda ni alerta automáticamente cuando se acerca un viaje programado | Sin fecha |
| Sin notificaciones push | El conductor debe consultar la app para ver nuevas asignaciones; el pasajero no recibe aviso cuando se asigna conductor | Sin fecha |
| Sin pagos reales / wallet | `estimatedFareClp` es referencial; el pago se acuerda entre pasajero y conductor | Módulo futuro |
| Admin coordina programados manualmente | No hay cola de asignación automática para viajes scheduled | Sin fecha |
| Sin bloqueo duro de horario | El conductor puede presionar "Voy en camino" antes de la hora programada; solo hay advertencia visual | Decisión MVP |
| Posible doble-asignación de conductor | Admin puede asignar el mismo conductor a dos viajes scheduled, ya que no se llama `setBusy` para scheduled | Admin coordina manualmente |
| Sin multi-destino | Un viaje tiene un único origen y un único destino | Parte futura |
| Alerta basada en dispositivo | `scheduledPickupAt ≤ now + 2h` se evalúa en cliente — si el conductor no abre la app, no ve la alerta | Relacionado con notificaciones |

---

## Próximos pasos recomendados

### Inmediato (antes de producción)

1. **Ejecutar migración en Railway/producción**: confirmar que `0029_scheduled_rides.sql` se aplica antes del deploy.
2. **Verificar `VITE_GOOGLE_MAPS_API_KEY`** en el entorno de build (Vercel, Netlify o CI).
3. **Probar flujo E2E en dispositivo real** (Android/iOS vía Capacitor).

### Corto plazo

4. **Notificaciones push** — integrar `@capacitor/push-notifications` o similar. Eventos clave: asignación de conductor, alerta de pickup próximo, viaje completado.
5. **Scheduler de reservas programadas** — job periódico (cron o queue) que asigne automáticamente conductores a viajes `scheduled` cuando falte N minutos para el pickup.

### Mediano plazo

6. **Multi-destino** — paradas intermedias en un viaje. Requiere cambios en schema, API y mapas.
7. **Wallet y pagos** — integración PaymentProvider (Flow/Transbank/MercadoPago). El `estimatedFareClp` ya está en BD y es el dato base.
8. **Panel de staging/producción** — environment `staging` separado con DB propia antes de cada release.
9. **Bloqueo duro de horario** — impedir que el conductor marque "Voy en camino" más de X minutos antes del `scheduledPickupAt`.

---

## Tests cubiertos en este release

| Suite | Tests |
|---|---|
| `auth.service.test.ts` | 8 tests — login, logout, refresh |
| `driverStatus.service.test.ts` | 7 tests — disponibilidad, zonas |
| `rides.service.test.ts` | 48 tests — viaje inmediato, auto-asignación, viaje programado, recargo, fallback, race conditions |
| **Total** | **63 tests** |

Escenarios scheduled cubiertos en tests:

- Viaje programado creado con `rideType=scheduled`.
- Auto-asignación **no** se llama para viajes scheduled.
- `scheduledPickupAt` almacenado y devuelto como ISO string.
- Recargo desde `fare_settings` aplicado.
- Fallback 2.000 CLP cuando setting es null, inactivo o lanza error.
- `fareCalculationSource` incluye sufijo `_scheduled`.
- `flightNumber` almacenado en BD.
- `priorityFeeClp` es null para viajes inmediatos.
- `scheduledPickupAt` es null para viajes inmediatos.
