# RAPA GO — Cierre técnico para producción

Fecha del paquete: 23 de julio de 2026
Frontend público y legales: `https://api.rapago.cl`
Backend: `https://backend.rapago.cl`
Base de datos: Supabase PostgreSQL, región declarada São Paulo (`sa-east-1`)

## 1. Cambios técnicos incluidos

### Eliminación de cuenta

- El motivo quedó opcional en API, aplicación y migración SQL.
- El estado genérico `rejected` se migra a `identity_not_verified`.
- Una solicitud `failed` puede reintentarse desde Administración.
- Se registra `verified_at` y el plazo de treinta días se calcula desde la verificación.
- Se conserva evidencia segura de la revocación Apple: estado, intento, fecha y error saneado.
- Se revocan sesiones y refresh tokens de RAPA GO.
- Se eliminan las identidades de `auth_identities` y `oauth_identities` solamente después de intentar la revocación Apple.
- La anonimización sigue siendo transaccional y conserva únicamente registros mínimos operativos o legales.

### Sign in with Apple

- El `client_id`/audience original se conserva en `provider_client_id`.
- El refresh token permanece cifrado mediante `OAUTH_TOKEN_ENCRYPTION_KEY`.
- Se agregó una llamada al endpoint oficial de revocación de Apple.
- La eliminación falla de manera segura si existe identidad Apple pero no existe un refresh token revocable.
- Las cuentas antiguas pueden usar `APPLE_REVOCATION_DEFAULT_CLIENT_ID`, siempre que corresponda realmente al identificador que emitió el token.

### Conservación y minimización

- El job `RetentionJob` se inicia con la API en producción.
- El job elimina ubicaciones vencidas.
- Elimina verificaciones de borrado y credenciales efímeras históricas de Facebook vencidas; Facebook Login permanece deshabilitado.
- Borra el número bancario cifrado y el comprobante adjunto treinta días después de completar un reembolso, conservando referencia, monto y últimos cuatro dígitos.
- El acceso administrativo a los datos de transferencia queda auditado.

### URLs

Las URLs canónicas son:

- `https://api.rapago.cl/terminos`
- `https://api.rapago.cl/privacidad`
- `https://api.rapago.cl/soporte`
- `https://api.rapago.cl/eliminar-cuenta`
- `https://api.rapago.cl/eula`

El backend móvil se mantiene en `https://backend.rapago.cl/api`.

### Legales

La migración `0042_production_closure.sql` activa la versión 2.1 de:

- Términos y Condiciones.
- Condiciones para Usuarios, subordinadas expresamente a los Términos Generales.
- Condiciones para Conductores.
- Política de Privacidad.

La versión 2.1 incorpora cancelación, no show, distribución 50/50, eliminación con motivo opcional, arquitectura Hostinger/Supabase, retención y URLs canónicas.

## 2. Orden obligatorio de despliegue

1. Guardar una copia o snapshot de la base de producción.
2. Revisar que `0041_fix_resident_registration_trigger.sql` esté aplicada.
3. Aplicar `0042_production_closure.sql` en Supabase.
4. Ejecutar `0042_production_closure_verify.sql` y guardar el resultado como evidencia.
5. Configurar las variables de Hostinger indicadas en `.env.example` sin exponer valores.
6. Desplegar la API y comprobar `/health` y `/ready` según las rutas del proyecto.
7. Desplegar el frontend en `api.rapago.cl`.
8. Ejecutar `npm run verify:release`.
9. Ejecutar typecheck, pruebas y builds.
10. Ejecutar pruebas reales de eliminación con una cuenta correo y una cuenta Apple QA.
11. Construir y firmar Android e iOS desde el commit congelado.
12. Completar las evidencias externas y firmas.

## 3. Variables críticas de Hostinger

No pegar valores en GitHub ni en documentos compartidos.

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `BANK_ACCOUNT_ENCRYPTION_KEY`
- `OAUTH_TOKEN_ENCRYPTION_KEY`
- `APPLE_ALLOWED_CLIENT_IDS`
- `APPLE_REVOCATION_DEFAULT_CLIENT_ID`
- `APPLE_TEAM_ID`
- `APPLE_KEY_ID`
- `APPLE_PRIVATE_KEY`
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `RETENTION_PURGE_ENABLED=true`
- `RETENTION_PURGE_INTERVAL_MINUTES=60`
- `FRONTEND_URL=https://api.rapago.cl`
- `PUBLIC_WEB_BASE_URL=https://api.rapago.cl`

Las claves de cifrado no deben cambiarse sin un plan de rotación, porque los tokens Apple y números bancarios existentes dependen de ellas.

## 4. Pruebas mínimas de producción controlada

### Eliminación por correo

1. Solicitar código desde la URL pública.
2. Crear solicitud sin escribir motivo.
3. Confirmar `verified_at` y `deadline_at`.
4. Aprobar desde Admin.
5. Confirmar sesiones revocadas, cuenta anonimizada y acceso bloqueado.
6. Confirmar correo de recepción y finalización.

### Eliminación Apple

1. Usar una cuenta QA Apple que haya entregado authorization code.
2. Confirmar token cifrado y `provider_client_id` sin mostrar el valor del token.
3. Solicitar eliminación.
4. Aprobar desde Admin.
5. Confirmar `apple_revocation_status` como `revoked` o `already_invalid`.
6. Confirmar eliminación de ambas tablas de identidades.
7. Probar un nuevo registro con la misma cuenta Apple.

### Conservación

1. Ejecutar manualmente el job en ambiente QA con datos vencidos.
2. Confirmar eliminación de puntos GPS vencidos.
3. Confirmar purga de datos bancarios sensibles después del plazo.
4. Confirmar que las referencias contables mínimas permanecen.

## 5. Qué no convierte este ZIP por sí solo en una publicación 100 % aprobada

Los siguientes pasos dependen de consolas, credenciales o decisiones externas y no pueden acreditarse solo modificando código:

- Aplicación real de la migración en Supabase de producción.
- Configuración real de variables en Hostinger.
- Prueba real del endpoint de revocación de Apple.
- Emisión real de boleta/factura/DTE y certificación de Contabilidad.
- AAB firmado y procesado por Google Play.
- Archive iOS/TestFlight firmado por Apple.
- App Privacy, Data Safety y formularios de ubicación completados.
- Pruebas físicas Android/iPhone.
- Sincronización final de la rama con `main`.
- Firmas de Soporte, Jurídica y Gerencia.

El release es **GO** únicamente cuando el código validado y todas esas evidencias pertenecen al mismo commit congelado.
