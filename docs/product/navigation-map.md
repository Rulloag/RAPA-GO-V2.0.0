# Mapa de Navegación — RAPA GO V2.0.0

## Estructura de rutas

```
/
├── /auth
│   ├── /login
│   ├── /register
│   ├── /verify-otp
│   ├── /forgot-password
│   └── /reset-password
│
├── /onboarding
│   ├── /role-selection
│   ├── /driver-setup
│   ├── /guide-setup
│   └── /rental-setup
│
├── /passenger (rol: passenger)
│   ├── /home              — Mapa + botón solicitar viaje
│   ├── /request-trip      — Selección de destino
│   ├── /trip-active       — Viaje en curso (mapa en tiempo real)
│   ├── /trip-completed    — Resumen y calificación
│   ├── /guides            — Catálogo de guías
│   ├── /guides/:id        — Perfil y reserva de guía
│   ├── /rentals           — Catálogo de vehículos
│   ├── /rentals/:id       — Detalle y reserva de vehículo
│   ├── /wallet            — Saldo y movimientos
│   ├── /wallet/topup      — Recarga de saldo
│   ├── /history           — Historial de viajes y reservas
│   └── /profile           — Perfil del pasajero
│
├── /driver (rol: driver)
│   ├── /home              — Mapa + toggle disponibilidad
│   ├── /trip-request      — Solicitud entrante (aceptar/rechazar)
│   ├── /trip-active       — Viaje en curso
│   ├── /trip-completed    — Resumen del viaje
│   ├── /earnings          — Ganancias y retiros
│   ├── /history           — Historial de viajes
│   └── /profile           — Perfil del conductor + vehículo
│
├── /guide (rol: guide)
│   ├── /home              — Panel de bookings
│   ├── /availability      — Gestión de disponibilidad
│   ├── /bookings          — Lista de reservas
│   ├── /bookings/:id      — Detalle de reserva
│   ├── /earnings          — Ganancias
│   └── /profile           — Perfil del guía
│
├── /rental (rol: rental_operator)
│   ├── /home              — Panel de vehículos
│   ├── /vehicles          — Gestión de flota
│   ├── /vehicles/new      — Agregar vehículo
│   ├── /vehicles/:id      — Editar vehículo
│   ├── /bookings          — Reservas de vehículos
│   ├── /bookings/:id      — Detalle de reserva
│   ├── /earnings          — Ganancias
│   └── /profile           — Perfil del operador
│
└── /admin (rol: admin)
    ├── /dashboard         — Resumen operacional
    ├── /approvals         — Cola de aprobaciones pendientes
    ├── /approvals/:id     — Detalle de solicitud de aprobación
    ├── /users             — Gestión de usuarios
    ├── /users/:id         — Detalle de usuario
    ├── /trips             — Todos los viajes
    ├── /payments          — Todos los pagos
    └── /settings          — Configuración de tarifas y sistema
```

## Rutas públicas (sin autenticación)

- `/auth/login`
- `/auth/register`
- `/auth/verify-otp`
- `/auth/forgot-password`
- `/auth/reset-password`

## Rutas protegidas

Todas las demás rutas requieren token de sesión válido. El guard de ruta verifica el token antes de renderizar la pantalla.

## Guards de ruta

| Guard | Verifica |
|-------|----------|
| `AuthGuard` | Token válido y activo |
| `RoleGuard(passenger)` | Rol passenger activo |
| `RoleGuard(driver)` | Rol driver activo y aprobado |
| `RoleGuard(guide)` | Rol guide activo y aprobado |
| `RoleGuard(rental_operator)` | Rol rental_operator activo y aprobado |
| `RoleGuard(admin)` | Rol admin activo |

## Navegación entre roles

Desde el perfil, un usuario con múltiples roles puede cambiar el rol activo. Al cambiar de rol, se redirige al `/home` del rol seleccionado.

## Pantalla inicial post-login

Según el rol activo del usuario:
- `passenger` → `/passenger/home`
- `driver` → `/driver/home`
- `guide` → `/guide/home`
- `rental_operator` → `/rental/home`
- `admin` → `/admin/dashboard`
- Usuario sin rol aprobado → `/onboarding/role-selection`
