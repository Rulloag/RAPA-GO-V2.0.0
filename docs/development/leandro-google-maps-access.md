# Acceso operativo de Leandro — Google Maps / RAPA GO

## Objetivo

Este documento define lo necesario para que Leandro pueda colaborar en Google Maps dentro de RAPA GO V2.0.0 sin exponer secretos ni tocar lógica crítica del sistema.

Leandro podrá trabajar en:

- Google Maps
- Places Autocomplete
- Directions
- rutas visuales
- rutas por estado del viaje
- soporte futuro para rutas multi-destino

## Accesos necesarios

### 1. GitHub

Leandro debe tener acceso al repositorio `Rulloag/RAPA-GO-V2.0.0`.

Reglas de trabajo:

- No trabajar directo en `main`.
- Crear rama propia.
- Subir cambios a su rama.
- Abrir Pull Request hacia `main`.
- No hacer merge sin revisión.

Rama recomendada:

```bash
git checkout main
git pull origin main
git checkout -b leandro/maps-support
git push origin leandro/maps-support
```

### 2. Google Cloud / Google Maps

Leandro necesita una API key de desarrollo para trabajar localmente.

Recomendación de seguridad:

- No usar la key de producción.
- Crear una key separada para desarrollo.
- Nombre sugerido: `RAPA_GO_DEV_LEANDRO_MAPS_KEY`.
- Restringir la key por API y por HTTP referrer.

APIs necesarias:

- Maps JavaScript API
- Places API
- Directions API
- Routes API, solo si se usará para rutas multi-destino u optimización futura
- Geocoding API, opcional si más adelante se requiere convertir direcciones a coordenadas

Restricciones recomendadas para desarrollo local:

```txt
http://localhost:5173/*
http://127.0.0.1:5173/*
http://localhost:5174/*
```

No dejar la key sin restricciones.

## Variables de entorno

Leandro debe crear localmente el archivo:

```txt
apps/mobile/.env
```

Contenido:

```env
VITE_API_BASE_URL=/api
VITE_GOOGLE_MAPS_API_KEY=SU_KEY_LOCAL_DE_GOOGLE_MAPS
```

Si necesita backend local, debe configurar también:

```txt
apps/api/.env
```

Los valores de `DATABASE_URL`, `JWT_SECRET` y otros secretos deben entregarse por un canal seguro. No deben subirse a GitHub.

## Qué NO se debe hacer

- No subir `apps/mobile/.env`.
- No subir `apps/api/.env`.
- No pegar keys en README.
- No pegar keys en issues.
- No pegar keys en Pull Requests.
- No poner keys en código fuente.
- No compartir key de producción por chat.
- No usar una key sin restricciones HTTP/API.

## Archivos permitidos para trabajo Maps

Leandro puede trabajar, con cuidado, en:

```txt
apps/mobile/src/features/maps/
apps/mobile/src/pages/passenger/pages/RequestRidePage.tsx
apps/mobile/src/pages/passenger/pages/TripsPage.tsx
apps/mobile/src/pages/driver/index.tsx
apps/mobile/src/features/rides/rides.service.ts
```

`rides.service.ts` solo debe tocarse si necesita tipos o ajustes relacionados con rutas/Maps. No debe cambiar reglas de negocio.

## Archivos que NO debe tocar sin autorización

```txt
apps/api/src/modules/auth/
apps/api/src/modules/admin/
apps/api/src/modules/drivers/
apps/api/src/modules/rides/
apps/api/src/db/migrations/
apps/api/.env
apps/mobile/.env
wallet
pagos
pasarela
```

## Checklist de prueba local

Comandos iniciales:

```bash
git checkout main
git pull origin main
git checkout -b leandro/maps-support
npm install
npm run dev:api
npm run dev:mobile
```

Abrir:

```txt
http://localhost:5173/maps/test
```

Validar:

1. El mapa carga.
2. Places Autocomplete funciona.
3. Directions dibuja ruta.
4. `RequestRidePage` calcula distancia/duración.
5. Viaje inmediato funciona.
6. Viaje programado funciona.
7. Pasajero ve ubicación/ruta del conductor.
8. Conductor ve ruta según estado.
9. No se rompe la base preparada para multi-destino.

## Comandos antes de Pull Request

Antes de pedir revisión:

```bash
npm run typecheck --workspace=apps/mobile
npm run build --workspace=apps/mobile
npm run test --workspace=apps/api
```

## Entrega esperada de Leandro

En el Pull Request debe incluir:

- Rama usada.
- Archivos tocados.
- Cambios realizados.
- Bugs encontrados.
- Resultado de comandos.
- Capturas o logs si hay errores.

## Criterio de aceptación

Se aprueba solo si:

- No hay secretos en commits.
- No se toca backend ni lógica crítica sin autorización.
- Maps sigue funcionando.
- Build/typecheck pasan.
- El PR es acotado y revisable.
