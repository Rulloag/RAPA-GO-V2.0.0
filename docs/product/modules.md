# Módulos del Producto — RAPA GO V2.0.0

## Listado de módulos

| # | Módulo | Descripción | Prioridad |
|---|--------|-------------|-----------|
| 1 | Auth & Onboarding | Registro, login, verificación de identidad, onboarding por rol | Alta |
| 2 | Transporte | Solicitud de viaje, matching conductor-pasajero, viaje en tiempo real | Alta |
| 3 | Wallet | Saldo, recarga, historial de movimientos, transferencias internas | Alta |
| 4 | Pagos | Integración con proveedores de pago, flujo de cobro, comprobantes | Alta |
| 5 | Guías Turísticos | Catálogo de guías, reservas, calificaciones | Media |
| 6 | Rent a Car | Catálogo de vehículos, disponibilidad, reservas | Media |
| 7 | Mapas | Visualización en tiempo real de viajes, rutas, ubicación | Alta |
| 8 | Notificaciones | Push notifications, notificaciones in-app | Media |
| 9 | Administración | Aprobación de operadores, reportes, gestión de usuarios | Alta |
| 10 | Perfil de usuario | Edición de perfil, documentos, calificaciones recibidas | Media |

## Detalle por módulo

### Módulo 1: Auth & Onboarding
- Registro con email/teléfono.
- Verificación OTP.
- Selección de rol inicial (pasajero o operador).
- Onboarding específico por rol (conductor sube documentos, guía sube certificaciones).
- Login y renovación de sesión.
- Recuperación de contraseña.

**Dependencias técnicas**: Supabase Auth, Supabase Storage (documentos), backend `/auth`, `/users`.

### Módulo 2: Transporte
- Pasajero solicita viaje con origen/destino.
- Backend busca conductores disponibles (matching).
- Conductor recibe solicitud y acepta/rechaza.
- Viaje activo con posición del conductor en tiempo real.
- Finalización y cobro.
- Calificación mutua.

**Dependencias técnicas**: Supabase Realtime, Google Maps, PaymentProvider, Wallet.

### Módulo 3: Wallet
- Consulta de saldo actual.
- Recarga de saldo via PaymentProvider.
- Historial de movimientos (entradas, salidas, pagos).
- Retiro de saldo a cuenta bancaria (flujo futuro).

**Dependencias técnicas**: Backend `/wallet`, PostgreSQL, PaymentProvider.

### Módulo 4: Pagos
- Integración con Flow/Transbank/MercadoPago.
- Webhook de confirmación server-side.
- Comprobantes de pago.
- Reembolsos.

**Dependencias técnicas**: Backend `/payments`, PaymentProvider abstraction.

### Módulo 5: Guías Turísticos
- Catálogo público de guías disponibles.
- Perfil de guía con especialidades y calificación.
- Reserva de servicio guiado con fecha y hora.
- Pago de reserva.
- Calificación al completar.

**Dependencias técnicas**: Backend `/guides`, PaymentProvider, Wallet.

### Módulo 6: Rent a Car
- Catálogo de vehículos disponibles.
- Calendario de disponibilidad.
- Reserva con fechas de inicio y fin.
- Pago de reserva.
- Check-in/check-out digital.

**Dependencias técnicas**: Backend `/rentals`, PaymentProvider, Wallet.

### Módulo 7: Mapas
- Mapa interactivo en pantalla principal.
- Selección de destino con Places API.
- Visualización de conductor en ruta.
- Histórico de ruta del viaje completado.

**Dependencias técnicas**: Google Maps SDK, Capacitor Geolocation, Supabase Realtime.

### Módulo 8: Notificaciones
- Push notifications via FCM (Android) y APNs (iOS).
- Notificaciones in-app con badge y panel.
- Tipos: solicitud de viaje, estado de pago, aprobación de operador, nuevas reservas.

**Dependencias técnicas**: Capacitor Push Notifications, backend `/notifications`.

### Módulo 9: Administración
- Panel de aprobación de conductores, guías y rent a car.
- Revisión de documentos subidos.
- Gestión de usuarios (suspensión, activación).
- Reportes de viajes, pagos e incidentes.
- Configuración de tarifas.

**Dependencias técnicas**: Backend `/admin`, acceso con rol `admin`.

### Módulo 10: Perfil de usuario
- Edición de datos personales.
- Foto de perfil.
- Documentos (para operadores).
- Calificaciones recibidas.
- Historial de actividad.

**Dependencias técnicas**: Backend `/users`, Supabase Storage.

## Orden de implementación sugerido

1. Auth & Onboarding (base de todo lo demás).
2. Backend base + conexión Supabase.
3. Wallet + Pagos (infraestructura financiera).
4. Módulo Transporte (core del producto).
5. Mapas (integrado con Transporte).
6. Guías y Rent a Car.
7. Notificaciones.
8. Administración.
9. Perfil completo.
