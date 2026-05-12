# Arquitectura Backend — RAPA GO V2.0.0

## Stack

| Tecnología | Versión objetivo | Rol |
|-----------|-----------------|-----|
| Fastify | 4.x | Framework HTTP |
| TypeScript | 5.x | Tipado estático |
| Zod | 3.x | Validación de entrada |
| postgres / pg | latest | Acceso a PostgreSQL (driver intercambiable según proveedor) |
| jsonwebtoken | 9.x | Verificación de JWT |

## Estructura de carpetas (target)

```
backend/
├── src/
│   ├── routes/          — Definición de rutas HTTP por módulo
│   ├── handlers/        — Lógica de cada endpoint
│   ├── services/        — Lógica de negocio desacoplada de HTTP
│   ├── repositories/    — Acceso a base de datos (queries SQL, independiente del proveedor)
│   ├── schemas/         — Esquemas Zod (validación de entrada/salida)
│   ├── plugins/         — Plugins Fastify (auth, cors, rate-limit)
│   ├── providers/       — Integraciones externas (pagos, mapas, push)
│   └── types/           — Tipos TypeScript del dominio
├── .env.example
└── tsconfig.json
```

## Módulos de API (target)

| Módulo | Prefijo de ruta | Descripción |
|--------|----------------|-------------|
| Auth | `/auth` | Login, registro, refresh, logout |
| Users | `/users` | Perfil, onboarding, documentos |
| Trips | `/trips` | Solicitud, matching, viaje activo, historial |
| Guides | `/guides` | Catálogo, reservas, disponibilidad |
| Rent-a-car | `/rentals` | Vehículos, disponibilidad, reservas |
| Wallet | `/wallet` | Saldo, movimientos, recargas, retiros |
| Payments | `/payments` | Iniciar pago, callback, verificación |
| Admin | `/admin` | Aprobaciones, fiscalización, reportes |
| Realtime | WebSocket | Eventos de viaje, posición, notificaciones |

## Principios del backend

### Validación de entrada
Toda entrada de un cliente se valida con Zod antes de ejecutar lógica de negocio. Un request con datos inválidos devuelve `400` con detalle del error.

### Respuesta de error estructurada
Todos los errores siguen este formato:
```json
{
  "error": {
    "code": "TRIP_NOT_FOUND",
    "message": "El viaje solicitado no existe.",
    "statusCode": 404
  }
}
```

### Autenticación
Cada ruta protegida verifica el token en el plugin de autenticación de Fastify. El token no se lee del body ni de query params, solo del header `Authorization: Bearer <token>`.

### Transacciones
Las operaciones que modifican múltiples tablas (crear viaje + descontar wallet + registrar pago) usan transacciones de PostgreSQL. No se hacen múltiples inserts separados sin transacción para operaciones críticas.

### Pagos
El flujo de pago es siempre:
1. Cliente inicia pago → backend crea una orden en BD.
2. Backend llama al proveedor de pago (Flow/Transbank/MercadoPago).
3. Proveedor llama al webhook del backend para confirmar.
4. Backend actualiza el estado en BD y notifica al cliente via Realtime.

El cliente nunca llama directamente al proveedor de pago.

### Rate limiting
Las rutas de auth y pagos tienen rate limiting estricto para prevenir abuso.

## Variables de entorno requeridas

Ver `docs/development/environment-variables.md` para el listado completo. Ninguna variable de entorno se expone al cliente mobile.
