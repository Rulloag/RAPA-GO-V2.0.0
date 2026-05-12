# ADR-0003: Stack Backend — Fastify + TypeScript + PostgreSQL administrado

**Estado**: Aprobado (revisado 2026-05-12)
**Fecha original**: 2026-05-11
**Revisión**: 2026-05-12 — Supabase deja de ser proveedor obligatorio; PostgreSQL administrado es la decisión, el proveedor es intercambiable.
**Autor**: Rodrigo Alexander Ulloa González

## Contexto

Se necesita un backend API que soporte: autenticación, lógica de negocio, integración con base de datos PostgreSQL, webhooks de pago, tiempo real y gestión de roles. El proveedor de infraestructura de base de datos debe poder cambiarse sin reescribir la app mobile.

## Decisión

**Fastify** como framework HTTP, **TypeScript** como lenguaje, **PostgreSQL administrado** como base de datos. El proveedor de PostgreSQL es intercambiable. Supabase es la opción de referencia para desarrollo inicial, pero no es una dependencia obligatoria.

## Motivo — Fastify

- **Rendimiento**: Fastify es consistentemente más rápido que Express en benchmarks estándar.
- **TypeScript nativo**: Soporte de TypeScript de primera clase sin configuración adicional.
- **Schema validation**: Fastify soporta validación de schemas JSON nativamente, complementando Zod.
- **Plugin system**: Arquitectura de plugins cohesiva para auth, cors, rate-limit, etc.
- **Madurez**: Framework estable con soporte LTS y adopción enterprise.

## Motivo — PostgreSQL administrado (proveedor intercambiable)

- **Portabilidad**: La app mobile no conoce el proveedor. Solo se comunica con el backend.
- **Sin vendor lock-in**: Cambiar de Supabase a Neon, Railway, AWS RDS o GCP Cloud SQL no requiere tocar la app mobile ni los contratos de API.
- **PostgreSQL como estándar**: El modelo relacional del dominio (viajes, wallet, pagos) requiere SQL. El motor específico es PostgreSQL en todos los casos.
- **Supabase como opción válida**: Supabase sigue siendo una opción excelente para desarrollo y producción por su RLS, Realtime y Storage incluidos, pero no es la única opción.

## Proveedores compatibles

| Proveedor | Caso de uso recomendado |
|-----------|------------------------|
| Supabase Postgres | Desarrollo, proyectos nuevos, RLS incluido |
| Neon | Staging/producción serverless |
| Railway Postgres | Entornos de desarrollo simples |
| AWS RDS | Producción enterprise con alta disponibilidad |
| GCP Cloud SQL | Producción en ecosistema Google Cloud |

## Consecuencias

- El backend encapsula toda la lógica de acceso a datos. La capa `repositories/` abstrae el proveedor.
- Las credenciales de base de datos (`DATABASE_URL` o equivalente) solo viven en el backend.
- Si se usa Supabase, RLS es una capa de defensa adicional. Con otros proveedores, la autorización recae completamente en el backend.
- La autenticación es gestionada por el backend (JWT + refresh tokens). El proveedor de auth también es intercambiable.

## Alternativas descartadas

- **Express**: Más popular pero más lento y sin TypeScript nativo. Fastify es la evolución natural.
- **NestJS**: Framework más completo pero con mayor complejidad y overhead para este proyecto.
- **Conexión directa del cliente a la BD**: Prohibido. La app mobile no se conecta a ningún proveedor de BD directamente.
- **Firebase**: NoSQL, no compatible con el modelo relacional requerido por el dominio.
