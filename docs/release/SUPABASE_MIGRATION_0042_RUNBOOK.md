# Supabase — ejecución segura de la migración 0042

## Antes de ejecutar

1. Confirmar proyecto y región correctos.
2. Tomar snapshot/backup o confirmar PITR.
3. Confirmar que 0041 está aplicada.
4. Exportar estructura de las tablas afectadas.
5. Ejecutar primero en un proyecto de staging o copia.

## Tablas afectadas

- `oauth_identities`
- `auth_identities`
- `account_deletion_requests`
- `cash_overpayment_refund_requests`
- `legal_documents`

## Ejecución

Abrir SQL Editor en Supabase y ejecutar íntegramente:

`apps/api/src/db/migrations/0042_production_closure.sql`

El archivo usa una transacción. No modificarlo a mitad de ejecución.

## Verificación

Ejecutar:

`docs/release/sql/0042_production_closure_verify.sql`

Guardar el resultado como PDF o captura sin datos personales.

## Prueba funcional posterior

- Crear solicitud sin motivo.
- Confirmar `verified_at` y deadline de treinta días.
- Simular solicitud `failed` y reintentar.
- Probar cuenta Apple QA.
- Confirmar versión 2.1 activa de los cuatro documentos actualizados.
- Ejecutar health check de la API.

## Reversión

No borrar columnas después de que producción comience a escribirlas. Si la aplicación falla:

1. Revertir el despliegue de API al commit anterior.
2. Mantener las columnas nuevas; son compatibles con datos antiguos.
3. Desactivar temporalmente `RETENTION_PURGE_ENABLED` si el problema está en el job.
4. No restaurar un backup salvo que exista pérdida/corrupción confirmada y autorización del responsable.
