# Documentación RAPA GO V2.0.0

Esta carpeta contiene la documentación técnica y de producto del proyecto RAPA GO V2.0.0.

## Estructura

```
docs/
├── README.md                  — Este archivo. Índice general.
├── project-overview.md        — Visión general, contexto y objetivos del proyecto.
│
├── architecture/              — Decisiones y principios de arquitectura técnica.
│   ├── architecture-principles.md
│   ├── mobile-architecture.md
│   ├── backend-architecture.md
│   ├── database-architecture.md
│   ├── security-architecture.md
│   ├── realtime-architecture.md
│   ├── payments-architecture.md
│   └── maps-architecture.md
│
├── product/                   — Módulos, roles, flujos de usuario y navegación.
│   ├── modules.md
│   ├── user-roles.md
│   ├── navigation-map.md
│   ├── passenger-flow.md
│   ├── driver-flow.md
│   ├── guide-flow.md
│   ├── rent-a-car-flow.md
│   ├── wallet-flow.md
│   └── admin-flow.md
│
├── decisions/                 — Architecture Decision Records (ADR).
│   ├── 0001-monorepo.md
│   ├── 0002-mobile-stack.md
│   ├── 0003-backend-stack.md
│   ├── 0004-no-critical-localstorage.md
│   ├── 0005-real-time-source-of-truth.md
│   └── 0006-payment-provider-abstraction.md
│
└── development/               — Estándares, flujos de trabajo y criterios de calidad.
    ├── agent-rules.md
    ├── coding-standards.md
    ├── git-workflow.md
    ├── environment-variables.md
    └── definition-of-done.md
```

## Lectura recomendada para incorporarse al proyecto

1. `PROJECT_RULES.md` (raíz del repo) — Reglas obligatorias.
2. `docs/project-overview.md` — Contexto del negocio.
3. `docs/architecture/architecture-principles.md` — Principios técnicos.
4. `docs/product/modules.md` — Qué construimos.
5. `docs/development/definition-of-done.md` — Cuándo algo está terminado.
