# Flujo Administración — RAPA GO V2.0.0

## Acceso

Solo usuarios con rol `admin` pueden acceder a las rutas `/admin/*`. El rol es verificado en el backend en cada request. El frontend solo muestra el menú de admin si el token indica rol admin.

## Módulos del panel administrativo

### Dashboard (`/admin/dashboard`)

Vista general en tiempo real del sistema:
- Viajes activos en este momento.
- Conductores disponibles.
- Solicitudes de aprobación pendientes.
- Pagos procesados hoy.
- Alertas del sistema.

### Cola de aprobaciones (`/admin/approvals`)

```
[Lista de solicitudes pendientes]
  → Tipo: conductor / guía / rent a car.
  → Nombre del solicitante y fecha de solicitud.
  → Estado: pending / approved / rejected.

[Pantalla: /admin/approvals/:id]
  → Datos del solicitante.
  → Documentos subidos (visualización directa).
  → Historial de actividad del usuario en la plataforma.
  → Botón "Aprobar" → backend actualiza user_roles a activo.
  → Botón "Rechazar" → requiere motivo → backend registra rechazo.
  → Notificación automática al usuario del resultado.
```

### Gestión de usuarios (`/admin/users`)

```
[Lista de todos los usuarios]
  → Filtros: rol, estado, fecha de registro.
  → Búsqueda por nombre o email.

[Pantalla: /admin/users/:id]
  → Perfil completo del usuario.
  → Roles activos y su estado.
  → Historial de actividad (viajes, reservas, pagos).
  → Acciones: suspender cuenta, reactivar, cambiar rol.
  → Motivo requerido para suspensión.
```

### Gestión de viajes (`/admin/trips`)

```
  → Lista de todos los viajes del sistema (paginada).
  → Filtros: fecha, conductor, pasajero, estado.
  → Ver detalle de cualquier viaje.
  → Ver historial de ubicaciones del viaje.
```

### Gestión de pagos (`/admin/payments`)

```
  → Lista de todos los pagos.
  → Filtros: proveedor, estado, fecha, usuario.
  → Ver detalle de cada transacción.
  → Iniciar reembolso manual (requiere confirmación doble).
```

### Configuración del sistema (`/admin/settings`)

```
  → Tarifas base de transporte (CLP/km).
  → Comisión de la plataforma por servicio (%).
  → Configuración de tiempo de expiración de solicitudes de viaje.
  → Política de cancelación (horas para reembolso completo).
  → Estado de la plataforma (activa / en mantenimiento).
```

## Acciones administrativas críticas

| Acción | Requiere | Irreversible |
|--------|----------|-------------|
| Aprobar operador | Rol admin | No (se puede revocar) |
| Rechazar operador | Rol admin + motivo | No (se puede reabrir) |
| Suspender cuenta | Rol admin + motivo | No (reactivable) |
| Eliminar cuenta | No disponible en V2.0.0 | — |
| Reembolso manual | Rol admin + confirmación | Sí (financiero) |

## Auditoría

Toda acción administrativa se registra en una tabla de auditoría (`admin_audit_log`) con:
- Usuario administrador que ejecutó la acción.
- Tipo de acción.
- ID del recurso afectado.
- Timestamp.
- Datos antes y después del cambio.

Esta tabla es de solo lectura desde el panel. No se puede modificar ni eliminar desde la app.
