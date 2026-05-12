# Arquitectura de Seguridad — RAPA GO V2.0.0

## Modelo de amenazas — contexto

- App mobile pública descargable desde tiendas.
- Usuarios desconocidos pueden registrarse.
- Flujos financieros reales (wallet, pagos).
- Operadores con distintos niveles de privilegio.
- Datos de ubicación en tiempo real.

## Capas de seguridad

```
[Cliente mobile]
  ↓  HTTPS/TLS obligatorio
[Backend Fastify]
  ↓  JWT verificado en cada request
[Lógica de negocio + autorización de rol]
  ↓  Credenciales de servicio (server-only, nunca expuestas al cliente)
[PostgreSQL administrado]
```

## Autenticación

- Implementada con **JWT firmado** gestionado por el backend. El proveedor de auth es intercambiable (JWT propio, Supabase Auth u otro) siempre que esté encapsulado detrás del backend.
- La app mobile nunca se conecta directamente a un proveedor de autenticación externo.
- Tokens de acceso de vida corta (máx. 1 hora).
- Refresh tokens con rotación.
- El token viaja solo en el header `Authorization: Bearer <token>`.
- El token nunca se almacena en `localStorage`. Se gestiona en memoria o en Secure Storage nativo via Capacitor.

## Autorización

- El backend verifica el rol del usuario en cada endpoint sensible.
- El frontend oculta UI según el rol, pero esto es solo UX. La autorización real es siempre server-side.
- Roles: `passenger`, `driver`, `guide`, `rental_operator`, `admin`.
- Las rutas `/admin/*` requieren rol `admin` verificado en backend.

## Pagos — seguridad

- Ningún dato de tarjeta o cuenta bancaria pasa por el backend RAPA GO.
- El backend actúa como orquestador: crea la orden, obtiene el token/URL de pago del proveedor y lo devuelve al cliente.
- La confirmación de pago llega via **webhook** del proveedor al backend. El cliente no puede confirmar un pago.
- Cada intento de pago tiene un identificador único (`payment_id`) almacenado en BD antes de contactar al proveedor.

## Variables de entorno

- Ninguna API key, secret o credencial está en el código fuente.
- El cliente mobile no tiene acceso a ninguna variable de entorno del backend.
- Las credenciales de acceso a la base de datos (sea `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` u equivalente) solo residen en el backend. Nunca en el cliente.

## Datos sensibles en tránsito

- Toda comunicación usa HTTPS/TLS.
- Los certificados se gestionan a nivel de infraestructura del proveedor elegido.

## Row Level Security (RLS)

Si el proveedor de base de datos es Supabase, RLS es una segunda capa de defensa: aunque el backend valide la autorización, RLS impide que un bug en el backend exponga datos de otro usuario. Con otros proveedores PostgreSQL, la responsabilidad de aislamiento recae completamente en el backend (middleware de roles + validaciones de servicio). En ambos casos, todas las tablas con datos de usuario deben tener protección de acceso activa.

## Rate limiting

| Ruta | Límite |
|------|--------|
| `/auth/login` | 10 intentos / min por IP |
| `/auth/register` | 5 intentos / min por IP |
| `/payments/*` | 20 requests / min por usuario |
| Resto de rutas | 100 requests / min por usuario |

## Datos de ubicación

- La ubicación del conductor se envía al backend y se distribuye a los pasajeros relevantes via Realtime.
- La ubicación nunca se almacena permanentemente más allá del viaje activo. Al completarse el viaje, la ubicación en tiempo real se descarta.
- El historial de ruta del viaje se almacena en `trip_locations` solo mientras sea operacionalmente necesario.

## Política de secretos

- Uso de `.env` (nunca en git). Ver `.gitignore`.
- Rotación de keys ante cualquier sospecha de exposición.
- El repositorio tiene protección de secretos activa.
