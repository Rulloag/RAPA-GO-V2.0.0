import type { ComponentType } from "react";

export type UserRole = "passenger" | "driver" | "guide" | "rental" | "admin";

export interface RouteMetadata {
  path: string;
  label: string;
  role: UserRole | "public";
  plannedFeatures: string[];
}

export interface TabItem {
  path: string;
  label: string;
  icon: string;
}

export const ROUTE_METADATA: RouteMetadata[] = [
  // Passenger
  { path: "/passenger/home", label: "Inicio Pasajero", role: "passenger", plannedFeatures: ["Mapa en tiempo real", "Solicitar viaje rápido", "Historial reciente"] },
  { path: "/passenger/request-ride", label: "Solicitar Viaje", role: "passenger", plannedFeatures: ["Selección de origen/destino", "Estimación de precio", "Selección de tipo de vehículo"] },
  { path: "/passenger/trips", label: "Mis Viajes", role: "passenger", plannedFeatures: ["Historial de viajes", "Calificación de conductores", "Facturación"] },
  { path: "/passenger/guides", label: "Guías", role: "passenger", plannedFeatures: ["Catálogo de guías turísticos", "Reserva de tours", "Calificaciones"] },
  { path: "/passenger/rentals", label: "Arriendo", role: "passenger", plannedFeatures: ["Catálogo de vehículos", "Reserva por días", "Entrega y devolución"] },
  { path: "/passenger/wallet", label: "Billetera", role: "passenger", plannedFeatures: ["Saldo disponible", "Historial de transacciones", "Recargar saldo"] },
  { path: "/passenger/profile", label: "Perfil", role: "passenger", plannedFeatures: ["Datos personales", "Documentos", "Configuración"] },
  { path: "/support-center", label: "Centro de ayuda", role: "passenger", plannedFeatures: ["Reclamos", "Objetos perdidos", "Seguimiento administrativo"] },

  // Driver
  { path: "/driver/home", label: "Inicio Conductor", role: "driver", plannedFeatures: ["Estado en línea/fuera de línea", "Solicitudes cercanas", "Estadísticas del día"] },
  { path: "/driver/requests", label: "Solicitudes", role: "driver", plannedFeatures: ["Lista de solicitudes activas", "Aceptar/rechazar viajes", "Navegación integrada"] },
  { path: "/driver/trips", label: "Mis Viajes", role: "driver", plannedFeatures: ["Historial de viajes completados", "Incidencias", "Calificaciones recibidas"] },
  { path: "/driver/earnings", label: "Ganancias", role: "driver", plannedFeatures: ["Resumen diario/semanal/mensual", "Liquidaciones", "Historial de pagos"] },
  { path: "/driver/profile", label: "Perfil", role: "driver", plannedFeatures: ["Datos del vehículo", "Documentos habilitantes", "Configuración"] },

  // Guide
  { path: "/guide/home", label: "Inicio Guía", role: "guide", plannedFeatures: ["Reservas del día", "Mapa de puntos turísticos", "Estado disponibilidad"] },
  { path: "/guide/tours", label: "Mis Tours", role: "guide", plannedFeatures: ["Crear/editar tours", "Precios y disponibilidad", "Galería de fotos"] },
  { path: "/guide/bookings", label: "Reservas", role: "guide", plannedFeatures: ["Reservas pendientes/confirmadas", "Chat con pasajeros", "Cancelaciones"] },
  { path: "/guide/earnings", label: "Ganancias", role: "guide", plannedFeatures: ["Comisiones por tour", "Liquidaciones", "Historial de pagos"] },
  { path: "/guide/profile", label: "Perfil", role: "guide", plannedFeatures: ["Certificaciones", "Idiomas", "Reseñas"] },

  // Rental
  { path: "/rental/home", label: "Inicio Arriendo", role: "rental", plannedFeatures: ["Estado de flota", "Reservas del día", "Alertas de mantenimiento"] },
  { path: "/rental/vehicles", label: "Vehículos", role: "rental", plannedFeatures: ["Catálogo de flota", "Estado y disponibilidad", "Mantenimiento"] },
  { path: "/rental/bookings", label: "Reservas", role: "rental", plannedFeatures: ["Reservas activas", "Check-in/check-out", "Contratos digitales"] },
  { path: "/rental/earnings", label: "Ganancias", role: "rental", plannedFeatures: ["Ingresos por vehículo", "Ocupación de flota", "Liquidaciones"] },
  { path: "/rental/profile", label: "Perfil", role: "rental", plannedFeatures: ["Datos de empresa", "Documentos legales", "Configuración"] },

  // Admin
  { path: "/admin/home", label: "Panel Admin", role: "admin", plannedFeatures: ["KPIs en tiempo real", "Alertas del sistema", "Actividad reciente"] },
  { path: "/admin/users", label: "Usuarios", role: "admin", plannedFeatures: ["Gestión de cuentas", "Roles y permisos", "Suspensiones"] },
  { path: "/admin/drivers", label: "Conductores", role: "admin", plannedFeatures: ["Aprobación de conductores", "Seguimiento en mapa", "Documentos"] },
  { path: "/admin/guides", label: "Guías", role: "admin", plannedFeatures: ["Aprobación de guías", "Certificaciones", "Calificaciones"] },
  { path: "/admin/rentals", label: "Arriendos", role: "admin", plannedFeatures: ["Empresas de arriendo", "Flota registrada", "Aprobaciones"] },
  { path: "/admin/trips", label: "Viajes", role: "admin", plannedFeatures: ["Monitor de viajes activos", "Historial global", "Incidencias"] },
  { path: "/admin/payments", label: "Pagos", role: "admin", plannedFeatures: ["Transacciones globales", "Conciliación bancaria", "Fraudes"] },
  { path: "/admin/settings", label: "Configuración", role: "admin", plannedFeatures: ["Parámetros del sistema", "Tarifas", "Integraciones"] },
  { path: "/admin/support", label: "Soporte", role: "admin", plannedFeatures: ["Reclamos", "Objetos perdidos", "Historial y resolución"] },

  // Profile (shared)
  { path: "/profile", label: "Mi Perfil", role: "passenger", plannedFeatures: ["Foto de perfil", "Datos personales", "Preferencias"] },
  { path: "/profile/documents", label: "Documentos", role: "passenger", plannedFeatures: ["Cédula de identidad", "Licencia de conducir", "Estado de verificación"] },
  { path: "/profile/bank-account", label: "Cuenta Bancaria", role: "passenger", plannedFeatures: ["Datos bancarios para pagos", "Verificación de cuenta", "Historial de transferencias"] },
  { path: "/profile/security", label: "Seguridad", role: "passenger", plannedFeatures: ["Cambio de contraseña", "Autenticación 2FA", "Sesiones activas"] },
  { path: "/profile/notifications", label: "Notificaciones", role: "passenger", plannedFeatures: ["Preferencias de notificación", "Push notifications", "Email/SMS"] },
];
