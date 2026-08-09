# RAPA GO — Cierre tributario SII/DTE

## Estado técnico

Klap procesa/certifica la transacción del medio de pago electrónico, pero su comprobante no reemplaza el documento tributario que corresponda emitir a Haka Taiko SpA o al prestador definido por Contabilidad.

Este repositorio no contiene credenciales de SII ni una integración DTE certificada. Por seguridad y cumplimiento, no se simula una emisión real.

## Decisión obligatoria de Contabilidad

Completar y firmar:

- Emisor del documento por transporte: ____________________
- Emisor del documento por comisión/intermediación: ____________________
- Documento aplicable al pago electrónico: ____________________
- Documento aplicable al efectivo: ____________________
- Facturación a hoteles/empresas: ____________________
- Plazo de emisión: ____________________
- Proveedor DTE/SII utilizado: ____________________
- Procedimiento de anulación/corrección: ____________________
- Responsable de conciliación: ____________________

## Evidencia mínima para GO

- DTE real de una transacción QA Klap.
- DTE real o procedimiento probado para efectivo.
- Conciliación entre DTE, pago y `rideId`.
- Manejo de rechazo del proveedor.
- Anulación/corrección probada.
- Protección y rotación de credenciales tributarias.

Hasta completar esta evidencia, el cierre tributario permanece externo y no debe marcarse como aprobado.
