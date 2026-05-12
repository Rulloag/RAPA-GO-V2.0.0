# Roles de Usuario — RAPA GO V2.0.0

## Roles del sistema

| Rol | Identificador | Descripción |
|-----|--------------|-------------|
| Pasajero | `passenger` | Usuario que solicita servicios (transporte, guías, rent a car). |
| Conductor | `driver` | Operador de transporte que acepta solicitudes de viaje. |
| Guía Turístico | `guide` | Profesional que ofrece servicios de guía turístico. |
| Operador Rent a Car | `rental_operator` | Persona o empresa que arrienda vehículos. |
| Administrador | `admin` | Equipo RAPA GO con acceso total al panel administrativo. |

## Permisos por rol

### Pasajero (`passenger`)
- Solicitar viajes.
- Reservar guías y vehículos.
- Recargar y usar wallet.
- Ver historial de servicios y pagos.
- Calificar operadores.
- Editar su perfil.

### Conductor (`driver`)
- Activar/desactivar disponibilidad.
- Ver y aceptar/rechazar solicitudes de viaje.
- Gestionar viajes activos (iniciar, completar, cancelar con justificación).
- Cobrar via wallet o pago directo (según configuración).
- Ver historial de viajes y ganancias.
- Editar su perfil y vehículo.

**Requiere aprobación administrativa antes de operar.**

### Guía Turístico (`guide`)
- Configurar disponibilidad y servicios ofrecidos.
- Ver y gestionar reservas.
- Cobrar servicios completados.
- Ver calificaciones recibidas.
- Editar su perfil y especialidades.

**Requiere aprobación administrativa antes de operar.**

### Operador Rent a Car (`rental_operator`)
- Agregar y gestionar su catálogo de vehículos.
- Configurar disponibilidad y tarifas.
- Ver y gestionar reservas.
- Cobrar reservas completadas.
- Editar su perfil.

**Requiere aprobación administrativa antes de operar.**

### Administrador (`admin`)
- Acceso completo al panel de administración.
- Aprobar o rechazar solicitudes de operadores.
- Suspender o activar cuentas de usuarios.
- Ver todos los viajes, reservas y pagos del sistema.
- Configurar tarifas base.
- Generar reportes.
- Gestionar notificaciones del sistema.

## Multi-rol

Un usuario puede tener múltiples roles. Ejemplo: una persona puede ser pasajero y conductor simultáneamente. La tabla `user_roles` gestiona esto con una fila por rol asignado.

La app muestra la interfaz correspondiente al rol activo. El usuario puede cambiar entre sus roles desde el perfil (si tiene más de uno aprobado).

## Flujo de aprobación para operadores

```
1. Usuario se registra como pasajero.
2. Solicita activar rol de operador (conductor / guía / rent a car).
3. Sube documentos requeridos según rol.
4. Solicitud queda en estado pending en admin_approvals.
5. Administrador revisa y aprueba o rechaza.
6. Usuario recibe notificación del resultado.
7. Si aprobado, el rol queda activo en user_roles.
```

## Seguridad de roles

- Los roles se verifican en el **backend** en cada request a rutas protegidas.
- El frontend solo usa el rol para mostrar/ocultar UI. Esto nunca reemplaza la verificación server-side.
- Los tokens JWT incluyen el rol activo del usuario, firmado por el backend.
- El cambio de rol (elevación de privilegios) solo ocurre después de aprobación administrativa en la base de datos.
