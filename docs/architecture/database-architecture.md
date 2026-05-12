# Arquitectura de Base de Datos — RAPA GO V2.0.0

## Motor

PostgreSQL gestionado mediante **Supabase**. Supabase provee:
- PostgreSQL 15+.
- Row Level Security (RLS).
- Supabase Auth (gestión de usuarios base).
- Supabase Realtime (publicación de cambios via CDC).
- Supabase Storage (archivos: fotos de perfil, documentos).

## Entidades principales (modelo conceptual)

```
users              — Datos de perfil de todos los usuarios
user_roles         — Roles asignados (passenger, driver, guide, rental, admin)
driver_profiles    — Datos específicos de conductores
guide_profiles     — Datos específicos de guías
rental_profiles    — Datos específicos de operadores rent a car
vehicles           — Vehículos registrados
trips              — Viajes (solicitud, en curso, completado, cancelado)
trip_locations     — Historial de ubicaciones de un viaje
bookings           — Reservas de guías y rent a car
wallet_accounts    — Cuenta wallet por usuario
wallet_transactions — Movimientos del wallet (débito, crédito, retiro)
payments           — Transacciones de pago (estado, proveedor, referencia)
notifications      — Notificaciones por usuario
admin_approvals    — Solicitudes de aprobación de operadores
```

## Principios de base de datos

### RLS obligatorio
Toda tabla que contiene datos de usuario tiene RLS activo. Las políticas definen que un usuario solo puede leer/escribir sus propios registros. Las rutas administrativas usan el service role del backend, nunca el cliente.

### Integridad referencial
Las relaciones entre tablas usan foreign keys con `ON DELETE` definido explícitamente. No se crean relaciones implícitas por convención de nombre.

### Soft delete
Los registros críticos (viajes, pagos, wallets) nunca se eliminan físicamente. Se usan columnas `deleted_at` o campos de estado.

### Timestamps
Toda tabla tiene `created_at` y `updated_at` con valores por defecto de PostgreSQL (`now()`).

### Enums
Los estados se modelan con tipos `ENUM` de PostgreSQL para garantizar integridad:
- `trip_status`: `pending`, `accepted`, `in_progress`, `completed`, `cancelled`
- `payment_status`: `pending`, `processing`, `completed`, `failed`, `refunded`
- `user_role`: `passenger`, `driver`, `guide`, `rental_operator`, `admin`
- `approval_status`: `pending`, `approved`, `rejected`

## Acceso desde backend

El backend accede a la base de datos exclusivamente a través del **Supabase JS Client** con el `service_role` key (nunca expuesto al cliente). El cliente mobile accede opcionalmente con el `anon key` solo para operaciones de auth permitidas por RLS.

## Migrations

Los cambios de esquema se gestionan mediante migraciones versionadas de Supabase CLI. Nunca se modifican tablas directamente en producción sin una migración documentada.

## Supabase Storage

Uso previsto:
- Fotos de perfil de usuarios.
- Documentos de habilitación de conductores/guías.
- Fotos de vehículos.

Los archivos se referencian en la base de datos por URL. El acceso a archivos sensibles (documentos) se protege con políticas de Storage RLS.
