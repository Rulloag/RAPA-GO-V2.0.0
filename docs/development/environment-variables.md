# Variables de Entorno — RAPA GO V2.0.0

## Principios

1. Ninguna variable de entorno con valor real está en el repositorio.
2. Los archivos `.env` están en `.gitignore`.
3. Los archivos `.env.example` con valores vacíos o de ejemplo SÍ están en el repositorio.
4. Las variables del backend nunca se exponen al cliente mobile.
5. El cliente mobile solo tiene acceso a variables públicas no sensibles (ej. clave pública de Supabase, clave restringida de Google Maps).

## Variables del Backend (`backend/.env`)

```env
# Servidor
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# Supabase
SUPABASE_URL=https://<tu-proyecto>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<solo-backend-nunca-cliente>
SUPABASE_JWT_SECRET=<secreto-para-verificar-tokens>

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

# JWT (si se usa JWT propio en lugar de Supabase Auth)
JWT_SECRET=<secreto-largo-y-aleatorio>
JWT_EXPIRY=3600  # segundos

# URLs
MOBILE_APP_DEEP_LINK=rapago://
PAYMENT_WEBHOOK_BASE_URL=https://api.rapago.cl
```

## Variables del Mobile (`mobile/.env`)

Solo variables públicas no sensibles:

```env
# Supabase (clave pública — anon key, no service role)
VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key-publica>

# Google Maps (key restringida por bundleId/packageName)
VITE_GOOGLE_MAPS_API_KEY=<key-publica-restringida-por-app>

# API Backend
VITE_API_BASE_URL=https://api.rapago.cl/api/v1

# Ambiente
VITE_ENV=development  # development | staging | production
```

## Ambientes

| Ambiente | Backend URL | Supabase | Pagos |
|----------|------------|----------|-------|
| `development` | `localhost:3000` | Proyecto dev | Sandbox/Integration |
| `staging` | `staging.api.rapago.cl` | Proyecto staging | Sandbox/Integration |
| `production` | `api.rapago.cl` | Proyecto prod | Producción real |

## Gestión de secretos en producción

- Las variables de producción se configuran en el proveedor de hosting del backend (variables de entorno de la plataforma, nunca en archivos).
- Rotación de keys: ante cualquier sospecha de exposición, rotar inmediatamente y registrar el incidente.
- Nunca loggear valores de variables de entorno sensibles en los logs del servidor.

## Checklist al incorporar un nuevo desarrollador

- [ ] Recibir `backend/.env` con valores de desarrollo por canal seguro (nunca email ni chat público).
- [ ] Recibir `mobile/.env` con valores de desarrollo.
- [ ] Verificar que `.gitignore` incluye los archivos `.env`.
- [ ] Nunca commitear un archivo `.env` con valores reales.
