# Cierre de matriz — puntos 19, 20, 21, 22, 23 y 24

## Punto 19 — Ubicación durante la búsqueda previa

- Captura efímera en `sessionStorage` con vencimiento de 15 minutos.
- Eliminación al crear la solicitud, abandonar la pantalla o expirar.
- Sin copia de coordenadas GPS exactas en observaciones del viaje.
- El backend recibe el origen confirmado al crear la solicitud, no un seguimiento continuo previo.

**Estado:** completado.

## Punto 20 — Condiciones para Usuarios

- Documento independiente, versionado y con fecha de vigencia.
- Una sola versión activa por tipo.
- Aceptación registrable cuando corresponde.
- Separación respecto de Términos y Política de Privacidad.

**Estado:** completado.

## Punto 21 — Documentos legales incompletos

- Rechazo de contenido vacío o con frases de preparación.
- Migración con versiones definitivas activas.
- Mensaje de indisponibilidad no contractual cuando falta una publicación.

**Estado:** completado.

## Punto 22 — Comentarios privados

- Visibilidad `participants_and_admin` o `admin_only`.
- Redacción del comentario privado para el conductor y almacenamiento persistente local.
- Moderación administrativa con motivo, responsable y fecha.

**Estado:** completado.

## Punto 23 — Mercado Pago

- Webhook firmado, auditable e idempotente.
- Control de monto y moneda.
- Estados, referencias, reembolsos y comprobante conciliable.
- Persistencia de intentos y errores de procesamiento.

**Estado:** completado técnicamente; requiere prueba controlada en producción antes de declarar operación financiera productiva.

## Punto 24 — Pagos en efectivo

- Cierre backend único por viaje completado.
- Monto recibido, tarifa y excedente calculados en servidor.
- Integración con beneficio o devolución bancaria.
- Consulta administrativa y protección contra reintentos inconsistentes.

**Estado:** completado.

## Evidencia de validación

- TypeScript del backend sin errores.
- Pruebas unitarias de pagos, calificaciones, devoluciones, beneficios y cierre de efectivo aprobadas.
- Build del backend y frontend aprobado.
- Historial de migraciones Drizzle válido.
