# Variables de Entorno — RAPA GO V2.0.0

## Principios

1. Ninguna variable de entorno con valor real está en el repositorio.
2. Los archivos `.env` están en `.gitignore`.
3. Los archivos `.env.example` con valores vacíos o de ejemplo SÍ están en el repositorio.
4. Las variables del backend nunca se exponen al cliente mobile.
5. El cliente mobile solo tiene acceso a la URL base del backend y claves públicas no sensibles (Google Maps).
6. El proveedor de base de datos es intercambiable. Las variables reflejan el proveedor activo sin requerir cambios en la app mobile.

## Variables del Backend (`apps/api/.env`)

```env
# Servidor
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# Base de datos — usar según proveedor activo (solo uno a la vez)
# Opción A: Supabase
SUPABASE_URL=https://<tu-proyecto>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<solo-backend-nunca-cliente>

# Opción B: Cualquier PostgreSQL administrado (Neon, Railway, AWS RDS, GCP Cloud SQL)
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<database>

# Autenticación — JWT gestionado por el backend
JWT_SECRET=<secreto-largo-y-aleatorio>
JWT_EXPIRY=3600          # segundos — duración del access token
REFRESH_TOKEN_EXPIRY=604800  # segundos — 7 días

# Google Maps (server-side)
GOOGLE_MAPS_API_KEY=<key-para-backend-sin-restriccion-de-origen>

# Pagos — Flow
FLOW_API_KEY=<api-key-flow>
FLOW_SECRET_KEY=<secret-key-flow>
FLOW_ENVIRONMENT=sandbox  # sandbox | production
FLOW_WEBHOOK_SECRET=<para-verificar-firma-webhook>

# Pagos — Transbank
TRANSBANK_COMMERCE_CODE=<codigo-comercio>
TRANSBANK_API_KEY=<api-key-transbank>
TRANSBANK_ENVIRONMENT=integration  # integration | production

# Pagos — MercadoPago
MERCADOPAGO_ACCESS_TOKEN=<access-token>
MERCADOPAGO_WEBHOOK_SECRET=<para-verificar-firma-webhook>

# Comisión plataforma
PLATFORM_COMMISSION_PERCENT=15

# URLs
MOBILE_APP_DEEP_LINK=rapago://
PAYMENT_WEBHOOK_BASE_URL=https://api.rapago.cl
```

## Variables del Mobile (`apps/mobile/.env`)

Solo la URL del backend y claves públicas no sensibles. **El cliente no necesita conocer el proveedor de base de datos.**

```env
# API Backend — única conexión del cliente mobile
VITE_API_BASE_URL=https://api.rapago.cl/api/v1

# Google Maps (key restringida por bundleId/packageName)
VITE_GOOGLE_MAPS_API_KEY=<key-publica-restringida-por-app>

# Ambiente
VITE_ENV=development  # development | staging | production
```

> **Nota**: Las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` han sido eliminadas del cliente mobile. La app mobile no se conecta directamente a ningún proveedor de base de datos o autenticación.

## Ambientes

| Ambiente | Backend URL | Base de datos | Pagos |
|----------|------------|---------------|-------|
| `development` | `localhost:3000` | Proveedor de desarrollo (ej. Supabase dev / Neon) | Sandbox/Integration |
| `staging` | `staging.api.rapago.cl` | Proveedor staging | Sandbox/Integration |
| `production` | `api.rapago.cl` | Proveedor producción | Producción real |

## Gestión de secretos en producción

- Las variables de producción se configuran en el proveedor de hosting del backend (variables de entorno de la plataforma, nunca en archivos).
- Rotación de keys: ante cualquier sospecha de exposición, rotar inmediatamente y registrar el incidente.
- Nunca loggear valores de variables de entorno sensibles en los logs del servidor.

## Checklist al incorporar un nuevo desarrollador

- [ ] Recibir `apps/api/.env` con valores de desarrollo por canal seguro (nunca email ni chat público).
- [ ] Recibir `apps/mobile/.env` con valores de desarrollo.
- [ ] Verificar que `.gitignore` incluye los archivos `.env`.
- [ ] Nunca commitear un archivo `.env` con valores reales.
