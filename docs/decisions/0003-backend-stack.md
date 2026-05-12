# ADR-0003: Stack Backend — Fastify + TypeScript + Supabase

**Estado**: Aprobado
**Fecha**: 2026-05-11
**Autor**: Rodrigo Alexander Ulloa González

## Contexto

Se necesita un backend API que soporte: autenticación, lógica de negocio, integración con base de datos PostgreSQL, webhooks de pago, tiempo real y gestión de roles.

## Decisión

**Fastify** como framework HTTP, **TypeScript** como lenguaje, **Supabase** (PostgreSQL + Auth + Realtime + Storage) como infraestructura de base de datos.

## Motivo — Fastify

- **Rendimiento**: Fastify es consistentemente más rápido que Express en benchmarks estándar.
- **TypeScript nativo**: Soporte de TypeScript de primera clase sin configuración adicional.
- **Schema validation**: Fastify soporta validación de schemas JSON nativamente, complementando Zod.
- **Plugin system**: Arquitectura de plugins cohesiva para auth, cors, rate-limit, etc.
- **Madurez**: Framework estable con soporte LTS y adopción enterprise.

## Motivo — Supabase

- **PostgreSQL gestionado**: Sin gestión de servidor de base de datos. Supabase provee backups, escalado y monitoreo.
- **Row Level Security**: Capa de seguridad adicional directamente en la base de datos.
- **Realtime incluido**: Supabase Realtime via CDC sin configurar infraestructura adicional.
- **Auth incluido**: Supabase Auth gestiona registro, OTP, JWT y refresh tokens.
- **Storage incluido**: Para archivos (fotos, documentos) sin configurar S3 separado.
- **Costo inicial bajo**: Plan gratuito suficiente para desarrollo. Pricing predecible en producción.

## Consecuencias

- El backend depende de Supabase como proveedor de infraestructura. Migrar a otro proveedor PostgreSQL requeriría adaptar Auth y Storage.
- El `SUPABASE_SERVICE_ROLE_KEY` solo puede vivir en el backend. Nunca en el cliente.
- La lógica de RLS debe mantenerse sincronizada con las migraciones de esquema.

## Alternativas descartadas

- **Express**: Más popular pero más lento y sin TypeScript nativo. Fastify es la evolución natural.
- **NestJS**: Framework más completo pero con mayor complejidad y overhead para este proyecto.
- **PostgreSQL propio**: Requiere gestión de servidor, backups y monitoreo. Supabase lo resuelve.
- **Firebase**: NoSQL, no compatible con el modelo relacional requerido por el dominio.
