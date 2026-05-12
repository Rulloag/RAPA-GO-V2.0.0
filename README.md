# RAPA GO V2.0.0

Aplicación móvil de transporte, turismo y servicios para Rapa Nui. Versión 2.0.0 con arquitectura segura, backend real, pagos en línea y tiempo real.

**Visibilidad**: Privado

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Mobile | Ionic React + Capacitor + TypeScript |
| Backend | Fastify + TypeScript |
| Base de datos | PostgreSQL via Supabase |
| Autenticación | Supabase Auth / JWT |
| Tiempo real | Supabase Realtime / WebSocket |
| Mapas | Google Maps SDK/API |
| Pagos | Flow / Transbank / MercadoPago (abstracción PaymentProvider) |
| Validación | Zod |

## Estructura del repositorio

```
RAPA-GO-V2.0.0/
├── PROJECT_RULES.md   — Reglas obligatorias del proyecto (leer primero)
├── docs/              — Documentación técnica y de producto
│   ├── README.md
│   ├── project-overview.md
│   ├── architecture/
│   ├── product/
│   ├── decisions/
│   └── development/
├── mobile/            — App Ionic React + Capacitor (próxima fase)
├── backend/           — API Fastify (próxima fase)
└── shared/            — Tipos y esquemas Zod compartidos (próxima fase)
```

## Cómo empezar

1. Leer `PROJECT_RULES.md`.
2. Leer `docs/project-overview.md`.
3. Leer `docs/architecture/architecture-principles.md`.
4. Revisar `docs/development/definition-of-done.md`.

El código de aplicación (mobile, backend) se creará en fases posteriores siguiendo la arquitectura documentada.

## Servicios

| Servicio | Descripción |
|---------|-------------|
| Transporte | Solicitud de viajes tipo Uber en Rapa Nui |
| Guías Turísticos | Reserva de guías certificados |
| Rent a Car | Arriendo de vehículos de operadores locales |
| Wallet | Saldo digital para pagar servicios |
| Pagos | Integración con proveedores de pago chilenos |
| Administración | Panel de gestión y fiscalización |
