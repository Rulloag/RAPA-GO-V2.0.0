# RAPA GO API — Deploy Guide

Backend: Fastify 4 + TypeScript + Drizzle ORM + PostgreSQL.

## Variables de entorno requeridas

Nunca commitear `.env` real. Usa `.env.example` como plantilla.

| Variable | Descripción | Ejemplo |
|---|---|---|
| `NODE_ENV` | Entorno de ejecución | `production` |
| `PORT` | Puerto del servidor | `3000` |
| `HOST` | Dirección de escucha | `0.0.0.0` |
| `DATABASE_URL` | PostgreSQL connection string completa | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Secreto para firmar JWT (mín. 64 bytes aleatorios) | `openssl rand -hex 64` |
| `CORS_ORIGIN` | Origen(es) permitidos por CORS (sin wildcard en prod) | `https://app.rapago.cl` |

### Variables opcionales

| Variable | Descripción | Default |
|---|---|---|
| `PLATFORM_COMMISSION_PERCENT` | Comisión de plataforma (%) | `15` |
| `MOBILE_APP_DEEP_LINK` | Deep link base de la app | `rapago://` |

### Variables futuras (no activas)

`GOOGLE_MAPS_API_KEY`, `FLOW_API_KEY`, `FLOW_SECRET_KEY`, `TRANSBANK_COMMERCE_CODE`, `TRANSBANK_API_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, `PAYMENT_WEBHOOK_BASE_URL`

## Requisitos

- Node.js >= 20
- PostgreSQL 14+ (Supabase, Neon, Railway, local)
- npm >= 10

## Orden de deploy recomendado

### 1. Instalar dependencias

```bash
npm install
```

### 2. Verificar tipado

```bash
npm run typecheck
```

### 3. Compilar

```bash
npm run build
```

El compilado queda en `dist/`. El entry point es `dist/src/server.js`.

### 4. Ejecutar migraciones

```bash
npm run db:migrate
```

Requiere `DATABASE_URL` en el entorno. Las migraciones están en `drizzle/`.

### 5. Iniciar servidor

```bash
npm run start
```

O con variables inline:

```bash
NODE_ENV=production PORT=3000 npm run start
```

## Health check

```
GET /health
```

Responde:
```json
{
  "ok": true,
  "service": "rapa-go-api",
  "version": "2.0.0",
  "status": "healthy",
  "timestamp": "2026-05-15T00:00:00.000Z"
}
```

Útil para configurar health checks en Railway, Render, Fly.io, etc.

## CORS

Controlado por `CORS_ORIGIN`. En producción debe ser el dominio exacto del frontend sin trailing slash:

```
CORS_ORIGIN=https://app.rapago.cl
```

Para múltiples orígenes separar con coma:

```
CORS_ORIGIN=https://app.rapago.cl,https://admin.rapago.cl
```

Si `CORS_ORIGIN` no está definida en `NODE_ENV=production`, CORS queda desactivado (`false`). Nunca se usa wildcard `*`.

## Seguridad

- Helmet activo (headers seguros en todas las respuestas).
- Rate limit global: 100 req/min/IP. Auth routes: límite reducido internamente.
- JWT HS256 con expiración de 15 minutos. Requiere rotación de refresh tokens.
- Contraseñas con argon2id.
- Sin secrets en logs (Fastify logger en nivel `warn` en producción).

## Variables mobile

El frontend Ionic/Vite usa:

| Variable | Descripción | Ejemplo |
|---|---|---|
| `VITE_API_BASE_URL` | URL base del backend sin trailing slash | `https://api.rapago.cl` |
| `VITE_ENV` | Entorno | `production` |

Ver `apps/mobile/.env.example` para detalles completos.

## Dev local rápido

```bash
# Desde la raíz del monorepo
cd apps/api
cp .env.example .env
# Editar .env con DATABASE_URL y JWT_SECRET reales
PORT=3099 npx tsx --env-file=.env src/server.ts
```


## Reglas de producción del Bloque 08-A1

- `PAYMENT_WEBHOOK_BASE_URL` debe ser la URL HTTPS pública de la API.
- Las claves de Google Maps no deben quedar incrustadas en TypeScript ni en archivos de ejemplo.
- Android/iOS deben usar `VITE_API_BASE_URL` con una URL absoluta accesible desde el teléfono.
- No se permite usar `localhost` como respaldo dentro de una build móvil.
- La migración `0034_payments_schema_integrity.sql` repara instalaciones existentes.
- La migración `0031_cash_overpayment_benefits.sql` contiene la base idempotente necesaria para una base nueva.
