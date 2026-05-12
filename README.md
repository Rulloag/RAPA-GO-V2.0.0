# RAPA GO V2.0.0

Aplicación móvil de transporte, turismo y servicios para Rapa Nui. Versión 2.0.0 con arquitectura segura, backend real, pagos en línea y tiempo real.

**Visibilidad**: Privado

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Mobile | Ionic React + Capacitor + TypeScript |
| Backend | Fastify + TypeScript |
| Base de datos | PostgreSQL administrado (proveedor intercambiable: Supabase, Neon, Railway, AWS RDS, GCP Cloud SQL) |
| Autenticación | JWT / refresh tokens gestionados por el backend (proveedor de auth intercambiable) |
| Tiempo real | WebSocket gestionado por backend / Supabase Realtime como opción de infraestructura |
| Mapas | Google Maps SDK/API |
| Pagos | Flow / Transbank / MercadoPago (abstracción PaymentProvider) |
| Validación | Zod |

## Estructura del repositorio

```
RAPA-GO-V2.0.0/
├── PROJECT_RULES.md        — Reglas obligatorias del proyecto (leer primero)
├── package.json            — Workspace raíz del monorepo
├── tsconfig.base.json      — Configuración TypeScript base compartida
├── .npmrc                  — Configuración npm del monorepo
├── docs/                   — Documentación técnica y de producto
│   ├── README.md
│   ├── project-overview.md
│   ├── architecture/
│   ├── product/
│   ├── decisions/
│   └── development/
├── apps/
│   ├── mobile/             — App Ionic React + Capacitor + TypeScript
│   └── api/                — API Fastify + TypeScript
└── packages/
    ├── shared/             — Tipos, schemas Zod y constantes compartidas
    └── config/             — Configuraciones ESLint/TypeScript reutilizables
```

## Cómo empezar (desarrollo)

1. Leer `PROJECT_RULES.md`.
2. Leer `docs/project-overview.md` y `docs/architecture/architecture-principles.md`.
3. Copiar variables de entorno: `cp apps/api/.env.example apps/api/.env` y `cp apps/mobile/.env.example apps/mobile/.env`.
4. Instalar dependencias: `npm install` desde la raíz.
5. Iniciar desarrollo: `npm run dev:api` o `npm run dev:mobile`.

> Las dependencias aún no están instaladas. Esta estructura es la fase de setup del monorepo.

## Servicios

| Servicio | Descripción |
|---------|-------------|
| Transporte | Solicitud de viajes tipo Uber en Rapa Nui |
| Guías Turísticos | Reserva de guías certificados |
| Rent a Car | Arriendo de vehículos de operadores locales |
| Wallet | Saldo digital para pagar servicios |
| Pagos | Integración con proveedores de pago chilenos |
| Administración | Panel de gestión y fiscalización |
