# Acción obligatoria — Rotación de credenciales

Durante la revisión del Bloque A se detectó que `apps/api/.env.example` contenía valores con apariencia de credenciales reales. El archivo fue reemplazado por una plantilla sin secretos, pero eliminar el valor del último commit no invalida una credencial que ya fue compartida o quedó en el historial de Git.

## Rotar antes de producción

1. Contraseña/URL de PostgreSQL o Supabase.
2. `JWT_SECRET` y revocar sesiones existentes cuando se cambie.
3. Clave de Google Maps y sus restricciones.
4. Secreto de Facebook Login.
5. Credenciales y secreto de webhook de Mercado Pago.
6. Contraseña SMTP.
7. Credenciales de WhatsApp, si alguna vez fueron configuradas.

## Nueva variable obligatoria

- `BANK_ACCOUNT_ENCRYPTION_KEY`: secreto exclusivo del backend, mínimo 32 caracteres; recomendado 32 bytes aleatorios representados como 64 caracteres hexadecimales.
- Debe mantenerse estable: cambiarla sin una migración de recifrado impediría abrir cuentas bancarias ya guardadas.
- No debe reutilizar `JWT_SECRET`, contraseña de base de datos ni claves de proveedores.

## Repositorio

- No volver a subir `.env` ni plantillas con valores reales.
- Revisar el historial y, si corresponde a la política del equipo, reescribirlo después de rotar credenciales y coordinar con todos los colaboradores.
- Activar análisis de secretos del repositorio cuando esté disponible.
