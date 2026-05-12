# Principios de Arquitectura — RAPA GO V2.0.0

## 1. Backend como única fuente de verdad

Todo estado crítico de la aplicación reside en el backend y la base de datos. El cliente mobile es una capa de presentación y captura de intención del usuario, nunca de almacenamiento o procesamiento crítico.

Aplica a: wallet, saldo, viajes activos, matching, reservas, pagos, aprobaciones, roles, ubicación de operadores.

## 2. Separación estricta de responsabilidades

```
Mobile (cliente)
  └── Captura input del usuario
  └── Muestra estado recibido del backend
  └── Gestiona UX: loading, error, éxito

Backend (API)
  └── Valida toda entrada
  └── Ejecuta lógica de negocio
  └── Gestiona transacciones
  └── Emite eventos en tiempo real

Base de datos (PostgreSQL/Supabase)
  └── Persiste estado definitivo
  └── Aplica restricciones de integridad
  └── Fuente de verdad absoluta
```

## 3. Seguridad por diseño

- Ningún secreto ni lógica de autorización en el cliente.
- Toda ruta sensible requiere token válido verificado en backend.
- Row Level Security (RLS) activo en Supabase como segunda capa.
- Los pagos nunca pasan por el cliente; solo se inician y se confirman via backend.

## 4. Tiempo real gestionado desde backend

Los eventos en tiempo real (posición de conductor, estado de viaje, notificaciones) son emitidos por el backend o Supabase Realtime. El cliente solo suscribe y renderiza.

## 5. Abstracción de proveedores externos

Los proveedores de pago, mapas y notificaciones se acceden a través de interfaces abstractas. El cambio de proveedor no debe implicar cambios en la lógica de negocio.

## 6. Validación en ambas capas

Zod valida en frontend (UX inmediata) y en backend (seguridad). La validación del frontend es conveniente, no confiable.

## 7. Módulo completo vs módulo visual

Un módulo es completo cuando tiene:
- Ruta real navegable.
- Validación de entrada.
- Estado de carga (loading).
- Estado de error con mensaje visible.
- Conexión real al backend con datos reales.
- Manejo de errores de red.

Un módulo que solo muestra pantallas con datos hardcodeados **no está completo**.

## 8. Cambios pequeños y revisables

Cada unidad de trabajo debe poder revisarse de forma aislada. Un PR grande que mezcla módulos, capas y refactors simultáneos está prohibido.

## 9. Sin compatibilidad hacia atrás forzada

No se mantiene código legado de V1 en V2. No se crean shims ni wrappers de compatibilidad sin decisión arquitectónica documentada (ADR).

## 10. Diagrama de capas

```
┌─────────────────────────────────┐
│         MOBILE CLIENT           │
│   Ionic React + Capacitor       │
│   Presentación + UX + Input     │
└────────────┬────────────────────┘
             │ HTTP / WebSocket
┌────────────▼────────────────────┐
│          BACKEND API            │
│   Fastify + TypeScript          │
│   Validación + Lógica negocio   │
│   Auth + Pagos + Matching       │
└────────────┬────────────────────┘
             │ SQL / Realtime
┌────────────▼────────────────────┐
│         BASE DE DATOS           │
│   PostgreSQL via Supabase       │
│   RLS + Integridad referencial  │
└─────────────────────────────────┘
```
