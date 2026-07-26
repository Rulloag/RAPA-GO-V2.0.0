# Estado Actual del Proyecto — RAPA GO V2.0.0

**Fecha:** 2026-05-29
**Rama principal:** `main`
**Responsable técnico:** Rodrigo Ulloa

---

## 1. Stack

| Capa | Tecnología |
|---|---|
| Mobile | React + Ionic + Capacitor + TypeScript |
| Backend | Fastify + TypeScript + Drizzle ORM + PostgreSQL |
| Shared | Paquete `@rapa-go/shared` — tipos y constantes comunes |
| Mapas | Google Maps JS SDK (CDN) + Places API + Directions API |
| Auth | JWT (access token + refresh token) + sesiones en DB |
| Tests | Vitest (unit, backend) |
| Build mobile | Vite |
| Build API | `tsc` |

---

## 2. Validaciones actuales

Todos los comandos pasan sin errores:

| Comando | Resultado |
|---|---|
| `npm run test --workspace=apps/api` | 22/22 tests pasando |
| `npm run typecheck --workspace=apps/api` | 0 errores |
| `npm run build --workspace=apps/api` | `tsc` exitoso |
| `npm run typecheck --workspace=apps/mobile` | 0 errores |
| `npm run build --workspace=apps/mobile` | 336 modules — built in ~2s |

---

## 3. Google Maps

La capa de mapas vive completamente en `apps/mobile/src/features/maps/` y está aislada del resto de la app.

| Componente / Hook | Descripción |
|---|---|
| `MapView.tsx` | Renderiza el mapa. Muestra UI amigable si falta la key o falla la carga del SDK. |
| `useGoogleMaps.ts` | Inyecta el SDK de Google Maps desde CDN. Previene carga duplicada. Estados: `idle / loading / loaded / error / no-key`. |
| `useCurrentLocation.ts` | GPS vía `@capacitor/geolocation`. 6 estados: `idle → requesting_permission → loading → success / denied / error`. No persiste coords en localStorage. |
| `useDirectionsRoute.ts` | Calcula ruta DRIVING con Directions API. Cleanup del renderer en `clear()`. Mensajes de error por cada código de la API. |
| `PlaceAutocompleteInput.tsx` | Autocomplete de Places biasado a Rapa Nui (`strictBounds: false`). Cleanup de listeners en unmount. |

**Ruta de prueba técnica:** `/maps/test`
— Solo disponible en `MODE === "development"`. No accesible en builds de producción.

**Variable requerida:** `VITE_GOOGLE_MAPS_API_KEY`
— Debe estar en `.env` del mobile. Sin ella, el mapa muestra un mensaje de error amigable y no rompe la app.

**APIs de Google Cloud requeridas:**
- Maps JavaScript API
- Places API
- Directions API

---

## 4. Flujo del pasajero — RequestRidePage

Archivo: `apps/mobile/src/pages/passenger/pages/RequestRidePage.tsx`

El flujo está completamente implementado:

1. Pasajero abre la página — el mapa se carga con SDK CDN.
2. Puede tocar "Usar mi ubicación actual" — GPS vía Capacitor.
3. Escribe origen y destino en los campos de Places Autocomplete.
4. Al tener ambos puntos, la ruta se calcula automáticamente (Directions API).
5. Se muestra distancia y duración estimada antes de confirmar.
6. El botón "Solicitar viaje" queda bloqueado hasta que la ruta esté calculada.
7. Al confirmar, la app envía al backend: coordenadas, distancia en metros y duración en segundos.
8. El backend calcula la tarifa — la app no calcula tarifa.
9. Se muestra la tarifa estimada con desglose de descuento referido si aplica.

**Estados de página:** `idle → calculating_route → ready_to_submit → submitting → success / error`

---

## 5. Backend — Módulo de rides

Archivos relevantes: `apps/api/src/modules/rides/`

### Validación de entrada

`createRideRequestSchema` (Zod) valida:
- Textos de origen y destino (máx. 150 chars)
- Coordenadas globales (lat/lng en rango válido)
- Mismo punto rechazado (diferencia < 0.0005° ≈ 55 m)
- `distanceMeters` entre 1 y 100,000 (máx. 100 km)
- `durationSeconds` mínimo 1

### Cálculo de tarifa

`estimateFare(distanceMeters)` — solo en backend, nunca en cliente:
- **2.300 CLP/km**
- **Mínimo 3.000 CLP**
- Fuente marcada como `"google_maps"` en la BD

Descuento de referido aplicado dinámicamente si el pasajero tiene un código activo no convertido.

### Transiciones de estado del viaje

| Método | Transición | Actor |
|---|---|---|
| `acceptRideRequest` | `requested → accepted` | Driver |
| `markEnRoute` | `accepted → driver_en_route` | Driver |
| `markArrived` | `driver_en_route → driver_arrived` | Driver |
| `startRide` | `driver_arrived → in_progress` | Driver |
| `completeRide` | `in_progress → completed` | Driver |
| `cancelRideRequest` | `requested → cancelled` | Passenger |
| `cancelAcceptedRide` | `accepted → cancelled` | Passenger o Driver |

Todas las transiciones son atómicas — el update solo ocurre si el estado actual coincide.

### Cobertura de tests

22 tests en `apps/api/src/modules/rides/__tests__/rides.service.test.ts`:

| Suite | Tests |
|---|---|
| `createRideRequest` | Creación con coords, driver 403, tarifa 2 km, tarifa mínima, tarifa no negativa, coords persistidas |
| `markEnRoute` | Happy path, passenger 403, estado incorrecto 409, driver ajeno 403 |
| `markArrived` | Happy path, passenger 403, estado incorrecto 409, driver ajeno 403 |

---

## 6. Instalación local

```bash
# Desde la raíz del monorepo
npm install

# Si apps/api/node_modules está vacío o faltan dependencias del API:
npm install --workspace=apps/api

# Rebuild del paquete shared si se modifica packages/shared/src:
npm run build --workspace=packages/shared
```

> **Importante:** No asumir que `apps/api/node_modules` contiene las dependencias.
> El workspace de npm puede no hoistear `drizzle-orm`, `postgres` ni `fastify` a la raíz.
> Si `npm run typecheck --workspace=apps/api` produce errores `TS2307: Cannot find module 'drizzle-orm'`,
> la causa es que `apps/api/node_modules` está incompleto — ejecutar `npm install --workspace=apps/api`.

---

## 7. Pendientes próximos

### Funcionales
- [ ] Construir UI del conductor para los estados `driver_en_route` y `driver_arrived` (endpoints ya implementados)
- [ ] Probar flujo pasajero-conductor de extremo a extremo en dispositivo real

### Base de datos / Backend
- [ ] Ejecutar migración `0011_rides_geo_fields.sql` en el ambiente de Railway/producción
- [ ] Evaluar conectar `estimateFare` a la tabla `fare_settings` (existe en BD) en lugar de constantes hardcodeadas

### Despliegue
- [ ] Configurar `VITE_GOOGLE_MAPS_API_KEY` en el entorno de build (Vercel, Netlify, o CI)
- [ ] Verificar que Railway ejecuta las migraciones antes del start

---

## 8. Reglas para contribuidores

### Flujo de trabajo obligatorio

- **No trabajar directamente en `main`.**
- Crear una rama por tarea: `feat/nombre-tarea` o `fix/nombre-fix`.
- Abrir Pull Request hacia `main` con descripción del cambio.

### Áreas protegidas — requieren aprobación de Rodrigo antes de tocar

- `apps/mobile/src/features/auth/`
- `apps/api/src/modules/auth/`
- Cualquier módulo de wallet o pagos
- Esquemas de base de datos (`apps/api/src/db/schema/`)
- Migraciones SQL (`apps/api/src/db/migrations/`)

### Checklist obligatorio antes de cada push

```bash
npm run test --workspace=apps/api
npm run typecheck --workspace=apps/api
npm run build --workspace=apps/api
npm run typecheck --workspace=apps/mobile
npm run build --workspace=apps/mobile
```

Los cinco comandos deben pasar sin errores. Si alguno falla, no hacer push.

### Reglas generales

- No modificar `auth` sin revisión.
- No tocar `wallet` ni `pagos` sin aprobación explícita.
- No hardcodear credenciales, keys ni tokens en el código.
- No silenciar errores de TypeScript con `as any` o `@ts-ignore` sin justificación documentada.
- Si se agregan dependencias npm, verificar que `npm install --workspace=apps/api` sigue funcionando.
