# ADR-0001: Estructura Monorepo

**Estado**: Aprobado
**Fecha**: 2026-05-11
**Autor**: Rodrigo Alexander Ulloa González

## Contexto

El proyecto RAPA GO V2.0.0 comprende múltiples piezas: una app mobile (Ionic React), un backend (Fastify) y potencialmente código compartido (tipos, esquemas Zod). Se necesita decidir si estos viven en repositorios separados o en un monorepo.

## Decisión

Se utiliza una **estructura monorepo** con el siguiente layout:

```
RAPA-GO-V2.0.0/
├── mobile/      — App Ionic React + Capacitor
├── backend/     — API Fastify
├── shared/      — Tipos y esquemas Zod compartidos
├── docs/        — Documentación
└── PROJECT_RULES.md
```

No se requiere Turborepo ni Nx en V2.0.0. Si la complejidad lo justifica, se puede agregar más adelante con un ADR separado.

## Motivo

- **Tipos compartidos**: Los esquemas Zod y tipos TypeScript del dominio (User, Trip, Payment) deben ser idénticos en frontend y backend. Con un monorepo esto es trivial vía importación local.
- **Cambios atómicos**: Un cambio de contrato de API (nuevo campo en Trip) puede modificarse en un solo PR que abarca backend, shared y mobile.
- **Simplicidad inicial**: Un solo repo, un solo CI/CD, una sola configuración de secretos.
- **Visibilidad**: Todo el equipo ve el estado completo del proyecto en un lugar.

## Consecuencias

- Los commits mezclan cambios de backend y mobile. Requiere disciplina en mensajes de commit y uso de prefijos (`[mobile]`, `[backend]`, `[shared]`).
- El repositorio crece con el tiempo. Aceptable para el tamaño de este proyecto.
- Si en el futuro se necesita CI/CD diferenciado por workspace, se puede agregar sin cambiar la estructura.

## Alternativas descartadas

- **Repos separados**: Sincronizar tipos entre repos requiere publicar un paquete npm privado o usar git submodules. Añade fricción innecesaria en esta etapa.
