# RAPA GO — Matriz de conservación y eliminación

Esta matriz debe ser aprobada por Jurídica, Contabilidad y Seguridad antes de la publicación definitiva. Los plazos operativos pueden acortarse cuando no exista una obligación legal o un caso abierto.

| Categoría | Plazo operativo | Acción al vencer | Excepción |
|---|---:|---|---|
| Ubicación GPS detallada de viaje | 90 días | Eliminación automática | Investigación, accidente o reclamo abierto |
| Última ubicación previa/operativa | 90 días | Eliminación automática | Investigación activa |
| Historial básico de viajes | 5 años | Anonimizar identificadores no necesarios | Defensa de derechos o deber legal |
| Pagos y conciliaciones | 6 años | Conservación restringida | Plazo superior obligatorio |
| Documentos tributarios | 6 años | Conservación restringida | Plazo superior obligatorio |
| IP y logs de seguridad | 12 meses | Eliminación/anonimización | Incidente o fraude activo |
| Soporte ordinario | 24 meses desde cierre | Eliminación/anonimización | Reclamo o litigio abierto |
| Comentarios y calificaciones | Vida de cuenta o 24 meses tras eliminación | Desvincular/anonimizar | Moderación o reclamo activo |
| Accidentes e incidentes | 5 años desde cierre | Eliminación restringida | Litigio o norma aplicable |
| Fraude y contracargos | 5 años desde cierre | Eliminación restringida | Investigación activa |
| Códigos de eliminación vencidos | 30 días después de vencer/consumirse | Eliminación automática | Abuso bajo investigación |
| Intercambios OAuth efímeros Facebook | 7 días después de vencer | Eliminación automática | Ninguna, salvo investigación técnica |
| Número bancario cifrado de reembolso | 30 días después de completar | Borrar número completo | Disputa de transferencia abierta |
| Comprobante bancario/transferencia | 30 días después de completar | Borrar adjunto; conservar referencia mínima | Disputa abierta |
| Backups | Según ciclo aprobado del proveedor | Rotación irreversible | Legal hold; no reactivar cuenta eliminada |
| Cuenta eliminada | Al aprobar y completar | Anonimizar/desactivar | Registros mínimos separados y restringidos |

## Implementación existente

`RetentionJob` ejecuta de manera periódica:

- purga de ubicaciones vencidas;
- purga de verificaciones de eliminación antiguas;
- purga de intercambios Facebook vencidos;
- minimización de datos bancarios de reembolsos completados.

## Controles obligatorios

- Registrar cantidad de filas afectadas sin registrar contenido personal.
- Alertar si el job falla repetidamente.
- Probar el job en QA antes de producción.
- Documentar el ciclo de backups de Supabase y Hostinger.
- Aplicar legal hold solo con motivo, responsable y fecha de revisión.
