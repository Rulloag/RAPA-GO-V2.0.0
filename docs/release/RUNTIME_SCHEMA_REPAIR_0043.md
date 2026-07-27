# RAPA GO · Reparación 0043 de producción

El formulario de Mercado Pago no aparece porque `POST /api/rides/request`
termina con HTTP 500 antes de crear el checkout. El mismo INSERT falla con
efectivo, por lo que Mercado Pago no es la causa primaria.

Los logs también muestran fallos al leer `account_deletion_requests` y un error
de tipo en el job de conservación. Esto indica desfase entre el backend y la
base realmente usada por Hostinger, además del error separado del job.

## Orden de aplicación

1. Ejecutar `node apps/api/scripts/diagnose-runtime-schema.mjs` usando la misma
   `DATABASE_URL` de Hostinger.
2. Confirmar que el host y base son el Supabase productivo correcto.
3. Ejecutar `npm run db:migrate --workspace=apps/api`.
4. Verificar con `docs/release/sql/0043_runtime_schema_verify.sql`.
5. Compilar, desplegar la API y reiniciar Node en Hostinger.
6. Probar primero efectivo y luego tarjeta. La tarjeta debe redirigir al checkout
   alojado de Mercado Pago después de crear el viaje.

El router actual ya incluye barreras contra pantalla negra. Si persiste tras el
nuevo despliegue, capturar el error rojo exacto de Console y confirmar que el
frontend publicado corresponde al commit actual.
