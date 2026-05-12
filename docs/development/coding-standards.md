# Estándares de Código — RAPA GO V2.0.0

## General

- **Lenguaje**: TypeScript estricto. `"strict": true` en `tsconfig.json`. Sin `any` explícito salvo casos justificados con comentario.
- **Formato**: Prettier con configuración del proyecto. El formato se verifica en CI.
- **Lint**: ESLint con reglas de TypeScript y React. Sin warnings ignorados silenciosamente.
- **Nombres en inglés**: Todo código, variables, funciones, tipos y comentarios técnicos en inglés. Los mensajes de usuario en la UI pueden estar en español.

## Nomenclatura

| Elemento | Convención | Ejemplo |
|----------|-----------|---------|
| Variables y funciones | camelCase | `getUserById`, `tripStatus` |
| Tipos e interfaces | PascalCase | `TripStatus`, `UserProfile` |
| Enums | PascalCase | `PaymentStatus.Completed` |
| Constantes | UPPER_SNAKE_CASE | `MAX_RETRY_ATTEMPTS` |
| Archivos de componente | PascalCase | `TripCard.tsx` |
| Archivos de servicio/util | camelCase | `tripService.ts`, `formatCurrency.ts` |
| Rutas de API | kebab-case | `/api/v1/trip-requests` |

## TypeScript

- Toda función pública debe tener tipos de parámetros y retorno explícitos.
- Usar `interface` para objetos del dominio, `type` para uniones y aliases.
- No usar `as any`. Si es necesario, usar `as unknown as T` con comentario explicativo.
- Los esquemas Zod definen la forma de los datos de entrada. Los tipos TypeScript se infieren de los schemas con `z.infer<>`.

## React / Ionic (Mobile)

- Componentes funcionales con hooks. Sin componentes de clase.
- Props tipadas con interfaces.
- Un componente por archivo.
- Los efectos (`useEffect`) deben tener lista de dependencias completa.
- No usar índices de array como `key` en listas que puedan reordenarse. Usar IDs únicos.
- Estado de carga y error son obligatorios en todo componente que haga fetch.

## Fastify (Backend)

- Cada ruta tiene su handler en un archivo separado.
- Los handlers delegan a servicios. No hay lógica de negocio directamente en el handler.
- Toda entrada se valida con Zod antes de llegar a la lógica de negocio.
- Las respuestas de error siguen el formato estándar definido en `backend-architecture.md`.
- Los handlers son async/await. Sin callbacks.

## Zod

- Los schemas se definen en `shared/schemas/` para reutilización entre mobile y backend.
- Cada endpoint de backend tiene su schema de request y response.
- Los forms del mobile usan los mismos schemas que el backend para los datos que envían.

## Comentarios

- No comentar QUÉ hace el código (los nombres deben explicarlo).
- Comentar ÚNICAMENTE el POR QUÉ cuando no es obvio: restricción oculta, workaround de bug externo, invariante sutil.
- Sin código comentado (`// esto era antes`). Para eso está git.

## Imports

- Imports absolutos via alias de path (`@mobile/`, `@backend/`, `@shared/`). Sin `../../../`.
- Importar solo lo que se usa. Sin `import * as`.
- Ordenar imports: 1) librerías externas, 2) imports del proyecto, 3) imports locales.

## Tests (cuando se implementen)

- Los tests van en `__tests__/` junto al código que prueban, o en un directorio `tests/` raíz por workspace.
- Tests unitarios para lógica de negocio en servicios del backend.
- Tests de integración para endpoints críticos (auth, payments, trips).
- No mockear la base de datos en tests de integración. Usar una base de datos de test dedicada.
