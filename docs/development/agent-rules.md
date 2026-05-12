# Reglas para Agentes de IA — RAPA GO V2.0.0

Este documento define el comportamiento esperado de cualquier agente de IA (Claude Code u otro) que trabaje en este repositorio.

## Reglas de comportamiento obligatorias

### Antes de crear o modificar cualquier archivo

1. **Leer siempre antes de escribir.** Nunca sobrescribir un archivo sin leer su contenido actual.
2. **Verificar la existencia del archivo.** Si el archivo ya existe con contenido relevante, extender o actualizar en lugar de reemplazar.
3. **Respetar la estructura de carpetas** definida en `docs/README.md` y `PROJECT_RULES.md`.

### Al generar código

4. **No crear código de aplicación hasta que la documentación y la arquitectura estén completas** para ese módulo.
5. **No crear módulos demo, simulados o con datos hardcodeados** que imiten flujos reales.
6. **No usar `localStorage`** para flujos críticos. Ver `docs/decisions/0004-no-critical-localstorage.md`.
7. **No crear wallet demo, matching simulado ni flujos de pago** sin conexión real al backend.
8. **Toda pantalla debe tener**: ruta, validación, loading, error, datos reales. Nunca solo layout.
9. **Todo botón debe tener**: acción definida, estado disabled cuando corresponda, manejo de errores.

### Alcance de los cambios

10. **Un módulo por tarea.** No mezclar cambios de múltiples módulos en una sola sesión salvo que sea explícitamente necesario.
11. **Cambios pequeños y revisables.** Si una tarea parece muy grande, dividirla y consultar antes de proceder.
12. **No refactorizar código no relacionado** con la tarea en curso.

### Seguridad

13. **No generar ni hardcodear** API keys, secrets, passwords o tokens en ningún archivo.
14. **No añadir dependencias** sin verificar que sean necesarias y que no introduzcan vulnerabilidades conocidas.

### Stack tecnológico

15. **No cambiar el stack** sin un ADR aprobado. El stack está definido en `PROJECT_RULES.md`.
16. **No instalar alternativas** a las tecnologías ya decididas (ej. no agregar Express si el stack es Fastify, no agregar Redux si el estado se gestiona con Context/Zustand).

## Cómo reportar bloqueos

Si el agente no puede completar una tarea por ambigüedad, conflicto de reglas o falta de información, debe:
1. Detener el trabajo.
2. Describir claramente el bloqueo.
3. Proponer opciones al desarrollador humano.
4. No tomar decisiones arquitectónicas unilaterales.

## Orden de prioridad al resolver conflictos

1. `PROJECT_RULES.md` (máxima autoridad).
2. ADRs en `docs/decisions/`.
3. Este documento (`agent-rules.md`).
4. Instrucciones directas del desarrollador en la sesión actual.
