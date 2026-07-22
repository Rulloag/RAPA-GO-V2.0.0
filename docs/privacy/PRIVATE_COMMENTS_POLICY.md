# Política de comentarios privados

## Alcance

La política se aplica a comentarios escritos en calificaciones y observaciones privadas asociadas a un viaje.

## Visibilidad

El usuario elige una de estas opciones:

- `participants_and_admin`: visible para participantes autorizados del viaje y administradores.
- `admin_only`: visible únicamente para administradores autorizados de RAPA GO.

Un comentario `admin_only` no se muestra al conductor calificado ni se conserva con texto completo en almacenamiento persistente del navegador. La copia local persistente queda redactada y la copia temporal necesaria para sincronización se mantiene en `sessionStorage`.

## Moderación

El administrador puede:

- revisar comentarios asociados a viajes;
- ocultar contenido;
- registrar el motivo de moderación;
- identificar quién moderó y cuándo;
- mantener la calificación numérica separada del texto cuando corresponda.

## Controles de acceso

- El backend decide la visibilidad; el frontend no es la autoridad final.
- El usuario que no participa en el viaje no puede consultar el comentario.
- Los comentarios ocultos solo se entregan a administradores autorizados.
- La respuesta al conductor omite el texto cuando la visibilidad es `admin_only`.

## Evidencia técnica

- Campos de privacidad y moderación en el esquema de calificaciones.
- Servicios y rutas administrativas en `apps/api/src/modules/ratings`.
- Selector “Comentario solo para RAPA GO” en las pantallas de calificación.
- Sincronización segura en `apps/mobile/src/features/ratings/RatingSyncRuntime.tsx`.
- Migración: `apps/api/src/db/migrations/0038_final_matrix_19_24.sql`.

**Estado del punto 22:** completado técnicamente.
