# RAPA GO · Cierre técnico de los puntos 01, 02 y 03

Fecha: 20 de julio de 2026

## Punto 01 · Regla definitiva de No Show

Definición implementada:

- El conductor debe marcar su llegada al origen.
- Debe esperar 5 minutos completos desde `arrivedAt`.
- El cargo es 50% de la tarifa aplicable.
- Tope máximo: $5.000 CLP.
- El cargo queda sujeto a revisión y aprobación administrativa.
- No se descuenta automáticamente de una tarjeta.
- Al recaudarse, se distribuye 50% al conductor y 50% a Rapa Go.
- La API entrega el cargo total y ambas participaciones en pesos.

Estado técnico: **resuelto**.

## Punto 02 · Inicio de los dos minutos gratuitos

Definición implementada:

- El contador comienza con `acceptedAt`, cuando el conductor acepta la solicitud.
- La aplicación comunica que la asignación fue confirmada al pasajero.
- Antes de 120.000 ms, la cancelación inmediata es gratuita.
- Desde 120.000 ms, puede generarse un cargo de 30%, con tope de $3.000 CLP, sujeto a revisión administrativa y excepciones.

Estado técnico: **resuelto**.

## Punto 03 · Categorías tarifarias

Categorías activas:

- `resident`: Residente Rapa Nui aprobado, multiplicador 1,00.
- `chilean`: Turista chileno, multiplicador 1,13.
- `foreigner`: Turista extranjero, multiplicador 1,20.

Regla de residencia:

- Una solicitud de residencia pendiente o rechazada no bloquea la cuenta.
- Mientras no exista aprobación, la categoría efectiva es `chilean`.
- Al aprobarse el documento, la categoría efectiva cambia a `resident`.
- `rapanui_normal` no es una categoría seleccionable; solo puede aparecer en compatibilidad/migraciones para convertir datos antiguos.

Estado técnico: **resuelto**.

Pendiente no técnico: Jurídica/Gerencia debe documentar y aprobar la justificación comercial de la diferencia entre las tarifas de turista chileno y turista extranjero.
