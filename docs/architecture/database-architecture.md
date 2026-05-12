# Arquitectura de Base de Datos — RAPA GO V2.0.0

## Motor

**PostgreSQL administrado**. El proveedor de infraestructura es intercambiable. Proveedores compatibles:

| Proveedor | Notas |
|-----------|-------|
| Supabase Postgres | Opción de referencia para desarrollo inicial. Incluye RLS, Realtime y Storage. |
| Neon | PostgreSQL serverless, buena opción para staging/producción. |
| Railway Postgres | Simple de provisionar, bueno para entornos de desarrollo. |
| AWS RDS | Opción enterprise para producción con alta disponibilidad. |
| GCP Cloud SQL | Alternativa enterprise en ecosistema Google Cloud. |

Cambiar de proveedor **no requiere modificar la app mobile** ni los contratos de API. Solo el backend adapta la capa de acceso a datos.

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

### Acceso exclusivo desde backend
La app mobile **nunca se conecta directamente a la base de datos**. Todo acceso pasa por el backend Fastify, que actúa como única puerta de entrada a los datos.

### Row Level Security (RLS)
Si el proveedor elegido es Supabase, se activa RLS en todas las tablas con datos de usuario. Con otros proveedores, la capa de autorización equivalente se implementa en el backend (middleware de roles + validaciones de servicio).

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

El backend accede a la base de datos a través de un cliente PostgreSQL con credenciales de servicio (nunca expuestas al cliente). Si se usa Supabase, se utiliza el `service_role` key. Con otros proveedores, se usa `DATABASE_URL` con usuario de solo-backend.

## Migrations

Los cambios de esquema se gestionan mediante migraciones versionadas. Nunca se modifican tablas directamente en producción sin una migración documentada y revisada.

## Almacenamiento de archivos

Uso previsto:
- Fotos de perfil de usuarios.
- Documentos de habilitación de conductores/guías.
- Fotos de vehículos.

Si el proveedor es Supabase, se usa Supabase Storage. Con otros proveedores, se usa S3 o equivalente. Los archivos se referencian en la base de datos por URL. El acceso a archivos sensibles (documentos) se protege mediante URLs firmadas generadas por el backend.
